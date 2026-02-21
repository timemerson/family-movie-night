import { describe, it, expect, vi, beforeEach } from "vitest";
import { WatchedService } from "../../src/services/watched-service.js";
import type { WatchlistService } from "../../src/services/watchlist-service.js";

function createMockDocClient() {
  return { send: vi.fn() };
}

function createMockWatchlistService(): WatchlistService {
  return {
    removeFromWatchlistIfPresent: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe("WatchedService", () => {
  let mockSend: ReturnType<typeof vi.fn>;
  let mockWatchlistService: WatchlistService;
  let service: WatchedService;

  beforeEach(() => {
    const client = createMockDocClient();
    mockSend = client.send;
    mockWatchlistService = createMockWatchlistService();
    service = new WatchedService(
      client as any,
      "test-watched-movies",
      "test-picks",
      mockWatchlistService,
    );
  });

  describe("markDirectlyWatched", () => {
    const metadata = {
      title: "Fight Club",
      poster_path: "/pB8...",
      year: 1999,
    };

    it("writes item and auto-removes from watchlist", async () => {
      // Check direct watched — not found
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // Check pick watched — no picks
      mockSend.mockResolvedValueOnce({ Items: [] });
      // PutCommand
      mockSend.mockResolvedValueOnce({});

      const result = await service.markDirectlyWatched(
        "g-1",
        550,
        "user-123",
        metadata,
      );

      expect(result.group_id).toBe("g-1");
      expect(result.tmdb_movie_id).toBe(550);
      expect(result.marked_by).toBe("user-123");
      expect(result.watched_at).toBeTruthy();
      expect(result.source).toBe("direct");
      expect(mockWatchlistService.removeFromWatchlistIfPresent).toHaveBeenCalledWith(
        "g-1",
        550,
      );
    });

    it("rejects when already watched (direct)", async () => {
      // Check direct watched — found
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", tmdb_movie_id: 550 },
      });

      await expect(
        service.markDirectlyWatched("g-1", 550, "user-123", metadata),
      ).rejects.toThrow("Already watched");
    });

    it("rejects when already watched (via pick)", async () => {
      // Check direct watched — not found
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // Check pick watched — found watched pick
      mockSend.mockResolvedValueOnce({
        Items: [
          { tmdb_movie_id: 550, watched: true, watched_at: "2026-02-14T00:00:00Z" },
        ],
      });

      await expect(
        service.markDirectlyWatched("g-1", 550, "user-123", metadata),
      ).rejects.toThrow("Already watched");
    });

    it("succeeds when not on watchlist (no error from auto-remove)", async () => {
      // Check direct watched — not found
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // Check pick watched — no watched picks
      mockSend.mockResolvedValueOnce({ Items: [] });
      // PutCommand
      mockSend.mockResolvedValueOnce({});

      const result = await service.markDirectlyWatched(
        "g-1",
        550,
        "user-123",
        metadata,
      );

      expect(result.tmdb_movie_id).toBe(550);
      expect(mockWatchlistService.removeFromWatchlistIfPresent).toHaveBeenCalled();
    });
  });

  describe("unmarkDirectlyWatched", () => {
    it("succeeds within 24h by marker", async () => {
      const recentTime = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago
      // GetCommand — directly watched item
      mockSend.mockResolvedValueOnce({
        Item: {
          group_id: "g-1",
          tmdb_movie_id: 550,
          marked_by: "user-123",
          watched_at: recentTime,
          source: "direct",
        },
      });
      // DeleteCommand
      mockSend.mockResolvedValueOnce({});

      await service.unmarkDirectlyWatched("g-1", 550, "user-123", "member");

      expect(mockSend).toHaveBeenCalledTimes(2);
      const deleteCmd = mockSend.mock.calls[1][0];
      expect(deleteCmd.input.Key).toEqual({
        group_id: "g-1",
        tmdb_movie_id: 550,
      });
    });

    it("rejects after 24h", async () => {
      const oldTime = new Date(
        Date.now() - 25 * 60 * 60 * 1000,
      ).toISOString(); // 25 hours ago
      // GetCommand — directly watched item
      mockSend.mockResolvedValueOnce({
        Item: {
          group_id: "g-1",
          tmdb_movie_id: 550,
          marked_by: "user-123",
          watched_at: oldTime,
          source: "direct",
        },
      });

      await expect(
        service.unmarkDirectlyWatched("g-1", 550, "user-123", "member"),
      ).rejects.toThrow("Undo window expired");
    });

    it("rejects at exactly 24h boundary", async () => {
      const exactlyAt24h = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();
      mockSend.mockResolvedValueOnce({
        Item: {
          group_id: "g-1",
          tmdb_movie_id: 550,
          marked_by: "user-123",
          watched_at: exactlyAt24h,
          source: "direct",
        },
      });

      await expect(
        service.unmarkDirectlyWatched("g-1", 550, "user-123", "member"),
      ).rejects.toThrow("Undo window expired");
    });

    it("rejects by other member (not marker, not creator)", async () => {
      const recentTime = new Date(Date.now() - 1000 * 60 * 60).toISOString();
      mockSend.mockResolvedValueOnce({
        Item: {
          group_id: "g-1",
          tmdb_movie_id: 550,
          marked_by: "user-other",
          watched_at: recentTime,
          source: "direct",
        },
      });

      await expect(
        service.unmarkDirectlyWatched("g-1", 550, "user-123", "member"),
      ).rejects.toThrow("Only the member who marked this movie or the group creator can undo it");
    });

    it("succeeds when done by creator (not marker)", async () => {
      const recentTime = new Date(Date.now() - 1000 * 60 * 60).toISOString();
      mockSend.mockResolvedValueOnce({
        Item: {
          group_id: "g-1",
          tmdb_movie_id: 550,
          marked_by: "user-other",
          watched_at: recentTime,
          source: "direct",
        },
      });
      // DeleteCommand
      mockSend.mockResolvedValueOnce({});

      await service.unmarkDirectlyWatched("g-1", 550, "user-123", "creator");

      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("rejects when movie was watched via pick", async () => {
      // GetCommand — not in WatchedMovies
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // QueryCommand — found in picks
      mockSend.mockResolvedValueOnce({
        Items: [{ tmdb_movie_id: 550, watched: true }],
      });

      await expect(
        service.unmarkDirectlyWatched("g-1", 550, "user-123", "member"),
      ).rejects.toThrow("Cannot undo a movie watched through a round");
    });

    it("rejects when movie not watched at all", async () => {
      // GetCommand — not in WatchedMovies
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // QueryCommand — not in picks either
      mockSend.mockResolvedValueOnce({ Items: [] });

      await expect(
        service.unmarkDirectlyWatched("g-1", 550, "user-123", "member"),
      ).rejects.toThrow("Movie not found in watched list");
    });
  });

  describe("getCombinedWatchedMovies", () => {
    it("merges picks and direct watched movies", async () => {
      // getDirectlyWatchedMovies — QueryCommand
      mockSend.mockResolvedValueOnce({
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
      mockSend.mockResolvedValueOnce({
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
          {
            pick_id: "p-2",
            group_id: "g-1",
            tmdb_movie_id: 120,
            picked_by: "user-789",
            watched: false,
            watched_at: null,
          },
        ],
      });

      const result = await service.getCombinedWatchedMovies("g-1");

      expect(result).toHaveLength(2);
      expect(result[0].tmdb_movie_id).toBe(550); // more recent
      expect(result[0].source).toBe("direct");
      expect(result[1].tmdb_movie_id).toBe(680);
      expect(result[1].source).toBe("picked");
    });

    it("returns only picks when no direct watched", async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            pick_id: "p-1",
            group_id: "g-1",
            tmdb_movie_id: 680,
            picked_by: "user-456",
            watched: true,
            watched_at: "2026-02-14T00:00:00Z",
          },
        ],
      });

      const result = await service.getCombinedWatchedMovies("g-1");

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe("picked");
    });

    it("returns only direct when no picks", async () => {
      mockSend.mockResolvedValueOnce({
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
      mockSend.mockResolvedValueOnce({ Items: [] });

      const result = await service.getCombinedWatchedMovies("g-1");

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe("direct");
    });

    it("returns empty array when none watched", async () => {
      mockSend.mockResolvedValueOnce({ Items: undefined });
      mockSend.mockResolvedValueOnce({ Items: undefined });

      const result = await service.getCombinedWatchedMovies("g-1");

      expect(result).toEqual([]);
    });
  });

  describe("getAllWatchedMovieIds", () => {
    it("returns complete set from both sources", async () => {
      // Direct watched
      mockSend.mockResolvedValueOnce({
        Items: [
          { tmdb_movie_id: 550, watched_at: "2026-02-16T00:00:00Z", title: "FC", poster_path: "/a", year: 1999, marked_by: "u1", source: "direct", group_id: "g-1" },
        ],
      });
      // Pick watched
      mockSend.mockResolvedValueOnce({
        Items: [
          { tmdb_movie_id: 680, watched: true, watched_at: "2026-02-14T00:00:00Z", picked_by: "u2", pick_id: "p-1", group_id: "g-1" },
        ],
      });

      const result = await service.getAllWatchedMovieIds("g-1");

      expect(result).toBeInstanceOf(Set);
      expect(result.has(550)).toBe(true);
      expect(result.has(680)).toBe(true);
      expect(result.size).toBe(2);
    });
  });

  describe("isWatched", () => {
    it("returns true from direct watched", async () => {
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", tmdb_movie_id: 550 },
      });

      const result = await service.isWatched("g-1", 550);
      expect(result).toBe(true);
    });

    it("returns true from picks", async () => {
      // Direct — not found
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // Picks — found watched
      mockSend.mockResolvedValueOnce({
        Items: [
          { tmdb_movie_id: 550, watched: true, watched_at: "2026-02-14T00:00:00Z" },
        ],
      });

      const result = await service.isWatched("g-1", 550);
      expect(result).toBe(true);
    });

    it("returns false when not watched", async () => {
      // Direct — not found
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // Picks — none watched
      mockSend.mockResolvedValueOnce({ Items: [] });

      const result = await service.isWatched("g-1", 550);
      expect(result).toBe(false);
    });
  });
});
