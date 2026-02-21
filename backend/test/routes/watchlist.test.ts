import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../../src/middleware/auth.js";
import { watchlist } from "../../src/routes/watchlist.js";

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

const tmdbDetailResponse = {
  id: 550,
  title: "Fight Club",
  release_date: "1999-10-15",
  poster_path: "/pB8...",
  overview: "A ticking-time-bomb insomniac...",
  runtime: 139,
  genres: [
    { id: 18, name: "Drama" },
    { id: 53, name: "Thriller" },
  ],
  popularity: 61.4,
  vote_average: 8.4,
  credits: { cast: [] },
  videos: { results: [] },
  release_dates: {
    results: [
      {
        iso_3166_1: "US",
        release_dates: [{ certification: "R" }],
      },
    ],
  },
};

function createApp() {
  const app = new Hono();
  app.use("/*", authMiddleware());
  app.route("/", watchlist);
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

// Helper to set up mockFetch to return TMDB detail
function mockTmdbSuccess() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => tmdbDetailResponse,
  });
}

function mockTmdbNotFound() {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 404,
  });
}

describe("Watchlist routes", () => {
  beforeEach(() => {
    mockSendFn.mockReset();
    mockFetch.mockReset();
  });

  describe("POST /groups/:id/watchlist", () => {
    const validBody = {
      tmdb_movie_id: 550,
    };

    it("returns 201 on success", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // TMDB cache lookup — miss
      mockSendFn.mockResolvedValueOnce({ Item: undefined });
      // TMDB fetch
      mockTmdbSuccess();
      // TMDB cache write
      mockSendFn.mockResolvedValueOnce({});
      // Check direct watched — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });
      // Check pick watched — no watched picks
      mockSendFn.mockResolvedValueOnce({ Items: [] });
      // getWatchlistCount — count 0
      mockSendFn.mockResolvedValueOnce({ Count: 0 });
      // Conditional PutCommand
      mockSendFn.mockResolvedValueOnce({});

      const res = await makeRequest("POST", "/groups/g-1/watchlist", {
        body: validBody,
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.tmdb_movie_id).toBe(550);
      expect(body.title).toBe("Fight Club");
      expect(body.added_by).toBe("user-123");
      expect(body.added_at).toBeTruthy();
    });

    it("returns 404 when TMDB movie not found", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // TMDB cache lookup — miss
      mockSendFn.mockResolvedValueOnce({ Item: undefined });
      // TMDB fetch — 404
      mockTmdbNotFound();

      const res = await makeRequest("POST", "/groups/g-1/watchlist", {
        body: validBody,
      });

      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.error).toBe("Movie not found on TMDB");
    });

    it("returns 409 for duplicate", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // TMDB cache lookup — miss
      mockSendFn.mockResolvedValueOnce({ Item: undefined });
      // TMDB fetch
      mockTmdbSuccess();
      // TMDB cache write
      mockSendFn.mockResolvedValueOnce({});
      // Check direct watched — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });
      // Check pick watched — no watched picks
      mockSendFn.mockResolvedValueOnce({ Items: [] });
      // getWatchlistCount — count 0
      mockSendFn.mockResolvedValueOnce({ Count: 0 });
      // Conditional PutCommand — ConditionalCheckFailedException (duplicate)
      const conditionError = new Error("Conditional check failed");
      (conditionError as any).name = "ConditionalCheckFailedException";
      mockSendFn.mockRejectedValueOnce(conditionError);

      const res = await makeRequest("POST", "/groups/g-1/watchlist", {
        body: validBody,
      });

      expect(res.status).toBe(409);
      const body = (await res.json()) as any;
      expect(body.error).toBe("Already on Watchlist");
    });

    it("returns 400 when already watched", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // TMDB cache lookup — miss
      mockSendFn.mockResolvedValueOnce({ Item: undefined });
      // TMDB fetch
      mockTmdbSuccess();
      // TMDB cache write
      mockSendFn.mockResolvedValueOnce({});
      // Check direct watched — found
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", tmdb_movie_id: 550 },
      });

      const res = await makeRequest("POST", "/groups/g-1/watchlist", {
        body: validBody,
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe("Already watched");
    });

    it("returns 400 when watchlist is full", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // TMDB cache lookup — miss
      mockSendFn.mockResolvedValueOnce({ Item: undefined });
      // TMDB fetch
      mockTmdbSuccess();
      // TMDB cache write
      mockSendFn.mockResolvedValueOnce({});
      // Check direct watched — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });
      // Check pick watched — no watched picks
      mockSendFn.mockResolvedValueOnce({ Items: [] });
      // getWatchlistCount — count 50
      mockSendFn.mockResolvedValueOnce({ Count: 50 });

      const res = await makeRequest("POST", "/groups/g-1/watchlist", {
        body: validBody,
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe("Watchlist is full");
    });

    it("returns 400 for missing required fields", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });

      const res = await makeRequest("POST", "/groups/g-1/watchlist", {
        body: { title: "Fight Club" },
      });

      expect(res.status).toBe(400);
    });

    it("returns 403 for non-member", async () => {
      // requireMember — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("POST", "/groups/g-1/watchlist", {
        body: validBody,
      });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /groups/:id/watchlist", () => {
    it("returns 200 with items, count, and max", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // getWatchlist — QueryCommand
      mockSendFn.mockResolvedValueOnce({
        Items: [
          {
            group_id: "g-1",
            tmdb_movie_id: 550,
            added_at: "2026-02-16T00:00:00Z",
            title: "Fight Club",
          },
          {
            group_id: "g-1",
            tmdb_movie_id: 680,
            added_at: "2026-02-14T00:00:00Z",
            title: "Pulp Fiction",
          },
        ],
      });

      const res = await makeRequest("GET", "/groups/g-1/watchlist");

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.items).toHaveLength(2);
      expect(body.count).toBe(2);
      expect(body.max).toBe(50);
      // Sorted reverse chronologically
      expect(body.items[0].tmdb_movie_id).toBe(550);
    });

    it("returns 200 with empty array", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // getWatchlist — empty
      mockSendFn.mockResolvedValueOnce({ Items: undefined });

      const res = await makeRequest("GET", "/groups/g-1/watchlist");

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.items).toEqual([]);
      expect(body.count).toBe(0);
    });

    it("returns 403 for non-member", async () => {
      // requireMember — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("GET", "/groups/g-1/watchlist");

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /groups/:id/watchlist/:mid", () => {
    it("returns 204 when removed by adder", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // GetCommand — watchlist item exists, added by user
      mockSendFn.mockResolvedValueOnce({
        Item: {
          group_id: "g-1",
          tmdb_movie_id: 550,
          added_by: "user-123",
        },
      });
      // DeleteCommand
      mockSendFn.mockResolvedValueOnce({});

      const res = await makeRequest("DELETE", "/groups/g-1/watchlist/550");

      expect(res.status).toBe(204);
    });

    it("returns 204 when removed by creator", async () => {
      // requireMember — user is creator
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "creator" },
      });
      // GetCommand — watchlist item exists, added by other user
      mockSendFn.mockResolvedValueOnce({
        Item: {
          group_id: "g-1",
          tmdb_movie_id: 550,
          added_by: "user-other",
        },
      });
      // DeleteCommand
      mockSendFn.mockResolvedValueOnce({});

      const res = await makeRequest("DELETE", "/groups/g-1/watchlist/550");

      expect(res.status).toBe(204);
    });

    it("returns 403 when other member tries to remove", async () => {
      // requireMember — user is member (not creator)
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // GetCommand — watchlist item exists, added by other user
      mockSendFn.mockResolvedValueOnce({
        Item: {
          group_id: "g-1",
          tmdb_movie_id: 550,
          added_by: "user-other",
        },
      });

      const res = await makeRequest("DELETE", "/groups/g-1/watchlist/550");

      expect(res.status).toBe(403);
    });

    it("returns 404 when movie not on watchlist", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // GetCommand — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("DELETE", "/groups/g-1/watchlist/550");

      expect(res.status).toBe(404);
    });
  });
});
