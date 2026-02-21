import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../../src/middleware/auth.js";
import { rounds } from "../../src/routes/rounds.js";

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

// Mock fetch for TMDB API
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createApp() {
  const app = new Hono();
  app.use("/*", authMiddleware());
  app.route("/", rounds);
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

// Standard mock sequences
function mockMemberCheck(role = "member") {
  // requireMember — GetCommand on memberships
  mockSendFn.mockResolvedValueOnce({
    Item: { group_id: "g-1", user_id: "user-123", role },
  });
}

function mockGroupGet() {
  // getGroup — GetCommand on groups
  mockSendFn.mockResolvedValueOnce({
    Item: { group_id: "g-1", name: "Test Group", streaming_services: [] },
  });
}

// TMDB discover mock
function mockTmdbDiscover() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      page: 1,
      total_results: 2,
      results: [
        {
          id: 550,
          title: "Fight Club",
          overview: "A ticking-time-bomb...",
          poster_path: "/pB8...",
          release_date: "1999-10-15",
          genre_ids: [18, 53],
          popularity: 61.4,
          vote_average: 8.4,
          vote_count: 25000,
        },
        {
          id: 680,
          title: "Pulp Fiction",
          overview: "A burger-loving hitman...",
          poster_path: "/d5i...",
          release_date: "1994-10-14",
          genre_ids: [80, 53],
          popularity: 55.0,
          vote_average: 8.5,
          vote_count: 22000,
        },
      ],
    }),
  });
}

// TMDB watch providers mock (per movie)
function mockTmdbProviders(count = 2) {
  for (let i = 0; i < count; i++) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: {} }),
    });
  }
}

