import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../../src/middleware/auth.js";
import { movies } from "../../src/routes/movies.js";

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
  app.route("/", movies);
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
  credits: {
    cast: [
      { name: "Brad Pitt", character: "Tyler Durden" },
      { name: "Edward Norton", character: "The Narrator" },
    ],
  },
  videos: {
    results: [
      { type: "Trailer", site: "YouTube", key: "SUXWAEX2jlg" },
    ],
  },
  release_dates: {
    results: [
      {
        iso_3166_1: "US",
        release_dates: [{ certification: "R" }],
      },
    ],
  },
};

const watchProvidersResponse = {
  results: {
    US: {
      flatrate: [
        { provider_name: "Hulu", logo_path: "/hulu.png" },
      ],
    },
  },
};

describe("Movie routes", () => {
  beforeEach(() => {
    mockSendFn.mockReset();
    mockFetch.mockReset();
  });

  describe("GET /movies/:tmdb_movie_id", () => {
    it("returns 200 with TMDB metadata (no group context)", async () => {
      // TMDB detail cache miss
      mockSendFn.mockResolvedValueOnce({ Item: undefined });
      // TMDB fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => tmdbDetailResponse,
      });
      // TMDB cache write
      mockSendFn.mockResolvedValueOnce({});
      // Watch providers cache miss
      mockSendFn.mockResolvedValueOnce({ Item: undefined });
      // Watch providers fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => watchProvidersResponse,
      });
      // Watch providers cache write
      mockSendFn.mockResolvedValueOnce({});

      const res = await makeRequest("GET", "/movies/550");

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.tmdb_movie_id).toBe(550);
      expect(body.title).toBe("Fight Club");
      expect(body.year).toBe(1999);
      expect(body.runtime).toBe(139);
      expect(body.genres).toEqual(["Drama", "Thriller"]);
      expect(body.content_rating).toBe("R");
      expect(body.cast).toHaveLength(2);
      expect(body.trailer_url).toContain("youtube.com");
      expect(body.streaming).toHaveLength(1);
      expect(body.group_context).toBeUndefined();
    });

    it("returns 404 for unknown movie", async () => {
      // TMDB cache miss
      mockSendFn.mockResolvedValueOnce({ Item: undefined });
      // TMDB fetch — 404
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const res = await makeRequest("GET", "/movies/999999");

      expect(res.status).toBe(404);
    });

    it("returns 200 with group context — watchlist on, not watched", async () => {
      // TMDB detail cache hit
      mockSendFn.mockResolvedValueOnce({
        Item: {
          cache_key: "detail:550",
          data: {
            tmdb_movie_id: 550,
            title: "Fight Club",
            year: 1999,
            poster_path: "/pB8...",
            overview: "...",
            runtime: 139,
            genres: ["Drama"],
            content_rating: "R",
            cast: [],
            popularity: 61.4,
            vote_average: 8.4,
            trailer_url: null,
          },
          ttl: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      // Watch providers cache hit
      mockSendFn.mockResolvedValueOnce({
        Item: {
          cache_key: "providers:550",
          data: [],
          ttl: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // isOnWatchlist — found
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", tmdb_movie_id: 550 },
      });
      // getWatchlist for added_by info
      mockSendFn.mockResolvedValueOnce({
        Items: [
          {
            group_id: "g-1",
            tmdb_movie_id: 550,
            added_by: "user-456",
            added_at: "2026-02-18T10:00:00Z",
            title: "Fight Club",
          },
        ],
      });
      // isWatched — direct check: not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });
      // isWatched — picks check: not watched
      mockSendFn.mockResolvedValueOnce({ Items: [] });
      // Vote history — rounds query
      mockSendFn.mockResolvedValueOnce({ Items: [] });

      const res = await makeRequest(
        "GET",
        "/movies/550?group_id=g-1",
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.group_context).toBeDefined();
      expect(body.group_context.watchlist_status.on_watchlist).toBe(true);
      expect(body.group_context.watchlist_status.added_by).toBe("user-456");
      expect(body.group_context.watched_status.watched).toBe(false);
      expect(body.group_context.vote_history).toEqual([]);
      expect(body.group_context.active_round).toBeNull();
    });

    it("returns 200 with group context — watched, vote history", async () => {
      // TMDB detail cache hit
      mockSendFn.mockResolvedValueOnce({
        Item: {
          cache_key: "detail:550",
          data: {
            tmdb_movie_id: 550,
            title: "Fight Club",
            year: 1999,
            poster_path: "/pB8...",
            overview: "...",
            runtime: 139,
            genres: ["Drama"],
            content_rating: "R",
            cast: [],
            popularity: 61.4,
            vote_average: 8.4,
            trailer_url: null,
          },
          ttl: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      // Watch providers cache hit
      mockSendFn.mockResolvedValueOnce({
        Item: {
          cache_key: "providers:550",
          data: [],
          ttl: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // isOnWatchlist — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });
      // isWatched — direct check: found
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", tmdb_movie_id: 550 },
      });
      // getCombinedWatchedMovies — direct watched
      mockSendFn.mockResolvedValueOnce({
        Items: [
          {
            group_id: "g-1",
            tmdb_movie_id: 550,
            marked_by: "user-123",
            watched_at: "2026-02-20T00:00:00Z",
            title: "Fight Club",
            poster_path: "/pB8...",
            year: 1999,
            source: "direct",
          },
        ],
      });
      // getCombinedWatchedMovies — picks (for merge)
      mockSendFn.mockResolvedValueOnce({ Items: [] });
      // Vote history — rounds query
      mockSendFn.mockResolvedValueOnce({
        Items: [
          {
            round_id: "r-1",
            group_id: "g-1",
            status: "closed",
            created_at: "2026-02-14T20:00:00Z",
          },
        ],
      });
      // Check if movie was in round r-1 suggestions
      mockSendFn.mockResolvedValueOnce({
        Items: [{ round_id: "r-1", tmdb_movie_id: 550 }],
      });
      // Get votes for round r-1
      mockSendFn.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", tmdb_movie_id: 550, user_id: "u1", vote: "up" },
          { round_id: "r-1", tmdb_movie_id: 550, user_id: "u2", vote: "up" },
          { round_id: "r-1", tmdb_movie_id: 550, user_id: "u3", vote: "down" },
        ],
      });

      const res = await makeRequest(
        "GET",
        "/movies/550?group_id=g-1",
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.group_context.watched_status.watched).toBe(true);
      expect(body.group_context.watched_status.source).toBe("direct");
      expect(body.group_context.vote_history).toHaveLength(1);
      expect(body.group_context.vote_history[0].votes_up).toBe(2);
      expect(body.group_context.vote_history[0].votes_down).toBe(1);
    });

    it("returns 403 for non-member with group_id", async () => {
      // TMDB detail cache hit
      mockSendFn.mockResolvedValueOnce({
        Item: {
          cache_key: "detail:550",
          data: {
            tmdb_movie_id: 550,
            title: "Fight Club",
            year: 1999,
            poster_path: "/pB8...",
            overview: "...",
            runtime: 139,
            genres: ["Drama"],
            content_rating: "R",
            cast: [],
            popularity: 61.4,
            vote_average: 8.4,
            trailer_url: null,
          },
          ttl: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      // Watch providers cache hit
      mockSendFn.mockResolvedValueOnce({
        Item: {
          cache_key: "providers:550",
          data: [],
          ttl: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      // requireMember — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest(
        "GET",
        "/movies/550?group_id=g-1",
      );

      expect(res.status).toBe(403);
    });
  });
});
