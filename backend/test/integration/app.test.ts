import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../../src/index.js";
import { HttpError } from "../../src/lib/errors.js";

// Mock the dynamo module
vi.mock("../../src/lib/dynamo.js", () => {
  const mockSend = vi.fn();
  return {
    getDocClient: () => ({ send: mockSend }),
    tableName: (key: string) => `test-${key}`,
    __mockSend: mockSend,
  };
});

import { __mockSend as mockSend } from "../../src/lib/dynamo.js";
const mockSendFn = mockSend as unknown as ReturnType<typeof vi.fn>;

function authedRequest(method: string, path: string) {
  const event = {
    requestContext: {
      authorizer: {
        jwt: {
          claims: { sub: "user-123", email: "test@example.com" },
        },
      },
    },
  };
  return app.request(path, { method }, { event });
}

function unauthRequest(method: string, path: string) {
  return app.request(path, { method }, { event: {} });
}

describe("App integration", () => {
  beforeEach(() => {
    mockSendFn.mockReset();
  });

  describe("GET /health", () => {
    it("returns 200 without authentication", async () => {
      const res = await unauthRequest("GET", "/health");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ok");
    });
  });

  describe("Protected routes reject unauthenticated requests", () => {
    it("GET /users/me returns 401 without auth", async () => {
      const res = await unauthRequest("GET", "/users/me");
      expect(res.status).toBe(401);
    });

    it("DELETE /users/me returns 401 without auth", async () => {
      const res = await unauthRequest("DELETE", "/users/me");
      expect(res.status).toBe(401);
    });
  });

  describe("Protected routes work with valid auth", () => {
    it("GET /users/me returns user with valid auth", async () => {
      const user = {
        user_id: "user-123",
        email: "test@example.com",
        display_name: "test",
        avatar_key: "avatar_bear",
        created_at: "2026-01-01T00:00:00Z",
        notification_prefs: { vote_nudge: true, pick_announce: true, new_round: true },
      };
      mockSendFn.mockResolvedValueOnce({ Item: user });

      const res = await authedRequest("GET", "/users/me");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user_id).toBe("user-123");
    });
  });

  describe("Global error handler", () => {
    it("returns structured error for HttpError", async () => {
      // Trigger a request that will exercise the error handler
      // by causing the DynamoDB mock to throw an HttpError
      mockSendFn.mockRejectedValueOnce(new HttpError(400, "Bad request"));

      const res = await authedRequest("GET", "/users/me");
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Bad request");
    });

    it("returns 500 for unexpected errors", async () => {
      mockSendFn.mockRejectedValueOnce(new Error("DynamoDB exploded"));

      const res = await authedRequest("GET", "/users/me");
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Internal server error");
    });
  });
});
