import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../../src/middleware/auth.js";
import { groups } from "../../src/routes/groups.js";

// Mock the dynamo module
vi.mock("../../src/lib/dynamo.js", () => {
  const mockSend = vi.fn();
  return {
    getDocClient: () => ({ send: mockSend }),
    tableName: (key: string) => `test-${key}`,
    __mockSend: mockSend,
  };
});

// @ts-expect-error __mockSend is injected by vi.mock
import { __mockSend as mockSend } from "../../src/lib/dynamo.js";
const mockSendFn = mockSend as unknown as ReturnType<typeof vi.fn>;

function createApp() {
  const app = new Hono();
  app.use("/*", authMiddleware());
  app.route("/", groups);
  app.onError((err: any, c) => {
    if (err.status) return c.json({ error: err.message }, err.status);
    return c.json({ error: "Internal server error" }, 500);
  });
  return app;
}

function makeRequest(
  method: string,
  path: string,
  opts?: {
    body?: unknown;
    userId?: string;
    email?: string;
  },
) {
  const app = createApp();
  const event = {
    requestContext: {
      authorizer: {
        jwt: {
          claims: {
            sub: opts?.userId ?? "user-123",
            email: opts?.email ?? "test@example.com",
          },
        },
      },
    },
  };

  const init: RequestInit = { method };
  if (opts?.body) {
    init.body = JSON.stringify(opts.body);
    init.headers = { "Content-Type": "application/json" };
  }

  return app.request(path, init, { event });
}

