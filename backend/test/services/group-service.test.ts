import { describe, it, expect, vi, beforeEach } from "vitest";
import { GroupService } from "../../src/services/group-service.js";

function createMockDocClient() {
  return { send: vi.fn() };
}

describe("GroupService", () => {
  let mockSend: ReturnType<typeof vi.fn>;
  let service: GroupService;

  beforeEach(() => {
    const client = createMockDocClient();
    mockSend = client.send;
    service = new GroupService(
      client as any,
      "test-groups",
      "test-memberships",
      "test-users",
    );
  });

  describe("createGroup", () => {
    it("creates group and membership atomically, returns group with members", async () => {
      mockSend.mockResolvedValueOnce({}); // TransactWriteCommand

      const result = await service.createGroup(
        "user-1",
        "The Emersons",
        "Tim",
        "avatar_bear",
      );

      expect(result.name).toBe("The Emersons");
      expect(result.created_by).toBe("user-1");
      expect(result.streaming_services).toEqual([]);
      expect(result.member_count).toBe(1);
      expect(result.members).toHaveLength(1);
      expect(result.members[0].role).toBe("creator");
      expect(result.members[0].display_name).toBe("Tim");
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe("getGroup", () => {
    it("returns group when found", async () => {
      const group = { group_id: "g-1", name: "Test" };
      mockSend.mockResolvedValueOnce({ Item: group });

      const result = await service.getGroup("g-1");
      expect(result.name).toBe("Test");
    });

    it("throws NotFoundError when group does not exist", async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      await expect(service.getGroup("g-missing")).rejects.toThrow(
        "Group not found",
      );
    });
  });

  describe("getGroupWithMembers", () => {
    it("batch-fetches user profiles for members", async () => {
      // getGroup
      mockSend.mockResolvedValueOnce({
        Item: {
          group_id: "g-1",
          name: "Test",
          created_by: "user-1",
          streaming_services: [],
          member_count: 2,
        },
      });
      // getMembers
      mockSend.mockResolvedValueOnce({
        Items: [
          { group_id: "g-1", user_id: "user-1", role: "creator", joined_at: "2026-01-01T00:00:00Z" },
          { group_id: "g-1", user_id: "user-2", role: "member", joined_at: "2026-01-02T00:00:00Z" },
        ],
      });
      // BatchGetCommand
      mockSend.mockResolvedValueOnce({
        Responses: {
          "test-users": [
            { user_id: "user-1", display_name: "Tim", avatar_key: "avatar_bear" },
            { user_id: "user-2", display_name: "Jane", avatar_key: "avatar_cat" },
          ],
        },
      });

      const result = await service.getGroupWithMembers("g-1");

      expect(result.members).toHaveLength(2);
      expect(result.members[0].display_name).toBe("Tim");
      expect(result.members[1].display_name).toBe("Jane");
      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it("returns empty members for group with no members", async () => {
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", name: "Test", member_count: 0 },
      });
      mockSend.mockResolvedValueOnce({ Items: [] });

      const result = await service.getGroupWithMembers("g-1");

      expect(result.members).toHaveLength(0);
      // Should not call BatchGetCommand
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe("requireMember", () => {
    it("returns membership when user is a member", async () => {
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-1", role: "member" },
      });

      const result = await service.requireMember("g-1", "user-1");
      expect(result.role).toBe("member");
    });

    it("throws ForbiddenError when user is not a member", async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      await expect(service.requireMember("g-1", "user-999")).rejects.toThrow(
        "Not a member",
      );
    });
  });

  describe("requireCreator", () => {
    it("returns membership when user is the creator", async () => {
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-1", role: "creator" },
      });

      const result = await service.requireCreator("g-1", "user-1");
      expect(result.role).toBe("creator");
    });

    it("throws ForbiddenError when user is a member but not creator", async () => {
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-2", role: "member" },
      });

      await expect(service.requireCreator("g-1", "user-2")).rejects.toThrow(
        "Only the group creator",
      );
    });
  });

  describe("addMember", () => {
    it("adds a member via transaction", async () => {
      mockSend.mockResolvedValueOnce({}); // TransactWriteCommand

      const result = await service.addMember("g-1", "user-2");
      expect(result.role).toBe("member");
      expect(result.user_id).toBe("user-2");
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("throws ConflictError when group is full", async () => {
      const txError = new Error("Transaction cancelled");
      txError.name = "TransactionCanceledException";
      (txError as any).CancellationReasons = [
        { Code: "ConditionalCheckFailed" },
        { Code: "None" },
      ];
      mockSend.mockRejectedValueOnce(txError);

      await expect(service.addMember("g-1", "user-new")).rejects.toThrow(
        "Group is full",
      );
    });

    it("throws ConflictError when user is already a member", async () => {
      const txError = new Error("Transaction cancelled");
      txError.name = "TransactionCanceledException";
      (txError as any).CancellationReasons = [
        { Code: "None" },
        { Code: "ConditionalCheckFailed" },
      ];
      mockSend.mockRejectedValueOnce(txError);

      await expect(service.addMember("g-1", "user-1")).rejects.toThrow(
        "Already a member",
      );
    });
  });

  describe("leaveGroup", () => {
    it("removes regular member and decrements count atomically", async () => {
      // getMembership
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-2", role: "member" },
      });
      // TransactWriteCommand (delete membership + update count)
      mockSend.mockResolvedValueOnce({});

      await service.leaveGroup("g-1", "user-2");
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("promotes next member when creator leaves", async () => {
      // getMembership
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-1", role: "creator" },
      });
      // getMembers (remaining)
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            group_id: "g-1",
            user_id: "user-1",
            role: "creator",
            joined_at: "2026-01-01T00:00:00Z",
          },
          {
            group_id: "g-1",
            user_id: "user-2",
            role: "member",
            joined_at: "2026-01-02T00:00:00Z",
          },
          {
            group_id: "g-1",
            user_id: "user-3",
            role: "member",
            joined_at: "2026-01-03T00:00:00Z",
          },
        ],
      });
      // TransactWriteCommand (delete + promote + update group)
      mockSend.mockResolvedValueOnce({});

      await service.leaveGroup("g-1", "user-1");
      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it("deletes group when last member leaves", async () => {
      // getMembership
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-1", role: "creator" },
      });
      // getMembers (only the leaving user)
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            group_id: "g-1",
            user_id: "user-1",
            role: "creator",
            joined_at: "2026-01-01T00:00:00Z",
          },
        ],
      });
      // TransactWriteCommand (delete membership + delete group)
      mockSend.mockResolvedValueOnce({});

      await service.leaveGroup("g-1", "user-1");
      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it("throws NotFoundError when not a member", async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      await expect(service.leaveGroup("g-1", "user-999")).rejects.toThrow(
        "Not a member",
      );
    });
  });

  describe("getUserGroup", () => {
    it("returns membership when user belongs to a group", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [{ group_id: "g-1", user_id: "user-1", role: "creator" }],
      });

      const result = await service.getUserGroup("user-1");
      expect(result?.group_id).toBe("g-1");
    });

    it("returns null when user has no group", async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });

      const result = await service.getUserGroup("user-new");
      expect(result).toBeNull();
    });
  });
});
