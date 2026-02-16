import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserService } from "../../src/services/user-service.js";

function createMockDocClient() {
  return {
    send: vi.fn(),
  };
}

describe("UserService", () => {
  let mockClient: ReturnType<typeof createMockDocClient>;
  let service: UserService;

  beforeEach(() => {
    mockClient = createMockDocClient();
    service = new UserService(mockClient as never, "test-Users");
  });

  describe("getOrCreateUser", () => {
    it("returns existing user if found", async () => {
      const existing = {
        user_id: "user-123",
        email: "test@example.com",
        display_name: "Test",
        avatar_key: "avatar_bear",
        created_at: "2026-01-01T00:00:00Z",
        notification_prefs: {
          vote_nudge: true,
          pick_announce: true,
          new_round: true,
        },
      };
      mockClient.send.mockResolvedValueOnce({ Item: existing });

      const result = await service.getOrCreateUser(
        "user-123",
        "test@example.com",
      );

      expect(result).toEqual(existing);
      expect(mockClient.send).toHaveBeenCalledTimes(1);
    });

    it("creates a new user if not found", async () => {
      mockClient.send.mockResolvedValueOnce({ Item: undefined }); // GetCommand
      mockClient.send.mockResolvedValueOnce({}); // PutCommand

      const result = await service.getOrCreateUser(
        "user-456",
        "new@example.com",
      );

      expect(result.user_id).toBe("user-456");
      expect(result.email).toBe("new@example.com");
      expect(result.display_name).toBe("new");
      expect(result.avatar_key).toBe("avatar_bear");
      expect(result.notification_prefs).toEqual({
        vote_nudge: true,
        pick_announce: true,
        new_round: true,
      });
      expect(mockClient.send).toHaveBeenCalledTimes(2);
    });

    it("uses provided displayName when creating", async () => {
      mockClient.send.mockResolvedValueOnce({ Item: undefined });
      mockClient.send.mockResolvedValueOnce({});

      const result = await service.getOrCreateUser(
        "user-789",
        "tim@example.com",
        "Tim",
      );

      expect(result.display_name).toBe("Tim");
    });
  });

  describe("deleteUser", () => {
    it("sends a delete command", async () => {
      mockClient.send.mockResolvedValueOnce({});

      await service.deleteUser("user-123");

      expect(mockClient.send).toHaveBeenCalledTimes(1);
    });
  });
});