describe("Group routes", () => {
  beforeEach(() => {
    mockSendFn.mockReset();
  });

  describe("GET /groups/me", () => {
    it("returns null when user has no group", async () => {
      // getUserGroup query — no group
      mockSendFn.mockResolvedValueOnce({ Items: [] });

      const res = await makeRequest("GET", "/groups/me");

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.group).toBeNull();
    });

    it("returns full group when user has one", async () => {
      // getUserGroup query — has a group
      mockSendFn.mockResolvedValueOnce({
        Items: [{ group_id: "g-1", user_id: "user-123", role: "creator" }],
      });
      // getGroup (within getGroupWithMembers)
      mockSendFn.mockResolvedValueOnce({
        Item: {
          group_id: "g-1",
          name: "The Emersons",
          created_by: "user-123",
          streaming_services: [],
          member_count: 1,
        },
      });
      // getMembers
      mockSendFn.mockResolvedValueOnce({
        Items: [
          { group_id: "g-1", user_id: "user-123", role: "creator", joined_at: "2026-01-01T00:00:00Z" },
        ],
      });
      // BatchGetCommand for user profiles
      mockSendFn.mockResolvedValueOnce({
        Responses: {
          "test-USERS": [
            { user_id: "user-123", display_name: "Tim", avatar_key: "avatar_bear" },
          ],
        },
      });

      const res = await makeRequest("GET", "/groups/me");

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.name).toBe("The Emersons");
      expect(body.members).toHaveLength(1);
    });
  });

  describe("POST /groups", () => {
    it("creates a group and returns 201", async () => {
      // getUserGroup query (user-groups-index) — no existing group
      mockSendFn.mockResolvedValueOnce({ Items: [] });
      // getOrCreateUser — GetCommand returns existing user
      mockSendFn.mockResolvedValueOnce({
        Item: {
          user_id: "user-123",
          email: "test@example.com",
          display_name: "Tim",
          avatar_key: "avatar_bear",
        },
      });
      // TransactWriteCommand (group + membership)
      mockSendFn.mockResolvedValueOnce({});

      const res = await makeRequest("POST", "/groups", {
        body: { name: "The Emersons" },
      });

      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.name).toBe("The Emersons");
      expect(body.created_by).toBe("user-123");
      expect(body.member_count).toBe(1);
      expect(body.members).toHaveLength(1);
      expect(body.members[0].role).toBe("creator");
    });

    it("returns 409 if user already in a group", async () => {
      mockSendFn.mockResolvedValueOnce({
        Items: [{ group_id: "g-existing", user_id: "user-123" }],
      });

      const res = await makeRequest("POST", "/groups", {
        body: { name: "Another Group" },
      });

      expect(res.status).toBe(409);
    });

    it("returns 400 for invalid name", async () => {
      const res = await makeRequest("POST", "/groups", {
        body: { name: "" },
      });

      expect(res.status).toBe(400);
    });

    it("accepts a 40-character name (boundary)", async () => {
      const name40 = "A".repeat(40);
      // getUserGroup — no existing group
      mockSendFn.mockResolvedValueOnce({ Items: [] });
      // getOrCreateUser
      mockSendFn.mockResolvedValueOnce({
        Item: {
          user_id: "user-123",
          email: "test@example.com",
          display_name: "Tim",
          avatar_key: "avatar_bear",
        },
      });
      // TransactWriteCommand
      mockSendFn.mockResolvedValueOnce({});

      const res = await makeRequest("POST", "/groups", {
        body: { name: name40 },
      });

      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.name).toBe(name40);
    });

    it("returns 400 for a 41-character name (over boundary)", async () => {
      const name41 = "A".repeat(41);

      const res = await makeRequest("POST", "/groups", {
        body: { name: name41 },
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /groups/:group_id", () => {
    it("returns group details for a member", async () => {
      // requireMember — GetCommand
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // getGroup — GetCommand
      mockSendFn.mockResolvedValueOnce({
        Item: {
          group_id: "g-1",
          name: "Test Group",
          created_by: "user-1",
          streaming_services: [],
          member_count: 1,
        },
      });
      // getMembers — QueryCommand
      mockSendFn.mockResolvedValueOnce({
        Items: [
          { group_id: "g-1", user_id: "user-123", role: "member", joined_at: "2026-01-01T00:00:00Z" },
        ],
      });
      // BatchGetCommand for user profiles
      mockSendFn.mockResolvedValueOnce({
        Responses: {
          "test-USERS": [
            { user_id: "user-123", display_name: "Tim", avatar_key: "avatar_bear" },
          ],
        },
      });

      const res = await makeRequest("GET", "/groups/g-1");

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.name).toBe("Test Group");
      expect(body.members).toHaveLength(1);
    });

    it("returns 403 for non-member", async () => {
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("GET", "/groups/g-1");

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /groups/:group_id", () => {
    it("updates group when called by creator", async () => {
      // requireCreator — GetCommand (membership)
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "creator" },
      });
      // UpdateCommand returns updated group
      mockSendFn.mockResolvedValueOnce({
        Attributes: {
          group_id: "g-1",
          name: "New Name",
          created_by: "user-123",
          streaming_services: ["netflix"],
          member_count: 1,
        },
      });

      const res = await makeRequest("PATCH", "/groups/g-1", {
        body: { name: "New Name", streaming_services: ["netflix"] },
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.name).toBe("New Name");
    });

    it("returns 403 for non-creator member", async () => {
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });

      const res = await makeRequest("PATCH", "/groups/g-1", {
        body: { name: "New Name" },
      });

      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid update payload", async () => {
      const res = await makeRequest("PATCH", "/groups/g-1", {
        body: { name: "" },
      });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /groups/:group_id/members/me", () => {
    it("allows a member to leave the group", async () => {
      // getMembership
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // TransactWriteCommand (delete membership + update count)
      mockSendFn.mockResolvedValueOnce({});

      const res = await makeRequest("DELETE", "/groups/g-1/members/me");

      expect(res.status).toBe(204);
    });

    it("returns 404 when user is not a member", async () => {
      // getMembership — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("DELETE", "/groups/g-1/members/me");

      expect(res.status).toBe(404);
    });
  });

  describe("POST /groups/:group_id/invites", () => {
    it("creates invite when called by creator", async () => {
      // requireCreator — GetCommand (membership)
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "creator" },
      });
      // PutCommand (invite)
      mockSendFn.mockResolvedValueOnce({});

      const res = await makeRequest("POST", "/groups/g-1/invites");

      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.invite_token).toBeTruthy();
      expect(body.invite_url).toContain("familymovienight.app/invite/");
      expect(body.status).toBe("pending");
    });

    it("returns 403 when called by non-creator member", async () => {
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });

      const res = await makeRequest("POST", "/groups/g-1/invites");

      expect(res.status).toBe(403);
    });
  });

  describe("GET /groups/:group_id/invites", () => {
    it("returns pending invites for creator", async () => {
      // requireCreator
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "creator" },
      });
      // listGroupInvites
      mockSendFn.mockResolvedValueOnce({
        Items: [
          {
            invite_id: "i-1",
            status: "pending",
            created_at: "2026-01-01T00:00:00Z",
            expires_at: "2026-01-08T00:00:00Z",
          },
        ],
      });

      const res = await makeRequest("GET", "/groups/g-1/invites");

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.invites).toHaveLength(1);
      expect(body.invites[0].invite_id).toBe("i-1");
    });

    it("returns 403 for non-creator", async () => {
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });

      const res = await makeRequest("GET", "/groups/g-1/invites");

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /groups/:group_id/invites/:invite_id", () => {
    it("revokes an invite for creator", async () => {
      // requireCreator
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "creator" },
      });
      // getInviteById
      mockSendFn.mockResolvedValueOnce({
        Item: { invite_id: "i-1", group_id: "g-1", status: "pending" },
      });
      // UpdateCommand (revoke)
      mockSendFn.mockResolvedValueOnce({});

      const res = await makeRequest("DELETE", "/groups/g-1/invites/i-1");

      expect(res.status).toBe(204);
    });

    it("returns 403 for non-creator", async () => {
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });

      const res = await makeRequest("DELETE", "/groups/g-1/invites/i-1");

      expect(res.status).toBe(403);
    });
  });

  describe("POST /invites/:token/accept", () => {
    it("accepts invite and joins user to group", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      // getInviteByToken — QueryCommand (token-index)
      mockSendFn.mockResolvedValueOnce({
        Items: [
          {
            invite_id: "i-1",
            group_id: "g-1",
            invite_token: "abc123",
            status: "pending",
            expires_at: futureDate,
          },
        ],
      });
      // getUserGroup — QueryCommand (user-groups-index) — no existing group
      mockSendFn.mockResolvedValueOnce({ Items: [] });
      // getGroup — GetCommand
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", name: "The Emersons", member_count: 1 },
      });
      // addMember — TransactWriteCommand
      mockSendFn.mockResolvedValueOnce({});

      const res = await makeRequest("POST", "/invites/abc123/accept");

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.group_id).toBe("g-1");
      expect(body.group_name).toBe("The Emersons");
      expect(body.role).toBe("member");
    });

    it("returns 410 for expired invite", async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();

      // getInviteByToken
      mockSendFn.mockResolvedValueOnce({
        Items: [
          {
            invite_id: "i-1",
            group_id: "g-1",
            invite_token: "expired-token",
            status: "pending",
            expires_at: pastDate,
          },
        ],
      });
      // validateInvite throws synchronously — no more mocks needed

      const res = await makeRequest("POST", "/invites/expired-token/accept");

      expect(res.status).toBe(410);
    });

    it("returns 409 if user already in a group", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      // getInviteByToken
      mockSendFn.mockResolvedValueOnce({
        Items: [
          {
            invite_id: "i-1",
            group_id: "g-1",
            invite_token: "abc123",
            status: "pending",
            expires_at: futureDate,
          },
        ],
      });
      // getUserGroup — user already in a group
      mockSendFn.mockResolvedValueOnce({
        Items: [{ group_id: "g-other", user_id: "user-123" }],
      });

      const res = await makeRequest("POST", "/invites/abc123/accept");

      expect(res.status).toBe(409);
    });

    it("returns 410 for revoked invite", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      // getInviteByToken — invite is revoked
      mockSendFn.mockResolvedValueOnce({
        Items: [
          {
            invite_id: "i-1",
            group_id: "g-1",
            invite_token: "revoked-token",
            status: "revoked",
            expires_at: futureDate,
          },
        ],
      });

      const res = await makeRequest("POST", "/invites/revoked-token/accept");

      expect(res.status).toBe(410);
    });

    it("returns 404 for non-existent invite token", async () => {
      // getInviteByToken — no results
      mockSendFn.mockResolvedValueOnce({ Items: [] });

      const res = await makeRequest("POST", "/invites/bogus-token/accept");

      expect(res.status).toBe(404);
    });

    it("returns 409 when group is full (8 members)", async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      // getInviteByToken
      mockSendFn.mockResolvedValueOnce({
        Items: [
          {
            invite_id: "i-1",
            group_id: "g-1",
            invite_token: "full-group-token",
            status: "pending",
            expires_at: futureDate,
          },
        ],
      });
      // getUserGroup — no existing group
      mockSendFn.mockResolvedValueOnce({ Items: [] });
      // getGroup
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", name: "Full Group", member_count: 8 },
      });
      // addMember — TransactWriteCommand fails (group full)
      const txError = new Error("Transaction cancelled");
      txError.name = "TransactionCanceledException";
      (txError as any).CancellationReasons = [
        { Code: "ConditionalCheckFailed" },
        { Code: "None" },
      ];
      mockSendFn.mockRejectedValueOnce(txError);

      const res = await makeRequest(
        "POST",
        "/invites/full-group-token/accept",
      );

      expect(res.status).toBe(409);
      const body = await res.json() as any;
      expect(body.error).toContain("full");
    });
  });
});