describe("Rounds routes", () => {
  beforeEach(() => {
    mockSendFn.mockReset();
    mockFetch.mockReset();
  });

  describe("POST /groups/:id/rounds", () => {
    it("returns 201 on successful round creation", async () => {
      // Use mockImplementation to handle the many DynamoDB calls dynamically
      let sendCallIndex = 0;
      const sendResponses: Record<number, any> = {
        0: { Item: { group_id: "g-1", user_id: "user-123", role: "member" } }, // requireMember
        1: { Item: { group_id: "g-1", name: "Test Group", streaming_services: [] } }, // getGroup
        2: { Items: [] }, // getActiveRound GSI
        3: { Items: [ // getGroupPreferenceSummary
          { user_id: "u1", genre_likes: ["28"], genre_dislikes: [], max_content_rating: "PG-13" },
          { user_id: "u2", genre_likes: ["35"], genre_dislikes: [], max_content_rating: "PG-13" },
        ]},
        4: { Items: [] }, // WatchedService: getDirectlyWatchedMovies
        5: { Items: [] }, // WatchedService: getGroupPicks
      };
      // All remaining DynamoDB calls (cache gets, cache sets, round put, suggestion puts) return defaults
      mockSendFn.mockImplementation(() => {
        const idx = sendCallIndex++;
        if (sendResponses[idx]) return Promise.resolve(sendResponses[idx]);
        // Default: cache miss for GetCommand, empty success for PutCommand/QueryCommand
        return Promise.resolve({ Item: undefined, Items: [] });
      });

      // TMDB fetch calls: discover (3+ movies to avoid relaxation), then watch providers per movie
      const tmdbMovies = [
        { id: 550, title: "Fight Club", overview: "...", poster_path: "/pB8...", release_date: "1999-10-15", genre_ids: [18, 53], popularity: 61.4, vote_average: 8.4, vote_count: 25000 },
        { id: 680, title: "Pulp Fiction", overview: "...", poster_path: "/d5i...", release_date: "1994-10-14", genre_ids: [80, 53], popularity: 55.0, vote_average: 8.5, vote_count: 22000 },
        { id: 120, title: "LOTR", overview: "...", poster_path: "/lotr...", release_date: "2001-12-19", genre_ids: [28, 14], popularity: 70.0, vote_average: 8.8, vote_count: 20000 },
      ];
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ page: 1, total_results: 3, results: tmdbMovies }),
        })
        // watch providers for 3 movies
        .mockResolvedValue({ ok: true, json: async () => ({ results: {} }) });

      const res = await makeRequest("POST", "/groups/g-1/rounds");

      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.round_id).toBeTruthy();
      expect(body.status).toBe("voting");
      expect(body.suggestions.length).toBeGreaterThan(0);
    });

    it("returns 409 when active round exists", async () => {
      mockMemberCheck();
      mockGroupGet();
      // getActiveRound — returns an active round
      mockSendFn.mockResolvedValueOnce({
        Items: [{ round_id: "r-existing", group_id: "g-1", status: "voting" }],
      });

      const res = await makeRequest("POST", "/groups/g-1/rounds");

      expect(res.status).toBe(409);
      const body = await res.json() as any;
      expect(body.error).toContain("active round already exists");
      expect(body.active_round_id).toBe("r-existing");
    });

    it("returns 422 when insufficient preferences", async () => {
      mockMemberCheck();
      mockGroupGet();
      // getActiveRound — no active
      mockSendFn.mockResolvedValueOnce({ Items: [] });
      // getGroupPreferenceSummary — only 1 member with prefs
      mockSendFn.mockResolvedValueOnce({
        Items: [
          { user_id: "u1", genre_likes: ["28"], genre_dislikes: [], max_content_rating: "PG-13" },
        ],
      });

      const res = await makeRequest("POST", "/groups/g-1/rounds");

      expect(res.status).toBe(422);
      const body = await res.json() as any;
      expect(body.error).toContain("2 members");
    });

    it("returns 403 for non-member", async () => {
      // requireMember — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("POST", "/groups/g-1/rounds");

      expect(res.status).toBe(403);
    });
  });

  describe("GET /rounds/:id", () => {
    it("returns 200 with round details", async () => {
      // getRound — GetCommand for round
      mockSendFn.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
          started_by: "user-123",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      // QueryCommand for suggestions
      mockSendFn.mockResolvedValueOnce({
        Items: [
          {
            round_id: "r-1",
            tmdb_movie_id: 550,
            title: "Fight Club",
            year: 1999,
            poster_path: "/pB8...",
            genres: ["Drama"],
            content_rating: "R",
            overview: "A ticking-time-bomb...",
            source: "algorithm",
            streaming: [],
            score: 0.85,
            reason: "Matches your taste.",
            popularity: 61.4,
            vote_average: 8.4,
          },
        ],
      });
      // QueryCommand for votes
      mockSendFn.mockResolvedValueOnce({
        Items: [
          {
            round_id: "r-1",
            vote_key: "550#user-123",
            tmdb_movie_id: 550,
            user_id: "user-123",
            vote: "up",
            voted_at: "2026-02-21T20:15:00Z",
          },
        ],
      });
      // getMembers — QueryCommand on memberships
      mockSendFn.mockResolvedValueOnce({
        Items: [
          { user_id: "user-123", display_name: "Alice", role: "creator" },
          { user_id: "user-456", display_name: "Bob", role: "member" },
        ],
      });
      // requireMember check for auth
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "creator" },
      });

      const res = await makeRequest("GET", "/rounds/r-1");

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.round_id).toBe("r-1");
      expect(body.suggestions).toHaveLength(1);
      expect(body.suggestions[0].votes).toEqual({ up: 1, down: 0 });
      expect(body.vote_progress).toEqual({ voted: 1, total: 2 });
    });

    it("returns 404 for unknown round", async () => {
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("GET", "/rounds/r-nonexistent");

      expect(res.status).toBe(404);
    });

    it("returns 403 for non-member of round's group", async () => {
      // GetCommand for round
      mockSendFn.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      // Suggestions
      mockSendFn.mockResolvedValueOnce({ Items: [] });
      // Votes
      mockSendFn.mockResolvedValueOnce({ Items: [] });
      // Members
      mockSendFn.mockResolvedValueOnce({ Items: [] });
      // requireMember — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("GET", "/rounds/r-1");

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /rounds/:id", () => {
    it("returns 200 on successful close", async () => {
      // getRoundBasic
      mockSendFn.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
          started_by: "user-123",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      // requireMember — creator
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "creator" },
      });
      // UpdateCommand
      mockSendFn.mockResolvedValueOnce({
        Attributes: {
          round_id: "r-1",
          group_id: "g-1",
          status: "closed",
          closed_at: "2026-02-21T21:00:00Z",
        },
      });

      const res = await makeRequest("PATCH", "/rounds/r-1", {
        body: { status: "closed" },
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.status).toBe("closed");
    });

    it("returns 403 for non-creator", async () => {
      // getRoundBasic
      mockSendFn.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      // requireMember — member (not creator)
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });

      const res = await makeRequest("PATCH", "/rounds/r-1", {
        body: { status: "closed" },
      });

      expect(res.status).toBe(403);
    });

    it("returns 409 when round is not in voting status", async () => {
      // getRoundBasic — already closed
      mockSendFn.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "closed",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      // requireMember — creator
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "creator" },
      });

      const res = await makeRequest("PATCH", "/rounds/r-1", {
        body: { status: "closed" },
      });

      expect(res.status).toBe(409);
    });
  });

  describe("POST /rounds/:id/pick", () => {
    it("returns 201 on successful pick", async () => {
      // getRoundBasic (from route handler)
      mockSendFn.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
          started_by: "user-123",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      // requireMember (from route handler)
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "creator" },
      });
      // getRoundBasic (from pickMovie)
      mockSendFn.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
          started_by: "user-123",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      // requireMember (from pickMovie)
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "creator" },
      });
      // GetCommand for suggestion
      mockSendFn.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          tmdb_movie_id: 550,
          title: "Fight Club",
          poster_path: "/pB8...",
        },
      });
      // QueryCommand for round-pick-index (createPickForRound)
      mockSendFn.mockResolvedValueOnce({ Items: [] });
      // PutCommand for pick (createPickForRound)
      mockSendFn.mockResolvedValueOnce({});
      // UpdateCommand for round status
      mockSendFn.mockResolvedValueOnce({});

      const res = await makeRequest("POST", "/rounds/r-1/pick", {
        body: { tmdb_movie_id: 550 },
      });

      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.tmdb_movie_id).toBe(550);
      expect(body.picked_by).toBe("user-123");
      expect(body.round_id).toBe("r-1");
      expect(body.group_id).toBe("g-1");
      expect(body.watched).toBe(false);
    });

    it("returns 403 for non-creator", async () => {
      // getRoundBasic (from route handler)
      mockSendFn.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      // requireMember (from route handler)
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // getRoundBasic (from pickMovie)
      mockSendFn.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      // requireMember (from pickMovie) — member
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });

      const res = await makeRequest("POST", "/rounds/r-1/pick", {
        body: { tmdb_movie_id: 550 },
      });

      expect(res.status).toBe(403);
    });

    it("returns 409 when pick already exists for round", async () => {
      // getRoundBasic (route)
      mockSendFn.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
          started_by: "user-123",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      // requireMember (route)
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "creator" },
      });
      // getRoundBasic (pickMovie)
      mockSendFn.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
          started_by: "user-123",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      // requireMember (pickMovie)
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "creator" },
      });
      // GetCommand for suggestion
      mockSendFn.mockResolvedValueOnce({
        Item: { round_id: "r-1", tmdb_movie_id: 550, title: "Fight Club", poster_path: null },
      });
      // QueryCommand for round-pick-index — already has a pick
      mockSendFn.mockResolvedValueOnce({
        Items: [{ pick_id: "p-existing", round_id: "r-1" }],
      });

      const res = await makeRequest("POST", "/rounds/r-1/pick", {
        body: { tmdb_movie_id: 550 },
      });

      expect(res.status).toBe(409);
    });

    it("returns 400 for missing tmdb_movie_id", async () => {
      const res = await makeRequest("POST", "/rounds/r-1/pick", {
        body: {},
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 when round not found", async () => {
      // getRoundBasic — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("POST", "/rounds/r-1/pick", {
        body: { tmdb_movie_id: 550 },
      });

      expect(res.status).toBe(400);
    });
  });
});
