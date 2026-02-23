import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserService } from "../../src/services/user-service.js";
import { GroupService } from "../../src/services/group-service.js";

function createMockDocClient() {
  return { send: vi.fn() };
}

describe("Managed Member Infrastructure (Slice C3)", () => {
  describe("UserService.createManagedMember", () => {
    let mockSend: ReturnType<typeof vi.fn>;
    let service: UserService;

    beforeEach(() => {
      const client = createMockDocClient();
      mockSend = client.send;
      service = new UserService(client as any, "test-users");
    });

    it("creates a managed user with synthetic ID", async () => {
      mockSend.mockResolvedValueOnce({});

      const user = await service.createManagedMember("parent-1", "Max", "avatar_fox");

      expect(user.user_id).toMatch(/^managed_/);
      expect(user.display_name).toBe("Max");
      expect(user.avatar_key).toBe("avatar_fox");
      expect(user.is_managed).toBe(true);
      expect(user.parent_user_id).toBe("parent-1");
      expect(user.email).toBe("");
      expect(user.notification_prefs.vote_nudge).toBe(false);
    });

    it("uses default avatar when not specified", async () => {
      mockSend.mockResolvedValueOnce({});

      const user = await service.createManagedMember("parent-1", "Lily");

      expect(user.avatar_key).toBe("avatar_bear");
    });
  });

  describe("UserService.getUser", () => {
    let mockSend: ReturnType<typeof vi.fn>;
    let service: UserService;

    beforeEach(() => {
      const client = createMockDocClient();
      mockSend = client.send;
      service = new UserService(client as any, "test-users");
    });

    it("returns user when found", async () => {
      mockSend.mockResolvedValueOnce({
        Item: { user_id: "u-1", display_name: "Alice", is_managed: false },
      });

      const user = await service.getUser("u-1");
      expect(user?.display_name).toBe("Alice");
    });

    it("returns null when not found", async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      const user = await service.getUser("u-999");
      expect(user).toBeNull();
    });
  });

  describe("GroupService.addManagedMember", () => {
    let mockSend: ReturnType<typeof vi.fn>;
    let groupService: GroupService;
    let mockUserService: { createManagedMember: ReturnType<typeof vi.fn>; deleteUser: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      const client = createMockDocClient();
      mockSend = client.send;
      groupService = new GroupService(
        client as any,
        "test-groups",
        "test-memberships",
        "test-users",
      );
      mockUserService = {
        createManagedMember: vi.fn(),
        deleteUser: vi.fn(),
      };
    });

    it("creates managed member and adds to group", async () => {
      mockUserService.createManagedMember.mockResolvedValueOnce({
        user_id: "managed_abc",
        display_name: "Max",
        avatar_key: "avatar_fox",
        is_managed: true,
        parent_user_id: "parent-1",
      });
      // TransactWriteCommand succeeds
      mockSend.mockResolvedValueOnce({});

      const member = await groupService.addManagedMember(
        "g-1",
        "parent-1",
        "Max",
        "avatar_fox",
        mockUserService as any,
      );

      expect(member.user_id).toBe("managed_abc");
      expect(member.member_type).toBe("managed");
      expect(member.role).toBe("member");
      expect(member.display_name).toBe("Max");
      expect(member.avatar_key).toBe("avatar_fox");
    });

    it("cleans up user record if group transaction fails", async () => {
      mockUserService.createManagedMember.mockResolvedValueOnce({
        user_id: "managed_abc",
        display_name: "Max",
        avatar_key: "avatar_fox",
        is_managed: true,
        parent_user_id: "parent-1",
      });
      // TransactWriteCommand fails (group full)
      const err = new Error("TransactionCanceledException");
      err.name = "TransactionCanceledException";
      mockSend.mockRejectedValueOnce(err);
      mockUserService.deleteUser.mockResolvedValueOnce(undefined);

      await expect(
        groupService.addManagedMember("g-1", "parent-1", "Max", "avatar_fox", mockUserService as any),
      ).rejects.toThrow("Group is full");

      expect(mockUserService.deleteUser).toHaveBeenCalledWith("managed_abc");
    });
  });

  describe("GroupService.removeMember", () => {
    let mockSend: ReturnType<typeof vi.fn>;
    let groupService: GroupService;
    let mockUserService: { getUser: ReturnType<typeof vi.fn>; deleteUser: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      const client = createMockDocClient();
      mockSend = client.send;
      groupService = new GroupService(
        client as any,
        "test-groups",
        "test-memberships",
        "test-users",
      );
      mockUserService = {
        getUser: vi.fn(),
        deleteUser: vi.fn(),
      };
    });

    it("creator can remove a managed member", async () => {
      // getMembership for caller (creator)
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "creator-1", role: "creator", member_type: "independent" },
      });
      // getMembership for target (managed)
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "managed_abc", role: "member", member_type: "managed" },
      });
      // getUser for target
      mockUserService.getUser.mockResolvedValueOnce({
        user_id: "managed_abc",
        is_managed: true,
        parent_user_id: "creator-1",
      });
      // TransactWriteCommand (delete membership + decrement)
      mockSend.mockResolvedValueOnce({});
      // deleteUser for managed member
      mockUserService.deleteUser.mockResolvedValueOnce(undefined);

      await groupService.removeMember("g-1", "managed_abc", "creator-1", mockUserService as any);

      expect(mockUserService.deleteUser).toHaveBeenCalledWith("managed_abc");
    });

    it("parent can remove their own managed member", async () => {
      // getMembership for caller (member, but is parent)
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "parent-1", role: "member", member_type: "independent" },
      });
      // getMembership for target
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "managed_abc", role: "member", member_type: "managed" },
      });
      // getUser for target
      mockUserService.getUser.mockResolvedValueOnce({
        user_id: "managed_abc",
        is_managed: true,
        parent_user_id: "parent-1",
      });
      // TransactWriteCommand
      mockSend.mockResolvedValueOnce({});
      // deleteUser
      mockUserService.deleteUser.mockResolvedValueOnce(undefined);

      await groupService.removeMember("g-1", "managed_abc", "parent-1", mockUserService as any);

      expect(mockUserService.deleteUser).toHaveBeenCalledWith("managed_abc");
    });

    it("non-parent non-creator cannot remove managed member", async () => {
      // getMembership for caller
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "other-user", role: "member", member_type: "independent" },
      });
      // getMembership for target
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "managed_abc", role: "member", member_type: "managed" },
      });
      // getUser for target
      mockUserService.getUser.mockResolvedValueOnce({
        user_id: "managed_abc",
        is_managed: true,
        parent_user_id: "parent-1",
      });

      await expect(
        groupService.removeMember("g-1", "managed_abc", "other-user", mockUserService as any),
      ).rejects.toThrow("Cannot remove this managed member");
    });

    it("independent member can remove themselves", async () => {
      // getMembership for caller
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-1", role: "member", member_type: "independent" },
      });
      // getMembership for target (same user)
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-1", role: "member", member_type: "independent" },
      });
      // TransactWriteCommand
      mockSend.mockResolvedValueOnce({});

      await groupService.removeMember("g-1", "user-1", "user-1", mockUserService as any);

      // Should NOT call deleteUser for independent member
      expect(mockUserService.deleteUser).not.toHaveBeenCalled();
    });

    it("non-creator cannot remove another independent member", async () => {
      // getMembership for caller
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-1", role: "member", member_type: "independent" },
      });
      // getMembership for target
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-2", role: "member", member_type: "independent" },
      });

      await expect(
        groupService.removeMember("g-1", "user-2", "user-1", mockUserService as any),
      ).rejects.toThrow("Cannot remove other members");
    });

    it("throws NotFoundError when target member not in group", async () => {
      // getMembership for caller
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "creator-1", role: "creator", member_type: "independent" },
      });
      // getMembership for target — not found
      mockSend.mockResolvedValueOnce({ Item: undefined });

      await expect(
        groupService.removeMember("g-1", "user-999", "creator-1", mockUserService as any),
      ).rejects.toThrow("Member not found in this group");
    });
  });
});
