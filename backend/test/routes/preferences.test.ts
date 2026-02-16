import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../../src/middleware/auth.js";
import { preferences } from "../../src/routes/preferences.js";

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
  app.route("/", preferences);
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

describe("Preference routes", () => {
  beforeEach(() => {
    mockSendFn.mockReset();
  });

  describe("GET /groups/:group_id/preferences", () => {
    it("returns empty preferences when none set", async () => {
      // requireMember — GetCommand (membership exists)
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // getPreferences — GetCommand (no item)
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("GET", "/groups/g-1/preferences");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user_id).toBe("user-123");
      expect(body.group_id).toBe("g-1");
      expect(body.genre_likes).toEqual([]);
      expect(body.genre_dislikes).toEqual([]);
      expect(body.max_content_rating).toBeNull();
      expect(body.updated_at).toBeNull();
    });

    it("returns existing preferences", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // getPreferences — has data
      mockSendFn.mockResolvedValueOnce({
        Item: {
          group_id: "g-1",
          user_id: "user-123",
          genre_likes: ["28", "35"],
          genre_dislikes: ["27"],
          max_content_rating: "PG-13",
          updated_at: "2026-02-14T00:00:00Z",
        },
      });

      const res = await makeRequest("GET", "/groups/g-1/preferences");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.genre_likes).toEqual(["28", "35"]);
      expect(body.genre_dislikes).toEqual(["27"]);
      expect(body.max_content_rating).toBe("PG-13");
    });

    it("returns 403 for non-member", async () => {
      // requireMember — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("GET", "/groups/g-1/preferences");

      expect(res.status).toBe(403);
    });
  });

  describe("GET /groups/:group_id/preferences/summary", () => {
    it("returns 200 with computed summary", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // QueryCommand — group preferences
      mockSendFn.mockResolvedValueOnce({
        Items: [
          {
            group_id: "g-1",
            user_id: "user-123",
            genre_likes: ["28", "35"],
            genre_dislikes: ["27"],
            max_content_rating: "PG-13",
            updated_at: "2026-02-14T00:00:00Z",
          },
          {
            group_id: "g-1",
            user_id: "user-456",
            genre_likes: ["35", "16"],
            genre_dislikes: ["27"],
            max_content_rating: "PG",
            updated_at: "2026-02-14T00:00:00Z",
          },
        ],
      });

      const res = await makeRequest("GET", "/groups/g-1/preferences/summary");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.liked_genres.sort()).toEqual(["16", "28", "35"]);
      expect(body.disliked_genres).toEqual(["27"]);
      expect(body.max_content_rating).toBe("PG");
      expect(body.member_count).toBe(2);
    });

    it("returns 403 for non-member", async () => {
      // requireMember — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("GET", "/groups/g-1/preferences/summary");

      expect(res.status).toBe(403);
    });

    it("returns 200 with empty result when no preferences set", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // QueryCommand — no items
      mockSendFn.mockResolvedValueOnce({ Items: [] });

      const res = await makeRequest("GET", "/groups/g-1/preferences/summary");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.liked_genres).toEqual([]);
      expect(body.disliked_genres).toEqual([]);
      expect(body.max_content_rating).toBeNull();
      expect(body.member_count).toBe(0);
    });
  });

  describe("PUT /groups/:group_id/preferences", () => {
    it("saves valid preferences and returns 200", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // PutCommand
      mockSendFn.mockResolvedValueOnce({});

      const res = await makeRequest("PUT", "/groups/g-1/preferences", {
        body: {
          genre_likes: ["28", "35", "16"],
          genre_dislikes: ["27"],
          max_content_rating: "PG-13",
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.group_id).toBe("g-1");
      expect(body.user_id).toBe("user-123");
      expect(body.genre_likes).toEqual(["28", "35", "16"]);
      expect(body.genre_dislikes).toEqual(["27"]);
      expect(body.max_content_rating).toBe("PG-13");
      expect(body.updated_at).toBeTruthy();
    });

    it("saves preferences without genre_dislikes (defaults to empty)", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // PutCommand
      mockSendFn.mockResolvedValueOnce({});

      const res = await makeRequest("PUT", "/groups/g-1/preferences", {
        body: {
          genre_likes: ["28", "35"],
          max_content_rating: "G",
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.genre_dislikes).toEqual([]);
    });

    it("returns 400 when genre_likes has fewer than 2 entries", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });

      const res = await makeRequest("PUT", "/groups/g-1/preferences", {
        body: {
          genre_likes: ["28"],
          max_content_rating: "PG",
        },
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when genre_likes is empty", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });

      const res = await makeRequest("PUT", "/groups/g-1/preferences", {
        body: {
          genre_likes: [],
          max_content_rating: "PG",
        },
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when genre_likes and genre_dislikes overlap", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });

      const res = await makeRequest("PUT", "/groups/g-1/preferences", {
        body: {
          genre_likes: ["28", "35"],
          genre_dislikes: ["28"],
          max_content_rating: "PG",
        },
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("overlap");
    });

    it("returns 400 for invalid content rating", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });

      const res = await makeRequest("PUT", "/groups/g-1/preferences", {
        body: {
          genre_likes: ["28", "35"],
          max_content_rating: "NC-17",
        },
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when max_content_rating is missing", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });

      const res = await makeRequest("PUT", "/groups/g-1/preferences", {
        body: {
          genre_likes: ["28", "35"],
        },
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when genre_likes has duplicates that reduce count below 2", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });

      const res = await makeRequest("PUT", "/groups/g-1/preferences", {
        body: {
          genre_likes: ["28", "28"],
          max_content_rating: "PG",
        },
      });

      expect(res.status).toBe(400);
    });

    it("deduplicates genre_likes and genre_dislikes before saving", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // PutCommand
      mockSendFn.mockResolvedValueOnce({});

      const res = await makeRequest("PUT", "/groups/g-1/preferences", {
        body: {
          genre_likes: ["28", "35", "28"],
          genre_dislikes: ["27", "27"],
          max_content_rating: "PG",
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.genre_likes).toEqual(["28", "35"]);
      expect(body.genre_dislikes).toEqual(["27"]);
    });

    it("returns 403 for non-member", async () => {
      // requireMember — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("PUT", "/groups/g-1/preferences", {
        body: {
          genre_likes: ["28", "35"],
          genre_dislikes: [],
          max_content_rating: "PG",
        },
      });

      expect(res.status).toBe(403);
    });

    it("accepts all four valid content ratings", async () => {
      for (const rating of ["G", "PG", "PG-13", "R"]) {
        mockSendFn.mockReset();
        // requireMember
        mockSendFn.mockResolvedValueOnce({
          Item: { group_id: "g-1", user_id: "user-123", role: "member" },
        });
        // PutCommand
        mockSendFn.mockResolvedValueOnce({});

        const res = await makeRequest("PUT", "/groups/g-1/preferences", {
          body: {
            genre_likes: ["28", "35"],
            max_content_rating: rating,
          },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.max_content_rating).toBe(rating);
      }
    });

    it("allows both member and creator roles to set preferences", async () => {
      // Creator sets preferences
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "creator" },
      });
      mockSendFn.mockResolvedValueOnce({});

      const res = await makeRequest("PUT", "/groups/g-1/preferences", {
        body: {
          genre_likes: ["28", "35"],
          max_content_rating: "R",
        },
      });

      expect(res.status).toBe(200);
    });
  });
});
