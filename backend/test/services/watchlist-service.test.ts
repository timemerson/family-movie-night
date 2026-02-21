import { describe, it, expect, vi, beforeEach } from "vitest";
import { WatchlistService } from "../../src/services/watchlist-service.js";

function createMockDocClient() {
  return { send: vi.fn() };
}

describe("WatchlistService", () => {
  let mockSend: ReturnType<typeof vi.fn>;
  let service: WatchlistService;

  beforeEach(() => {
    const client = createMockDocClient();
    mockSend = client.send;
    service = new WatchlistService(
      client as any,
      "test-watchlist",
      "test-picks",
      "test-watched-movies",
    );
  });

  describe("addToWatchlist", () => {
    const metadata = {
      title: "Fight Club",
      poster_path: "/pB8...",
      year: 1999,
      genres: ["Drama", "Thriller"],
      content_rating: "R",
    };

    it("writes item and returns WatchlistItem", async () => {
      // isOnWatchlist — GetCommand — not found
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // Check direct watched — GetCommand — not found
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // Check pick watched — QueryCommand — no watched picks
      mockSend.mockResolvedValueOnce({ Items: [] });
      // getWatchlistCount — QueryCommand — count 0
      mockSend.mockResolvedValueOnce({ Count: 0 });
      // PutCommand — success
      mockSend.mockResolvedValueOnce({});

      const result = await service.addToWatchlist(
        "g-1",
        550,
        "user-123",
        metadata,
      );

      expect(result.group_id).toBe("g-1");
      expect(result.tmdb_movie_id).toBe(550);
      expect(result.added_by).toBe("user-123");
      expect(result.added_at).toBeTruthy();
      expect(result.title).toBe("Fight Club");
      expect(result.genres).toEqual(["Drama", "Thriller"]);
      expect(mockSend).toHaveBeenCalledTimes(5);

      const putCmd = mockSend.mock.calls[4][0];
      expect(putCmd.input.TableName).toBe("test-watchlist");
      expect(putCmd.input.Item.tmdb_movie_id).toBe(550);
    });

    it("rejects duplicate with ConflictError", async () => {
      // isOnWatchlist — GetCommand — found
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", tmdb_movie_id: 550 },
      });

      await expect(
        service.addToWatchlist("g-1", 550, "user-123", metadata),
      ).rejects.toThrow("Already on Watchlist");
    });

    it("rejects when watchlist is full (50 movies)", async () => {
      // isOnWatchlist — not found
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // Check direct watched — not found
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // Check pick watched — no watched picks
      mockSend.mockResolvedValueOnce({ Items: [] });
      // getWatchlistCount — count 50
      mockSend.mockResolvedValueOnce({ Count: 50 });

      await expect(
        service.addToWatchlist("g-1", 550, "user-123", metadata),
      ).rejects.toThrow("Watchlist is full");
    });

    it("rejects when movie is already watched (direct)", async () => {
      // isOnWatchlist — not found
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // Check direct watched — found
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", tmdb_movie_id: 550 },
      });

      await expect(
        service.addToWatchlist("g-1", 550, "user-123", metadata),
      ).rejects.toThrow("Already watched");
    });

    it("rejects when movie is already watched (via pick)", async () => {
      // isOnWatchlist — not found
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // Check direct watched — not found
      mockSend.mockResolvedValueOnce({ Item: undefined });
      // Check pick watched — found watched pick
      mockSend.mockResolvedValueOnce({
        Items: [
          { tmdb_movie_id: 550, watched: true, watched_at: "2026-02-14T00:00:00Z" },
        ],
      });

      await expect(
        service.addToWatchlist("g-1", 550, "user-123", metadata),
      ).rejects.toThrow("Already watched");
    });
  });

  describe("removeFromWatchlist", () => {
    it("succeeds when user is the adder", async () => {
      // GetCommand — item exists, added by user
      mockSend.mockResolvedValueOnce({
        Item: {
          group_id: "g-1",
          tmdb_movie_id: 550,
          added_by: "user-123",
          added_at: "2026-02-14T00:00:00Z",
        },
      });
      // DeleteCommand
      mockSend.mockResolvedValueOnce({});

      await service.removeFromWatchlist("g-1", 550, "user-123", "member");

      expect(mockSend).toHaveBeenCalledTimes(2);
      const deleteCmd = mockSend.mock.calls[1][0];
      expect(deleteCmd.input.TableName).toBe("test-watchlist");
      expect(deleteCmd.input.Key).toEqual({
        group_id: "g-1",
        tmdb_movie_id: 550,
      });
    });

    it("succeeds when user is creator (not adder)", async () => {
      // GetCommand — item exists, added by different user
      mockSend.mockResolvedValueOnce({
        Item: {
          group_id: "g-1",
          tmdb_movie_id: 550,
          added_by: "user-other",
          added_at: "2026-02-14T00:00:00Z",
        },
      });
      // DeleteCommand
      mockSend.mockResolvedValueOnce({});

      await service.removeFromWatchlist("g-1", 550, "user-123", "creator");

      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("rejects when user is not adder and not creator", async () => {
      // GetCommand — item exists, added by different user
      mockSend.mockResolvedValueOnce({
        Item: {
          group_id: "g-1",
          tmdb_movie_id: 550,
          added_by: "user-other",
          added_at: "2026-02-14T00:00:00Z",
        },
      });

      await expect(
        service.removeFromWatchlist("g-1", 550, "user-123", "member"),
      ).rejects.toThrow("Only the member who added this movie or the group creator can remove it");
    });

    it("rejects when movie is not on watchlist", async () => {
      // GetCommand — not found
      mockSend.mockResolvedValueOnce({ Item: undefined });

      await expect(
        service.removeFromWatchlist("g-1", 550, "user-123", "member"),
      ).rejects.toThrow("Movie not on watchlist");
    });
  });

  describe("getWatchlist", () => {
    it("returns items sorted reverse-chronologically", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            group_id: "g-1",
            tmdb_movie_id: 550,
            added_at: "2026-02-14T00:00:00Z",
            title: "Fight Club",
          },
          {
            group_id: "g-1",
            tmdb_movie_id: 680,
            added_at: "2026-02-16T00:00:00Z",
            title: "Pulp Fiction",
          },
          {
            group_id: "g-1",
            tmdb_movie_id: 120,
            added_at: "2026-02-15T00:00:00Z",
            title: "LOTR",
          },
        ],
      });

      const result = await service.getWatchlist("g-1");

      expect(result).toHaveLength(3);
      expect(result[0].tmdb_movie_id).toBe(680); // most recent
      expect(result[1].tmdb_movie_id).toBe(120);
      expect(result[2].tmdb_movie_id).toBe(550); // oldest
    });

    it("returns empty array when no items", async () => {
      mockSend.mockResolvedValueOnce({ Items: undefined });

      const result = await service.getWatchlist("g-1");

      expect(result).toEqual([]);
    });
  });

  describe("getWatchlistCount", () => {
    it("returns correct count", async () => {
      mockSend.mockResolvedValueOnce({ Count: 12 });

      const result = await service.getWatchlistCount("g-1");

      expect(result).toBe(12);
    });
  });

  describe("isOnWatchlist", () => {
    it("returns true when item exists", async () => {
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", tmdb_movie_id: 550 },
      });

      const result = await service.isOnWatchlist("g-1", 550);

      expect(result).toBe(true);
    });

    it("returns false when item does not exist", async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      const result = await service.isOnWatchlist("g-1", 550);

      expect(result).toBe(false);
    });
  });
});
