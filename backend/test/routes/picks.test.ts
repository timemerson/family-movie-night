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

function mockTmdbSuccess() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => tmdbDetailResponse,
  });
}

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
    mockFetch.mockReset();
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
      const body = await res.json() as any;
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

  describe("POST /groups/:group_id/watched", () => {
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
      // markDirectlyWatched: check direct watched — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });
      // markDirectlyWatched: check pick watched — no picks
      mockSendFn.mockResolvedValueOnce({ Items: [] });
      // markDirectlyWatched: PutCommand
      mockSendFn.mockResolvedValueOnce({});
      // removeFromWatchlistIfPresent: isOnWatchlist — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("POST", "/groups/g-1/watched", {
        body: { tmdb_movie_id: 550 },
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.tmdb_movie_id).toBe(550);
      expect(body.title).toBe("Fight Club");
      expect(body.source).toBe("direct");
      expect(body.marked_by).toBe("user-123");
    });

    it("returns 409 when already watched", async () => {
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
      // markDirectlyWatched: check direct watched — found
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", tmdb_movie_id: 550 },
      });

      const res = await makeRequest("POST", "/groups/g-1/watched", {
        body: { tmdb_movie_id: 550 },
      });

      expect(res.status).toBe(409);
    });

    it("returns 403 for non-member", async () => {
      // requireMember — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("POST", "/groups/g-1/watched", {
        body: { tmdb_movie_id: 550 },
      });

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /groups/:group_id/watched/:tmdb_movie_id", () => {
    it("returns 204 within 24h", async () => {
      const recentTime = new Date(Date.now() - 1000 * 60 * 60).toISOString();
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // GetCommand — directly watched item
      mockSendFn.mockResolvedValueOnce({
        Item: {
          group_id: "g-1",
          tmdb_movie_id: 550,
          marked_by: "user-123",
          watched_at: recentTime,
          source: "direct",
        },
      });
      // DeleteCommand
      mockSendFn.mockResolvedValueOnce({});

      const res = await makeRequest("DELETE", "/groups/g-1/watched/550");

      expect(res.status).toBe(204);
    });

    it("returns 400 when undo window expired", async () => {
      const oldTime = new Date(
        Date.now() - 25 * 60 * 60 * 1000,
      ).toISOString();
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // GetCommand — directly watched item (old)
      mockSendFn.mockResolvedValueOnce({
        Item: {
          group_id: "g-1",
          tmdb_movie_id: 550,
          marked_by: "user-123",
          watched_at: oldTime,
          source: "direct",
        },
      });

      const res = await makeRequest("DELETE", "/groups/g-1/watched/550");

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe("Undo window expired");
    });

    it("returns 403 for wrong user", async () => {
      const recentTime = new Date(Date.now() - 1000 * 60 * 60).toISOString();
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // GetCommand — directly watched by someone else
      mockSendFn.mockResolvedValueOnce({
        Item: {
          group_id: "g-1",
          tmdb_movie_id: 550,
          marked_by: "user-other",
          watched_at: recentTime,
          source: "direct",
        },
      });

      const res = await makeRequest("DELETE", "/groups/g-1/watched/550");

      expect(res.status).toBe(403);
    });

    it("returns 400 for picked movie", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // GetCommand — not in WatchedMovies
      mockSendFn.mockResolvedValueOnce({ Item: undefined });
      // QueryCommand — found in picks
      mockSendFn.mockResolvedValueOnce({
        Items: [{ tmdb_movie_id: 550, watched: true }],
      });

      const res = await makeRequest("DELETE", "/groups/g-1/watched/550");

      expect(res.status).toBe(400);
    });
  });

  describe("GET /groups/:group_id/watched", () => {
    it("returns 200 with combined watched list", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // getDirectlyWatchedMovies — QueryCommand
      mockSendFn.mockResolvedValueOnce({
        Items: [
          {
            group_id: "g-1",
            tmdb_movie_id: 550,
            marked_by: "user-123",
            watched_at: "2026-02-16T00:00:00Z",
            title: "Fight Club",
            poster_path: "/pB8...",
            year: 1999,
            source: "direct",
          },
        ],
      });
      // Pick-watched — QueryCommand
      mockSendFn.mockResolvedValueOnce({
        Items: [
          {
            pick_id: "p-1",
            group_id: "g-1",
            tmdb_movie_id: 680,
            picked_by: "user-456",
            watched: true,
            watched_at: "2026-02-14T00:00:00Z",
            title: "Pulp Fiction",
            poster_path: "/d5i...",
          },
        ],
      });

      const res = await makeRequest("GET", "/groups/g-1/watched");

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.watched_movies).toHaveLength(2);
      expect(body.watched_movies[0].source).toBe("direct");
      expect(body.watched_movies[1].source).toBe("picked");
    });

    it("returns 200 with empty list", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // getDirectlyWatchedMovies — empty
      mockSendFn.mockResolvedValueOnce({ Items: undefined });
      // Pick-watched — empty
      mockSendFn.mockResolvedValueOnce({ Items: undefined });

      const res = await makeRequest("GET", "/groups/g-1/watched");

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.watched_movies).toEqual([]);
    });

    it("returns 403 for non-member", async () => {
      // requireMember — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("GET", "/groups/g-1/watched");

      expect(res.status).toBe(403);
    });
  });
});
