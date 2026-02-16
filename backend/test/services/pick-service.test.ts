import { describe, it, expect, vi, beforeEach } from "vitest";
import { PickService } from "../../src/services/pick-service.js";

function createMockDocClient() {
  return { send: vi.fn() };
}

describe("PickService", () => {
  let mockSend: ReturnType<typeof vi.fn>;
  let service: PickService;

  beforeEach(() => {
    const client = createMockDocClient();
    mockSend = client.send;
    service = new PickService(
      client as any,
      "test-picks",
      "test-memberships",
    );
  });

  describe("createPick", () => {
    it("writes item and returns Pick with generated fields", async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await service.createPick({
        group_id: "g-1",
        round_id: "r-1",
        tmdb_movie_id: 550,
        picked_by: "u-1",
      });

      expect(result.pick_id).toBeTruthy();
      expect(result.round_id).toBe("r-1");
      expect(result.group_id).toBe("g-1");
      expect(result.tmdb_movie_id).toBe(550);
      expect(result.picked_by).toBe("u-1");
      expect(result.picked_at).toBeTruthy();
      expect(result.watched).toBe(false);
      expect(result.watched_at).toBeNull();

      expect(mockSend).toHaveBeenCalledTimes(1);
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.TableName).toBe("test-picks");
      expect(cmd.input.Item.pick_id).toBe(result.pick_id);
    });
  });

  describe("markWatched", () => {
    it("sets watched=true and watched_at, returns updated pick", async () => {
      // GetCommand — pick exists
      mockSend.mockResolvedValueOnce({
        Item: {
          pick_id: "p-1",
          round_id: "r-1",
          group_id: "g-1",
          tmdb_movie_id: 550,
          picked_by: "u-1",
          picked_at: "2026-02-14T00:00:00Z",
          watched: false,
          watched_at: null,
        },
      });
      // GetCommand — membership exists
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "u-1", role: "member" },
      });
      // UpdateCommand — returns updated item
      mockSend.mockResolvedValueOnce({
        Attributes: {
          pick_id: "p-1",
          round_id: "r-1",
          group_id: "g-1",
          tmdb_movie_id: 550,
          picked_by: "u-1",
          picked_at: "2026-02-14T00:00:00Z",
          watched: true,
          watched_at: "2026-02-16T00:00:00Z",
        },
      });

      const result = await service.markWatched("p-1", "u-1", "g-1");

      expect(result.watched).toBe(true);
      expect(result.watched_at).toBeTruthy();
      expect(mockSend).toHaveBeenCalledTimes(3);

      // Verify UpdateCommand
      const updateCmd = mockSend.mock.calls[2][0];
      expect(updateCmd.input.TableName).toBe("test-picks");
      expect(updateCmd.input.Key).toEqual({ pick_id: "p-1" });
      expect(updateCmd.input.UpdateExpression).toContain("watched");
    });

    it("rejects non-member with ForbiddenError", async () => {
      // GetCommand — pick exists
      mockSend.mockResolvedValueOnce({
        Item: {
          pick_id: "p-1",
          round_id: "r-1",
          group_id: "g-1",
          tmdb_movie_id: 550,
          picked_by: "u-1",
          picked_at: "2026-02-14T00:00:00Z",
          watched: false,
          watched_at: null,
        },
      });
      // GetCommand — membership not found
      mockSend.mockResolvedValueOnce({ Item: undefined });

      await expect(
        service.markWatched("p-1", "u-999", "g-1"),
      ).rejects.toThrow("Not a member of this group");
    });

    it("rejects pick not found with NotFoundError", async () => {
      // GetCommand — pick not found
      mockSend.mockResolvedValueOnce({ Item: undefined });

      await expect(
        service.markWatched("p-missing", "u-1", "g-1"),
      ).rejects.toThrow("Pick not found");
    });

    it("rejects pick not in group with NotFoundError", async () => {
      // GetCommand — pick exists but belongs to different group
      mockSend.mockResolvedValueOnce({
        Item: {
          pick_id: "p-1",
          round_id: "r-1",
          group_id: "g-other",
          tmdb_movie_id: 550,
          picked_by: "u-1",
          picked_at: "2026-02-14T00:00:00Z",
          watched: false,
          watched_at: null,
        },
      });

      await expect(
        service.markWatched("p-1", "u-1", "g-1"),
      ).rejects.toThrow("Pick not found");
    });
  });

  describe("getGroupPicks", () => {
    it("returns array via GSI query", async () => {
      const items = [
        {
          pick_id: "p-1",
          round_id: "r-1",
          group_id: "g-1",
          tmdb_movie_id: 550,
          picked_by: "u-1",
          picked_at: "2026-02-14T00:00:00Z",
          watched: true,
          watched_at: "2026-02-15T00:00:00Z",
        },
        {
          pick_id: "p-2",
          round_id: "r-2",
          group_id: "g-1",
          tmdb_movie_id: 680,
          picked_by: "u-2",
          picked_at: "2026-02-15T00:00:00Z",
          watched: false,
          watched_at: null,
        },
      ];
      mockSend.mockResolvedValueOnce({ Items: items });

      const result = await service.getGroupPicks("g-1");

      expect(result).toEqual(items);
      expect(mockSend).toHaveBeenCalledTimes(1);
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.IndexName).toBe("group-picks-index");
      expect(cmd.input.KeyConditionExpression).toBe("group_id = :gid");
    });

    it("returns empty array when none exist", async () => {
      mockSend.mockResolvedValueOnce({ Items: undefined });

      const result = await service.getGroupPicks("g-1");

      expect(result).toEqual([]);
    });
  });

  describe("getWatchedMovieIds", () => {
    it("returns only tmdb_movie_ids where watched=true", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            pick_id: "p-1",
            group_id: "g-1",
            tmdb_movie_id: 550,
            watched: true,
            watched_at: "2026-02-15T00:00:00Z",
          },
          {
            pick_id: "p-2",
            group_id: "g-1",
            tmdb_movie_id: 680,
            watched: false,
            watched_at: null,
          },
          {
            pick_id: "p-3",
            group_id: "g-1",
            tmdb_movie_id: 120,
            watched: true,
            watched_at: "2026-02-16T00:00:00Z",
          },
        ],
      });

      const result = await service.getWatchedMovieIds("g-1");

      expect(result).toEqual([550, 120]);
    });
  });
});
