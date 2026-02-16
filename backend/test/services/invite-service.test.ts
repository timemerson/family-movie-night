import { describe, it, expect, vi, beforeEach } from "vitest";
import { InviteService } from "../../src/services/invite-service.js";

function createMockDocClient() {
  return { send: vi.fn() };
}

describe("InviteService", () => {
  let mockSend: ReturnType<typeof vi.fn>;
  let service: InviteService;

  beforeEach(() => {
    const client = createMockDocClient();
    mockSend = client.send;
    service = new InviteService(client as any, "test-invites");
  });

  describe("createInvite", () => {
    it("creates an invite with pending status and expiry", async () => {
      mockSend.mockResolvedValueOnce({});

      const invite = await service.createInvite("g-1", "user-1");

      expect(invite.group_id).toBe("g-1");
      expect(invite.created_by).toBe("user-1");
      expect(invite.status).toBe("pending");
      expect(invite.invite_token).toBeTruthy();
      expect(invite.invite_id).toBeTruthy();
      expect(new Date(invite.expires_at).getTime()).toBeGreaterThan(Date.now());
      expect(invite.ttl).toBeGreaterThan(0);
    });
  });

  describe("getInviteByToken", () => {
    it("returns invite when found", async () => {
      const invite = {
        invite_id: "i-1",
        invite_token: "abc123",
        status: "pending",
      };
      mockSend.mockResolvedValueOnce({ Items: [invite] });

      const result = await service.getInviteByToken("abc123");
      expect(result.invite_id).toBe("i-1");
    });

    it("throws NotFoundError when token not found", async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });

      await expect(service.getInviteByToken("bad-token")).rejects.toThrow(
        "Invite not found",
      );
    });
  });

  describe("acceptInvite", () => {
    it("accepts a valid pending invite", async () => {
      const invite = {
        invite_id: "i-1",
        group_id: "g-1",
        status: "pending",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      } as any;

      mockSend.mockResolvedValueOnce({});

      await service.acceptInvite(invite);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("throws GoneError for revoked invite", async () => {
      const invite = {
        invite_id: "i-1",
        status: "revoked",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      } as any;

      await expect(service.acceptInvite(invite)).rejects.toThrow(
        "revoked",
      );
    });

    it("throws GoneError for expired invite", async () => {
      const invite = {
        invite_id: "i-1",
        status: "pending",
        expires_at: new Date(Date.now() - 86400000).toISOString(),
      } as any;

      await expect(service.acceptInvite(invite)).rejects.toThrow(
        "expired",
      );
    });
  });

  describe("listGroupInvites", () => {
    it("returns only pending invites", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { invite_id: "i-1", status: "pending" },
          { invite_id: "i-2", status: "accepted" },
          { invite_id: "i-3", status: "pending" },
        ],
      });

      const result = await service.listGroupInvites("g-1");
      expect(result).toHaveLength(2);
      expect(result.every((i) => i.status === "pending")).toBe(true);
    });
  });

  describe("revokeInvite", () => {
    it("revokes an invite belonging to the group", async () => {
      mockSend.mockResolvedValueOnce({
        Item: { invite_id: "i-1", group_id: "g-1", status: "pending" },
      });
      mockSend.mockResolvedValueOnce({});

      await service.revokeInvite("i-1", "g-1");
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("throws NotFoundError when invite belongs to different group", async () => {
      mockSend.mockResolvedValueOnce({
        Item: { invite_id: "i-1", group_id: "g-other", status: "pending" },
      });

      await expect(service.revokeInvite("i-1", "g-1")).rejects.toThrow(
        "Invite not found",
      );
    });
  });

  describe("inviteUrl", () => {
    it("generates a valid invite URL", () => {
      const url = InviteService.inviteUrl("abc123");
      expect(url).toBe("https://familymovienight.app/invite/abc123");
    });
  });
});
