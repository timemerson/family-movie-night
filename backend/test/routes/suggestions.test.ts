import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../../src/middleware/auth.js";
import { suggestions } from "../../src/routes/suggestions.js";

// Mock the dynamo module
vi.mock("../../src/lib/dynamo.js", () => {
  const mockSend = vi.fn();
  return {
    getDocClient: () => ({ send: mockSend }),
    tableName: (key: string) => `test-${key}`,
    __mockSend: mockSend,
  };
});

// Mock fetch for TMDB API calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// @ts-expect-error __mockSend is injected by vi.mock
import { __mockSend as mockSend } from "../../src/lib/dynamo.js";
const mockSendFn = mockSend as unknown as ReturnType<typeof vi.fn>;

function createApp() {
  const app = new Hono();
  app.use("/*", authMiddleware());
  app.route("/", suggestions);
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

  return app.request(path, { method }, { event });
}

function makeTMDBDiscoverResponse(movies: any[]) {
  return {
    ok: true,
    json: () => Promise.resolve({ page: 1, total_results: movies.length, results: movies }),
  };
}

function makeTMDBWatchProvidersResponse(providers: any[] = []) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        results: { US: { flatrate: providers } },
      }),
  };
}

const sampleMovies = [
  {
    id: 550,
    title: "Fight Club",
    overview: "An insomniac...",
    poster_path: "/poster.jpg",
    release_date: "1999-10-15",
    genre_ids: [18, 53],
    popularity: 61.4,
    vote_average: 8.4,
    vote_count: 26000,
  },
  {
    id: 680,
    title: "Pulp Fiction",
    overview: "A burger-loving...",
    poster_path: "/poster2.jpg",
    release_date: "1994-10-14",
    genre_ids: [53, 80],
    popularity: 50.2,
    vote_average: 8.5,
    vote_count: 24000,
  },
  {
    id: 120,
    title: "The Lord of the Rings",
    overview: "A meek Hobbit...",
    poster_path: "/poster3.jpg",
    release_date: "2001-12-18",
    genre_ids: [12, 14, 28],
    popularity: 90.0,
    vote_average: 8.8,
    vote_count: 22000,
  },
];

describe("Suggestion routes", () => {
  beforeEach(() => {
    mockSendFn.mockReset();
    mockFetch.mockReset();
  });

  describe("GET /groups/:group_id/suggestions", () => {
    it("returns 200 with suggestions for a member", async () => {
      // requireMember — membership exists
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // getGroup — returns group with streaming services
      mockSendFn.mockResolvedValueOnce({
        Item: {
          group_id: "g-1",
          name: "The Emersons",
          streaming_services: ["netflix"],
          created_by: "user-123",
          created_at: "2026-02-14T00:00:00Z",
        },
      });
      // getGroupPreferenceSummary — QueryCommand for group preferences
      mockSendFn.mockResolvedValueOnce({
        Items: [
          {
            group_id: "g-1",
            user_id: "u-1",
            genre_likes: ["18", "53"],
            genre_dislikes: ["27"],
            max_content_rating: "PG-13",
            updated_at: "2026-02-14T00:00:00Z",
          },
          {
            group_id: "g-1",
            user_id: "u-2",
            genre_likes: ["28", "53"],
            genre_dislikes: ["27"],
            max_content_rating: "PG-13",
            updated_at: "2026-02-14T00:00:00Z",
          },
        ],
      });
      // getWatchedMovieIds → getGroupPicks — QueryCommand
      mockSendFn.mockResolvedValueOnce({ Items: [] });
      // TMDB cache miss for discover
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      // TMDB discover API call
      mockFetch.mockResolvedValueOnce(makeTMDBDiscoverResponse(sampleMovies));
      // TMDB cache write (discover)
      mockSendFn.mockResolvedValueOnce({});
      // TMDB cache miss + API call + cache write for each movie's watch providers (3 movies)
      for (let i = 0; i < 3; i++) {
        mockSendFn.mockResolvedValueOnce({ Item: undefined }); // cache miss
        mockFetch.mockResolvedValueOnce(makeTMDBWatchProvidersResponse()); // API
        mockSendFn.mockResolvedValueOnce({}); // cache write
      }

      const res = await makeRequest("GET", "/groups/g-1/suggestions");

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.suggestions).toBeDefined();
      expect(body.suggestions.length).toBeGreaterThan(0);
      expect(body.suggestions.length).toBeLessThanOrEqual(5);
      expect(body.relaxed_constraints).toEqual([]);

      // Verify each suggestion has expected fields
      const s = body.suggestions[0];
      expect(s.tmdb_movie_id).toBeDefined();
      expect(s.title).toBeDefined();
      expect(s.year).toBeDefined();
      expect(s.genres).toBeDefined();
      expect(s.score).toBeDefined();
      expect(s.reason).toBeDefined();
    });

    it("returns 403 for non-member", async () => {
      // requireMember — not found
      mockSendFn.mockResolvedValueOnce({ Item: undefined });

      const res = await makeRequest("GET", "/groups/g-1/suggestions");

      expect(res.status).toBe(403);
    });

    it("returns 400 when fewer than 2 members have set preferences", async () => {
      // requireMember
      mockSendFn.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-123", role: "member" },
      });
      // getGroup
      mockSendFn.mockResolvedValueOnce({
        Item: {
          group_id: "g-1",
          name: "The Emersons",
          streaming_services: [],
          created_by: "user-123",
          created_at: "2026-02-14T00:00:00Z",
        },
      });
      // getGroupPreferenceSummary — only 1 member
      mockSendFn.mockResolvedValueOnce({
        Items: [
          {
            group_id: "g-1",
            user_id: "u-1",
            genre_likes: ["18"],
            genre_dislikes: [],
            max_content_rating: "PG-13",
            updated_at: "2026-02-14T00:00:00Z",
          },
        ],
      });

      const res = await makeRequest("GET", "/groups/g-1/suggestions");

      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("2 members");
    });
  });
});
