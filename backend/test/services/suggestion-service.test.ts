import { describe, it, expect, vi, beforeEach } from "vitest";
import { SuggestionService } from "../../src/services/suggestion-service.js";
import type { PreferenceService, PreferenceSummary } from "../../src/services/preference-service.js";
import type { PickService } from "../../src/services/pick-service.js";
import type { TMDBClient } from "../../src/services/tmdb-client.js";
import type { TMDBMovie, StreamingProvider } from "../../src/models/suggestion.js";

function makeMockPreferenceService(summary: PreferenceSummary) {
  return {
    getGroupPreferenceSummary: vi.fn().mockResolvedValue(summary),
  } as unknown as PreferenceService;
}

function makeMockPickService(watchedIds: number[] = []) {
  return {
    getWatchedMovieIds: vi.fn().mockResolvedValue(watchedIds),
  } as unknown as PickService;
}

function makeMockTMDBClient(
  movies: TMDBMovie[] = [],
  providers: StreamingProvider[] = [],
) {
  return {
    discoverMovies: vi.fn().mockResolvedValue(movies),
    getWatchProviders: vi.fn().mockResolvedValue(providers),
    getContentRating: vi.fn().mockResolvedValue(null),
  } as unknown as TMDBClient;
}

function makeMovie(overrides: Partial<TMDBMovie> = {}): TMDBMovie {
  return {
    id: 550,
    title: "Fight Club",
    overview: "An insomniac office worker...",
    poster_path: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
    release_date: "1999-10-15",
    genre_ids: [18, 53],
    popularity: 61.4,
    vote_average: 8.4,
    vote_count: 26000,
    ...overrides,
  };
}

const defaultSummary: PreferenceSummary = {
  liked_genres: ["18", "53", "28"],
  disliked_genres: ["27"],
  max_content_rating: "PG-13",
  member_count: 3,
};

