import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../../src/middleware/auth.js";
import { users } from "../../src/routes/users.js";

// Mock the dynamo module
vi.mock("../../src/lib/dynamo.js", () => {
  const mockSend = vi.fn();
  return {
    getDocClient: () => ({ send: mockSend }),
    tableName: (key: string) => `test-${key}`,
    __mockSend: mockSend,
  };
});

// Get the mocked send function
import { __mockSend as mockSend } from "../../src/lib/dynamo.js";
const mockSendFn = mockSend as unknown as ReturnType<typeof vi.fn>;

function createApp() {
  const app = new Hono();
  app.use("/*", authMiddleware());
  app.route("/", users);
  return app;
}

function makeRequest(method: string, path: string) {
  const app = createApp();
  const event = {
    requestContext: {
      authorizer: {
        jwt: {
          claims: {
            sub: "user-123",
            email: "test@example.com",
          },
        },
      },
    },
  };
  return app.request(path, { method }, { event });
}

describe("User routes", () => {
  beforeEach(() => {
    mockSendFn.mockReset();
  });

  describe("GET /users/me", () => {
    it("returns existing user", async () => {
      const existingUser = {
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
      mockSendFn.mockResolvedValueOnce({ Item: existingUser });

      const res = await makeRequest("GET", "/users/me");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.user_id).toBe("user-123");
      expect(body.email).toBe("test@example.com");
    });

    it("creates user via JIT provisioning if not found", async () => {
      mockSendFn.mockResolvedValueOnce({ Item: undefined }); // GetCommand
      mockSendFn.mockResolvedValueOnce({}); // PutCommand

      const res = await makeRequest("GET", "/users/me");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.user_id).toBe("user-123");
      expect(body.email).toBe("test@example.com");
      expect(body.display_name).toBe("test");
    });
  });

  describe("DELETE /users/me", () => {
    it("deletes user and returns 204", async () => {
      mockSendFn.mockResolvedValueOnce({}); // DeleteCommand

      const res = await makeRequest("DELETE", "/users/me");
      expect(res.status).toBe(204);
    });
  });
});
