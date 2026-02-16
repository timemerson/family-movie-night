import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../../src/middleware/auth.js";
import { picks } from "../../src/routes/picks.js";

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

function createApp() {
  const app = new Hono();
  app.use("/*", authMiddleware());
  app.route("/", picks);
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

describe("Pick routes", () => {
  beforeEach(() => {
    mockSendFn.mockReset();
  });

  describe("POST /groups/:group_id/picks/:pick_id/watched", () => {
    it("returns 200 on success", async () => {
      // requireMember — membership exists
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // markWatched: GetCommand — pick exists
      mockSendFn.mockResolvedValueOnce({
        Item: {
          pick_id: "p-1",
          round_id: "r-1",
          group_id: "g-1",
          tmdb_movie_id: 550,
          picked_by: "user-123",
          picked_at: "2026-02-14T00:00:00Z",
          watched: false,
          watched_at: null,
        },
      });
      // markWatched: GetCommand — membership check
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // markWatched: UpdateCommand — returns updated pick
      mockSendFn.mockResolvedValueOnce({
        Attributes: {
          pick_id: "p-1",
          round_id: "r-1",
          group_id: "g-1",
          tmdb_movie_id: 550,
          picked_by: "user-123",
          picked_at: "2026-02-14T00:00:00Z",
          watched: true,
          watched_at: "2026-02-16T00:00:00Z",
        },
      });

      const res = await makeRequest(
        "POST",
        "/groups/g-1/picks/p-1/watched",
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.watched).toBe(true);
      expect(body.watched_at).toBeTruthy();
    });

    it("returns 403 for non-member", async () => {
      // requireMember — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest(
        "POST",
        "/groups/g-1/picks/p-1/watched",
      );

      expect(res.status).toBe(403);
    });

    it("returns 404 for pick not found", async () => {
      // requireMember — membership exists
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // markWatched: GetCommand — pick not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest(
        "POST",
        "/groups/g-1/picks/p-missing/watched",
      );

      expect(res.status).toBe(404);
    });
  });

  describe("GET /groups/:group_id/watched", () => {
    it("returns 200 with movie_ids array", async () => {
      // requireMember — membership exists
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // getWatchedMovieIds → getGroupPicks: QueryCommand
      mockSendFn.mockResolvedValueOnce({
        Items: [
          {
            pick_id: "p-1",
            group_id: "g-1",
            tmdb_movie_id: 550,
            watched: true,
            watched_at: "2026-02-15T00:00:00Z",
          },
          {
            pick_id: "p-2",
            group_id: "g-1",
            tmdb_movie_id: 680,
            watched: false,
            watched_at: null,
          },
        ],
      });

      const res = await makeRequest("GET", "/groups/g-1/watched");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.movie_ids).toEqual([550]);
    });

    it("returns 403 for non-member", async () => {
      // requireMember — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("GET", "/groups/g-1/watched");

      expect(res.status).toBe(403);
    });
  });
});
