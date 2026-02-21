import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../../src/middleware/auth.js";
import { votes } from "../../src/routes/votes.js";

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
  app.route("/", votes);
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

describe("Votes routes", () => {
  beforeEach(() => {
    mockSendFn.mockReset();
  });

  describe("POST /rounds/:id/votes", () => {
    it("returns 200 on successful vote", async () => {
      // GetCommand for round
      mockSendFn.mockResolvedValueOnce({
        Item: { round_id: "r-1", group_id: "g-1", status: "voting" },
      });
      // GetCommand for membership
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // GetCommand for suggestion
      mockSendFn.mockResolvedValueOnce({
        Item: { round_id: "r-1", tmdb_movie_id: 550, title: "Fight Club" },
      });
      // PutCommand for vote
      mockSendFn.mockResolvedValueOnce({});

      const res = await makeRequest("POST", "/rounds/r-1/votes", {
        body: { tmdb_movie_id: 550, vote: "up" },
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.round_id).toBe("r-1");
      expect(body.tmdb_movie_id).toBe(550);
      expect(body.vote).toBe("up");
    });

    it("returns 200 when changing vote", async () => {
      mockSendFn.mockResolvedValueOnce({
        Item: { round_id: "r-1", group_id: "g-1", status: "voting" },
      });
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      mockSendFn.mockResolvedValueOnce({
        Item: { round_id: "r-1", tmdb_movie_id: 550 },
      });
      mockSendFn.mockResolvedValueOnce({});

      const res = await makeRequest("POST", "/rounds/r-1/votes", {
        body: { tmdb_movie_id: 550, vote: "down" },
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.vote).toBe("down");
    });

    it("returns 400 for invalid vote value", async () => {
      const res = await makeRequest("POST", "/rounds/r-1/votes", {
        body: { tmdb_movie_id: 550, vote: "maybe" },
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when round is not voting", async () => {
      mockSendFn.mockResolvedValueOnce({
        Item: { round_id: "r-1", group_id: "g-1", status: "closed" },
      });

      const res = await makeRequest("POST", "/rounds/r-1/votes", {
        body: { tmdb_movie_id: 550, vote: "up" },
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when movie not in round", async () => {
      mockSendFn.mockResolvedValueOnce({
        Item: { round_id: "r-1", group_id: "g-1", status: "voting" },
      });
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("POST", "/rounds/r-1/votes", {
        body: { tmdb_movie_id: 999, vote: "up" },
      });

      expect(res.status).toBe(400);
    });

    it("returns 403 for non-member", async () => {
      mockSendFn.mockResolvedValueOnce({
        Item: { round_id: "r-1", group_id: "g-1", status: "voting" },
      });
      // Not a member
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("POST", "/rounds/r-1/votes", {
        body: { tmdb_movie_id: 550, vote: "up" },
      });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /rounds/:id/results", () => {
    it("returns 200 with ranked results", async () => {
      // GetCommand for round
      mockSendFn.mockResolvedValueOnce({
        Item: { round_id: "r-1", group_id: "g-1", status: "voting" },
      });
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // getMembers
      mockSendFn.mockResolvedValueOnce({
        Items: [
          { user_id: "user-123", display_name: "Alice", role: "creator" },
          { user_id: "user-456", display_name: "Bob", role: "member" },
        ],
      });
      // Suggestions query (for getRoundResults)
      mockSendFn.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", tmdb_movie_id: 550, title: "Fight Club", poster_path: "/pB8...", source: "algorithm", popularity: 61.4 },
        ],
      });
      // Votes query (for getRoundResults)
      mockSendFn.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", vote_key: "550#user-123", tmdb_movie_id: 550, user_id: "user-123", vote: "up" },
        ],
      });
      // Votes query again (for getVoteProgress)
      mockSendFn.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", vote_key: "550#user-123", user_id: "user-123", tmdb_movie_id: 550, vote: "up" },
        ],
      });
      // Members query (for getVoteProgress)
      mockSendFn.mockResolvedValueOnce({
        Items: [{ user_id: "user-123" }, { user_id: "user-456" }],
      });

      const res = await makeRequest("GET", "/rounds/r-1/results");

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.round_id).toBe("r-1");
      expect(body.results).toHaveLength(1);
      expect(body.results[0].net_score).toBe(1);
      expect(body.results[0].rank).toBe(1);
      expect(body.vote_progress).toEqual({ voted: 1, total: 2 });
    });

    it("returns 403 for non-member", async () => {
      mockSendFn.mockResolvedValueOnce({
        Item: { round_id: "r-1", group_id: "g-1", status: "voting" },
      });
      // requireMember — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("GET", "/rounds/r-1/results");

      expect(res.status).toBe(403);
    });

    it("returns 200 with ties flagged", async () => {
      mockSendFn.mockResolvedValueOnce({
        Item: { round_id: "r-1", group_id: "g-1", status: "voting" },
      });
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      mockSendFn.mockResolvedValueOnce({
        Items: [{ user_id: "user-123", display_name: "Alice" }],
      });
      // Two suggestions with same popularity
      mockSendFn.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", tmdb_movie_id: 550, title: "Movie A", poster_path: null, source: "algorithm", popularity: 50.0 },
          { round_id: "r-1", tmdb_movie_id: 680, title: "Movie B", poster_path: null, source: "algorithm", popularity: 50.0 },
        ],
      });
      // No votes
      mockSendFn.mockResolvedValueOnce({ Items: [] });
      // getVoteProgress votes + members
      mockSendFn.mockResolvedValueOnce({ Items: [] });
      mockSendFn.mockResolvedValueOnce({ Items: [{ user_id: "user-123" }] });

      const res = await makeRequest("GET", "/rounds/r-1/results");

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.results[0].tied).toBe(true);
      expect(body.results[1].tied).toBe(true);
    });
  });
});