describe("SuggestionService", () => {
  describe("getSuggestions", () => {
    it("returns scored suggestions from TMDB results", async () => {
      const movies = [
        makeMovie({ id: 1, title: "Movie A", popularity: 100, vote_average: 8.0, genre_ids: [18, 53] }),
        makeMovie({ id: 2, title: "Movie B", popularity: 50, vote_average: 7.0, genre_ids: [28] }),
        makeMovie({ id: 3, title: "Movie C", popularity: 80, vote_average: 7.5, genre_ids: [18] }),
      ];

      const tmdb = makeMockTMDBClient(movies, []);
      const service = new SuggestionService(
        makeMockPreferenceService(defaultSummary),
        makeMockPickService(),
        tmdb,
        [],
      );

      const result = await service.getSuggestions("g-1");

      expect(result.suggestions).toHaveLength(3);
      expect(result.relaxed_constraints).toEqual([]);
      // Should be sorted by score descending
      expect(result.suggestions[0].tmdb_movie_id).toBe(1); // highest popularity + best genre match
    });

    it("excludes watched movies", async () => {
      const movies = [
        makeMovie({ id: 1, title: "Watched Movie", popularity: 100 }),
        makeMovie({ id: 2, title: "Unwatched Movie", popularity: 90 }),
        makeMovie({ id: 3, title: "Also Unwatched", popularity: 80 }),
      ];

      const tmdb = makeMockTMDBClient(movies, []);
      const service = new SuggestionService(
        makeMockPreferenceService(defaultSummary),
        makeMockPickService([1]),
        tmdb,
        [],
      );

      const result = await service.getSuggestions("g-1");

      expect(result.suggestions.map((s) => s.tmdb_movie_id)).not.toContain(1);
      expect(result.suggestions).toHaveLength(2);
    });

    it("excludes explicitly excluded movie IDs", async () => {
      const movies = [
        makeMovie({ id: 1, popularity: 100 }),
        makeMovie({ id: 2, popularity: 90 }),
        makeMovie({ id: 3, popularity: 80 }),
      ];

      const tmdb = makeMockTMDBClient(movies, []);
      const service = new SuggestionService(
        makeMockPreferenceService(defaultSummary),
        makeMockPickService(),
        tmdb,
        [],
      );

      const result = await service.getSuggestions("g-1", [1, 2]);

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].tmdb_movie_id).toBe(3);
    });

    it("boosts movies available on group streaming services", async () => {
      const movies = [
        makeMovie({ id: 1, title: "No Streaming", popularity: 100, genre_ids: [18] }),
        makeMovie({ id: 2, title: "On Netflix", popularity: 80, genre_ids: [18] }),
      ];

      const tmdb = {
        discoverMovies: vi.fn().mockResolvedValue(movies),
        getWatchProviders: vi.fn().mockImplementation((movieId: number) => {
          if (movieId === 2) {
            return Promise.resolve([{ provider_name: "Netflix", logo_path: "/netflix.jpg" }]);
          }
          return Promise.resolve([]);
        }),
        getContentRating: vi.fn().mockResolvedValue(null),
      } as unknown as TMDBClient;

      const service = new SuggestionService(
        makeMockPreferenceService(defaultSummary),
        makeMockPickService(),
        tmdb,
        ["netflix"],
      );

      const result = await service.getSuggestions("g-1");

      // Movie 2 should be ranked higher due to streaming boost despite lower popularity
      expect(result.suggestions[0].tmdb_movie_id).toBe(2);
    });

    it("includes reason fields explaining why movies were suggested", async () => {
      const movies = [
        makeMovie({ id: 1, genre_ids: [18, 53], popularity: 100, vote_average: 8.5 }),
      ];

      const tmdb = makeMockTMDBClient(movies, [
        { provider_name: "Netflix", logo_path: "/netflix.jpg" },
      ]);

      const service = new SuggestionService(
        makeMockPreferenceService(defaultSummary),
        makeMockPickService(),
        tmdb,
        ["netflix"],
      );

      const result = await service.getSuggestions("g-1");

      expect(result.suggestions[0].reason).toContain("Drama");
      expect(result.suggestions[0].reason).toContain("streaming");
      expect(result.suggestions[0].reason).toContain("8.5");
    });

    it("throws ValidationError when fewer than 2 members have set preferences", async () => {
      const service = new SuggestionService(
        makeMockPreferenceService({ ...defaultSummary, member_count: 1 }),
        makeMockPickService(),
        makeMockTMDBClient(),
        [],
      );

      await expect(service.getSuggestions("g-1")).rejects.toThrow(
        "At least 2 members must set preferences",
      );
    });

    it("relaxes constraints when fewer than 3 results", async () => {
      let callCount = 0;
      const tmdb = {
        discoverMovies: vi.fn().mockImplementation(() => {
          callCount++;
          // First call returns too few, subsequent calls return enough
          if (callCount <= 1) return Promise.resolve([]);
          return Promise.resolve([
            makeMovie({ id: 1, popularity: 100 }),
            makeMovie({ id: 2, popularity: 80 }),
            makeMovie({ id: 3, popularity: 60 }),
          ]);
        }),
        getWatchProviders: vi.fn().mockResolvedValue([]),
        getContentRating: vi.fn().mockResolvedValue(null),
      } as unknown as TMDBClient;

      const service = new SuggestionService(
        makeMockPreferenceService(defaultSummary),
        makeMockPickService(),
        tmdb,
        [],
      );

      const result = await service.getSuggestions("g-1");

      expect(result.relaxed_constraints.length).toBeGreaterThan(0);
      expect(result.relaxed_constraints).toContain("expanded_genres");
    });

    it("limits results to 5 suggestions max", async () => {
      const movies = Array.from({ length: 10 }, (_, i) =>
        makeMovie({ id: i + 1, title: `Movie ${i + 1}`, popularity: 100 - i }),
      );

      const tmdb = makeMockTMDBClient(movies, []);
      const service = new SuggestionService(
        makeMockPreferenceService(defaultSummary),
        makeMockPickService(),
        tmdb,
        [],
      );

      const result = await service.getSuggestions("g-1");

      expect(result.suggestions.length).toBeLessThanOrEqual(5);
    });

    it("breaks ties by vote_average then by tmdb_movie_id", async () => {
      const movies = [
        makeMovie({ id: 3, popularity: 100, vote_average: 7.0, genre_ids: [18] }),
        makeMovie({ id: 1, popularity: 100, vote_average: 8.0, genre_ids: [18] }),
        makeMovie({ id: 2, popularity: 100, vote_average: 8.0, genre_ids: [18] }),
      ];

      const tmdb = makeMockTMDBClient(movies, []);
      const service = new SuggestionService(
        makeMockPreferenceService(defaultSummary),
        makeMockPickService(),
        tmdb,
        [],
      );

      const result = await service.getSuggestions("g-1");

      // Same score, so sorted by vote_average desc, then id asc
      expect(result.suggestions[0].tmdb_movie_id).toBe(1); // 8.0, id 1
      expect(result.suggestions[1].tmdb_movie_id).toBe(2); // 8.0, id 2
      expect(result.suggestions[2].tmdb_movie_id).toBe(3); // 7.0, id 3
    });

    it("maps genre IDs to genre names in suggestions", async () => {
      const movies = [
        makeMovie({ id: 1, genre_ids: [28, 878, 53] }),
      ];

      const tmdb = makeMockTMDBClient(movies, []);
      const service = new SuggestionService(
        makeMockPreferenceService(defaultSummary),
        makeMockPickService(),
        tmdb,
        [],
      );

      const result = await service.getSuggestions("g-1");

      expect(result.suggestions[0].genres).toEqual([
        "Action",
        "Science Fiction",
        "Thriller",
      ]);
    });

    it("extracts year from release_date", async () => {
      const movies = [
        makeMovie({ id: 1, release_date: "2023-06-15" }),
      ];

      const tmdb = makeMockTMDBClient(movies, []);
      const service = new SuggestionService(
        makeMockPreferenceService(defaultSummary),
        makeMockPickService(),
        tmdb,
        [],
      );

      const result = await service.getSuggestions("g-1");

      expect(result.suggestions[0].year).toBe(2023);
    });
  });
});
