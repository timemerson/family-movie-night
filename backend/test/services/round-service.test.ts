import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoundService } from "../../src/services/round-service.js";

function createMockDocClient() {
  return { send: vi.fn() };
}

function createMockGroupService() {
  return {
    requireMember: vi.fn().mockResolvedValue({ user_id: "user-1", role: "creator" }),
    getGroup: vi.fn().mockResolvedValue({ group_id: "g-1", streaming_services: [] }),
    getMembers: vi.fn().mockResolvedValue([
      { user_id: "user-1", display_name: "Alice", role: "creator" },
      { user_id: "user-2", display_name: "Bob", role: "member" },
    ]),
  };
}

function createMockSuggestionService() {
  return {
    getSuggestions: vi.fn().mockResolvedValue({
      suggestions: [
        {
          tmdb_movie_id: 550,
          title: "Fight Club",
          year: 1999,
          poster_path: "/pB8...",
          overview: "A ticking-time-bomb...",
          genres: ["Drama"],
          content_rating: "R",
          popularity: 61.4,
          vote_average: 8.4,
          streaming: [],
          score: 0.85,
          reason: "Matches your taste.",
        },
        {
          tmdb_movie_id: 680,
          title: "Pulp Fiction",
          year: 1994,
          poster_path: "/d5i...",
          overview: "A burger-loving hitman...",
          genres: ["Crime", "Thriller"],
          content_rating: "R",
          popularity: 55.0,
          vote_average: 8.5,
          streaming: [],
          score: 0.80,
          reason: "Highly popular.",
        },
      ],
      relaxed_constraints: [],
    }),
  };
}

function createMockWatchlistService() {
  return {
    getWatchlist: vi.fn().mockResolvedValue([]),
  };
}

function createMockWatchedService() {
  return {
    getAllWatchedMovieIds: vi.fn().mockResolvedValue(new Set<number>()),
  };
}

describe("RoundService", () => {
  let mockSend: ReturnType<typeof vi.fn>;
  let service: RoundService;
  let mockGroupService: ReturnType<typeof createMockGroupService>;
  let mockSuggestionService: ReturnType<typeof createMockSuggestionService>;
  let mockWatchlistService: ReturnType<typeof createMockWatchlistService>;
  let mockWatchedService: ReturnType<typeof createMockWatchedService>;

  beforeEach(() => {
    const client = createMockDocClient();
    mockSend = client.send;
    mockGroupService = createMockGroupService();
    mockSuggestionService = createMockSuggestionService();
    mockWatchlistService = createMockWatchlistService();
    mockWatchedService = createMockWatchedService();

    service = new RoundService(
      client as any,
      "test-rounds",
      "test-suggestions",
      "test-votes",
      "test-picks",
      mockGroupService as any,
      mockSuggestionService as any,
      mockWatchlistService as any,
      mockWatchedService as any,
    );
  });

  describe("createRound", () => {
    it("creates round with algorithm suggestions", async () => {
      // getActiveRound pre-check — GSI query — no active rounds
      mockSend.mockResolvedValueOnce({ Items: [] });
      // Conditional PutCommand for round
      mockSend.mockResolvedValueOnce({});
      // Post-write recheck getActiveRound — no other active round
      mockSend.mockResolvedValueOnce({ Items: [] });
      // PutCommand for each suggestion (2)
      mockSend.mockResolvedValueOnce({});
      mockSend.mockResolvedValueOnce({});

      const result = await service.createRound("g-1", "user-1");

      expect(result.round.group_id).toBe("g-1");
      expect(result.round.status).toBe("voting");
      expect(result.round.started_by).toBe("user-1");
      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0].source).toBe("algorithm");
      expect(result.suggestions[0].title).toBe("Fight Club");
      expect(result.relaxed_constraints).toEqual([]);
      expect(result.watchlist_eligible_count).toBe(0);

      // Verify conditional put
      const putCmd = mockSend.mock.calls[1][0];
      expect(putCmd.input.ConditionExpression).toBe("attribute_not_exists(round_id)");
    });

    it("throws ConflictError when active round exists", async () => {
      // getActiveRound — returns an active round
      mockSend.mockResolvedValueOnce({
        Items: [{ round_id: "r-existing", group_id: "g-1", status: "voting" }],
      });

      await expect(
        service.createRound("g-1", "user-1"),
      ).rejects.toThrow("An active round already exists");
    });

    it("throws 422 when insufficient preferences", async () => {
      // getActiveRound — no active rounds
      mockSend.mockResolvedValueOnce({ Items: [] });
      // getSuggestions throws ValidationError
      const err = new Error("At least 2 members must set preferences");
      (err as any).name = "ValidationError";
      mockSuggestionService.getSuggestions.mockRejectedValueOnce(err);

      await expect(
        service.createRound("g-1", "user-1"),
      ).rejects.toThrow("At least 2 members must set preferences");
    });

    it("includes watchlist movies when include_watchlist is true", async () => {
      // getActiveRound — no active rounds
      mockSend.mockResolvedValueOnce({ Items: [] });
      // Watchlist items
      mockWatchlistService.getWatchlist.mockResolvedValueOnce([
        {
          group_id: "g-1",
          tmdb_movie_id: 120,
          title: "LOTR",
          poster_path: "/lotr.jpg",
          year: 2001,
          genres: ["Adventure", "Fantasy"],
          content_rating: "PG-13",
          added_by: "user-1",
          added_at: "2026-01-01T00:00:00Z",
        },
      ]);
      // PutCommand for round
      mockSend.mockResolvedValueOnce({});
      // Post-write recheck getActiveRound — no other active round
      mockSend.mockResolvedValueOnce({ Items: [] });
      // PutCommand for each suggestion (2 algo + 1 watchlist)
      mockSend.mockResolvedValueOnce({});
      mockSend.mockResolvedValueOnce({});
      mockSend.mockResolvedValueOnce({});

      const result = await service.createRound("g-1", "user-1", {
        include_watchlist: true,
      });

      expect(result.suggestions).toHaveLength(3);
      const watchlistItem = result.suggestions.find((s) => s.source === "watchlist");
      expect(watchlistItem).toBeDefined();
      expect(watchlistItem!.tmdb_movie_id).toBe(120);
      expect(watchlistItem!.reason).toBe("From your watchlist");
      expect(result.watchlist_eligible_count).toBe(1);
    });

    it("caps watchlist movies at 4", async () => {
      // getActiveRound — no active rounds
      mockSend.mockResolvedValueOnce({ Items: [] });
      // 6 watchlist items
      mockWatchlistService.getWatchlist.mockResolvedValueOnce(
        Array.from({ length: 6 }, (_, i) => ({
          group_id: "g-1",
          tmdb_movie_id: 1000 + i,
          title: `Movie ${i}`,
          poster_path: `/m${i}.jpg`,
          year: 2020 + i,
          genres: ["Drama"],
          content_rating: "PG",
          added_by: "user-1",
          added_at: `2026-01-0${i + 1}T00:00:00Z`,
        })),
      );
      // PutCommand for round
      mockSend.mockResolvedValueOnce({});
      // Post-write recheck getActiveRound — no other active round
      mockSend.mockResolvedValueOnce({ Items: [] });
      // PutCommand for each suggestion (2 algo + 4 watchlist = 6)
      for (let i = 0; i < 6; i++) {
        mockSend.mockResolvedValueOnce({});
      }

      const result = await service.createRound("g-1", "user-1", {
        include_watchlist: true,
      });

      const watchlistItems = result.suggestions.filter((s) => s.source === "watchlist");
      expect(watchlistItems).toHaveLength(4);
      expect(result.watchlist_eligible_count).toBe(6);
    });

    it("excludes watched watchlist movies", async () => {
      // getActiveRound — no active rounds
      mockSend.mockResolvedValueOnce({ Items: [] });
      // Watchlist has one movie that's been watched
      mockWatchlistService.getWatchlist.mockResolvedValueOnce([
        {
          group_id: "g-1",
          tmdb_movie_id: 999,
          title: "Watched Movie",
          poster_path: "/w.jpg",
          year: 2020,
          genres: ["Drama"],
          content_rating: "PG",
          added_by: "user-1",
          added_at: "2026-01-01T00:00:00Z",
        },
      ]);
      mockWatchedService.getAllWatchedMovieIds.mockResolvedValueOnce(new Set([999]));
      // PutCommand for round
      mockSend.mockResolvedValueOnce({});
      // Post-write recheck getActiveRound — no other active round
      mockSend.mockResolvedValueOnce({ Items: [] });
      // PutCommand for each suggestion (2 algo)
      mockSend.mockResolvedValueOnce({});
      mockSend.mockResolvedValueOnce({});

      const result = await service.createRound("g-1", "user-1", {
        include_watchlist: true,
      });

      const watchlistItems = result.suggestions.filter((s) => s.source === "watchlist");
      expect(watchlistItems).toHaveLength(0);
      expect(result.watchlist_eligible_count).toBe(0);
    });

    it("uses only algorithm suggestions when include_watchlist is false", async () => {
      // getActiveRound — no active rounds
      mockSend.mockResolvedValueOnce({ Items: [] });
      // PutCommand for round
      mockSend.mockResolvedValueOnce({});
      // Post-write recheck getActiveRound — no other active round
      mockSend.mockResolvedValueOnce({ Items: [] });
      // PutCommand for each suggestion (2 algo)
      mockSend.mockResolvedValueOnce({});
      mockSend.mockResolvedValueOnce({});

      const result = await service.createRound("g-1", "user-1", {
        include_watchlist: false,
      });

      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions.every((s) => s.source === "algorithm")).toBe(true);
      expect(mockWatchlistService.getWatchlist).not.toHaveBeenCalled();
    });

    it("handles empty watchlist gracefully with include_watchlist=true", async () => {
      // getActiveRound — no active rounds
      mockSend.mockResolvedValueOnce({ Items: [] });
      // Empty watchlist
      mockWatchlistService.getWatchlist.mockResolvedValueOnce([]);
      // PutCommand for round
      mockSend.mockResolvedValueOnce({});
      // Post-write recheck getActiveRound — no other active round
      mockSend.mockResolvedValueOnce({ Items: [] });
      // PutCommand for each suggestion (2 algo)
      mockSend.mockResolvedValueOnce({});
      mockSend.mockResolvedValueOnce({});

      const result = await service.createRound("g-1", "user-1", {
        include_watchlist: true,
      });

      expect(result.suggestions).toHaveLength(2);
      expect(result.watchlist_eligible_count).toBe(0);
    });

    it("passes exclude_movie_ids to suggestion service", async () => {
      // getActiveRound — no active rounds
      mockSend.mockResolvedValueOnce({ Items: [] });
      // PutCommand for round
      mockSend.mockResolvedValueOnce({});
      // Post-write recheck getActiveRound — no other active round
      mockSend.mockResolvedValueOnce({ Items: [] });
      // PutCommand for each suggestion (2)
      mockSend.mockResolvedValueOnce({});
      mockSend.mockResolvedValueOnce({});

      await service.createRound("g-1", "user-1", {
        exclude_movie_ids: [550, 680],
      });

      expect(mockSuggestionService.getSuggestions).toHaveBeenCalledWith(
        "g-1",
        [550, 680],
        undefined,
      );
    });

    it("persists attendees on the round when provided", async () => {
      // getActiveRound — no active rounds
      mockSend.mockResolvedValueOnce({ Items: [] });
      // getMembers for attendee validation
      mockGroupService.getMembers.mockResolvedValueOnce([
        { user_id: "user-1", display_name: "Alice", role: "creator" },
        { user_id: "user-2", display_name: "Bob", role: "member" },
        { user_id: "user-3", display_name: "Carol", role: "member" },
      ]);
      // PutCommand for round
      mockSend.mockResolvedValueOnce({});
      // Post-write recheck getActiveRound
      mockSend.mockResolvedValueOnce({ Items: [] });
      // PutCommand for each suggestion (2)
      mockSend.mockResolvedValueOnce({});
      mockSend.mockResolvedValueOnce({});

      const result = await service.createRound("g-1", "user-1", {
        attendees: ["user-1", "user-2"],
      });

      expect(result.round.attendees).toEqual(["user-1", "user-2"]);
      // Verify suggestions were scoped to attendees
      expect(mockSuggestionService.getSuggestions).toHaveBeenCalledWith(
        "g-1",
        [],
        ["user-1", "user-2"],
      );
    });

    it("throws ValidationError for non-member attendees", async () => {
      // getActiveRound — no active rounds
      mockSend.mockResolvedValueOnce({ Items: [] });
      // getMembers — only user-1 and user-2 exist
      mockGroupService.getMembers.mockResolvedValueOnce([
        { user_id: "user-1", display_name: "Alice", role: "creator" },
        { user_id: "user-2", display_name: "Bob", role: "member" },
      ]);

      await expect(
        service.createRound("g-1", "user-1", {
          attendees: ["user-1", "user-99"],
        }),
      ).rejects.toThrow("Invalid attendees: user-99 are not members of this group");
    });
  });

  describe("getRound", () => {
    it("returns suggestions with vote counts and progress", async () => {
      // GetCommand for round
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      // QueryCommand for suggestions
      mockSend.mockResolvedValueOnce({
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
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            round_id: "r-1",
            vote_key: "550#user-1",
            tmdb_movie_id: 550,
            user_id: "user-1",
            vote: "up",
            voted_at: "2026-02-21T20:15:00Z",
          },
          {
            round_id: "r-1",
            vote_key: "550#user-2",
            tmdb_movie_id: 550,
            user_id: "user-2",
            vote: "down",
            voted_at: "2026-02-21T20:16:00Z",
          },
        ],
      });

      const result = await service.getRound("r-1");

      expect(result.round_id).toBe("r-1");
      expect(result.status).toBe("voting");
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].votes).toEqual({ up: 1, down: 1 });
      expect(result.suggestions[0].voters).toHaveLength(2);
      expect(result.vote_progress).toEqual({ voted: 2, total: 2 });
      expect(result.pick).toBeNull();
    });

    it("returns vote progress correctly", async () => {
      // Round
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      // Suggestions
      mockSend.mockResolvedValueOnce({ Items: [] });
      // Votes — only user-1 has voted
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            round_id: "r-1",
            vote_key: "550#user-1",
            tmdb_movie_id: 550,
            user_id: "user-1",
            vote: "up",
            voted_at: "2026-02-21T20:15:00Z",
          },
        ],
      });

      const result = await service.getRound("r-1");

      expect(result.vote_progress).toEqual({ voted: 1, total: 2 });
    });

    it("throws NotFoundError for unknown round", async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      await expect(service.getRound("r-nonexistent")).rejects.toThrow("Round not found");
    });
  });

  describe("closeRound", () => {
    it("closes a voting round by creator", async () => {
      // getRoundBasic
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      // requireMember returns creator
      mockGroupService.requireMember.mockResolvedValueOnce({
        user_id: "user-1",
        role: "creator",
      });
      // UpdateCommand
      mockSend.mockResolvedValueOnce({
        Attributes: {
          round_id: "r-1",
          group_id: "g-1",
          status: "closed",
          closed_at: "2026-02-21T21:00:00Z",
        },
      });

      const result = await service.closeRound("r-1", "user-1");

      expect(result.status).toBe("closed");
    });

    it("throws ForbiddenError for non-creator", async () => {
      // getRoundBasic
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      // requireMember returns member (not creator)
      mockGroupService.requireMember.mockResolvedValueOnce({
        user_id: "user-2",
        role: "member",
      });

      await expect(service.closeRound("r-1", "user-2")).rejects.toThrow(
        "Only the group creator can close a round",
      );
    });

    it("throws ConflictError when round is already closed", async () => {
      // getRoundBasic
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "closed",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      mockGroupService.requireMember.mockResolvedValueOnce({
        user_id: "user-1",
        role: "creator",
      });

      await expect(service.closeRound("r-1", "user-1")).rejects.toThrow(
        "Round is in 'closed' status, cannot close",
      );
    });

    it("throws ConflictError when round is already selected", async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "selected",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      mockGroupService.requireMember.mockResolvedValueOnce({
        user_id: "user-1",
        role: "creator",
      });

      await expect(service.closeRound("r-1", "user-1")).rejects.toThrow(
        "Round is in 'selected' status, cannot close",
      );
    });
  });

  describe("status normalization", () => {
    it("normalizes legacy 'picked' to 'selected' in getRoundBasic", async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "picked",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });

      const result = await service.getRoundBasic("r-1");

      expect(result).not.toBeNull();
      expect(result!.status).toBe("selected");
    });

    it("normalizes legacy 'picked' to 'selected' in getRound response", async () => {
      // GetCommand for round with legacy 'picked' status
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "picked",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
          pick_id: "p-1",
        },
      });
      // QueryCommand for suggestions
      mockSend.mockResolvedValueOnce({ Items: [] });
      // QueryCommand for votes
      mockSend.mockResolvedValueOnce({ Items: [] });
      // GetCommand for pick
      mockSend.mockResolvedValueOnce({ Item: undefined });

      const result = await service.getRound("r-1");

      expect(result.status).toBe("selected");
    });

    it("normalizes legacy 'picked' to 'selected' in getActiveRound", async () => {
      // All rounds have legacy 'picked' status — none should be active
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", group_id: "g-1", status: "picked", created_at: "2026-02-20T20:00:00Z" },
        ],
      });

      const result = await service.getActiveRound("g-1");

      expect(result).toBeNull();
    });

    it("normalizes legacy 'picked' to 'selected' in getRoundsForGroup", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", group_id: "g-1", status: "picked", created_at: "2026-02-20T20:00:00Z" },
          { round_id: "r-2", group_id: "g-1", status: "voting", created_at: "2026-02-21T20:00:00Z" },
        ],
      });

      const result = await service.getRoundsForGroup("g-1");

      expect(result[0].status).toBe("selected");
      expect(result[1].status).toBe("voting");
    });
  });

  describe("getActiveRound", () => {
    it("returns active voting round", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-2", group_id: "g-1", status: "selected", created_at: "2026-02-21T20:00:00Z" },
          { round_id: "r-3", group_id: "g-1", status: "voting", created_at: "2026-02-22T20:00:00Z" },
        ],
      });

      const result = await service.getActiveRound("g-1");

      expect(result).not.toBeNull();
      expect(result!.round_id).toBe("r-3");
      expect(result!.status).toBe("voting");
    });

    it("returns null when no active round", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", group_id: "g-1", status: "selected", created_at: "2026-02-20T20:00:00Z" },
        ],
      });

      const result = await service.getActiveRound("g-1");

      expect(result).toBeNull();
    });
  });

  describe("pickMovie", () => {
    let serviceWithPick: RoundService;
    let mockPickService: { createPickForRound: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      const client = createMockDocClient();
      mockSend = client.send;
      mockGroupService = createMockGroupService();
      mockSuggestionService = createMockSuggestionService();
      mockWatchlistService = createMockWatchlistService();
      mockWatchedService = createMockWatchedService();
      mockPickService = {
        createPickForRound: vi.fn().mockResolvedValue({
          pick_id: "p-1",
          round_id: "r-1",
          group_id: "g-1",
          tmdb_movie_id: 550,
          picked_by: "user-1",
          picked_at: "2026-02-21T21:00:00Z",
          watched: false,
          watched_at: null,
        }),
      };

      serviceWithPick = new RoundService(
        client as any,
        "test-rounds",
        "test-suggestions",
        "test-votes",
        "test-picks",
        mockGroupService as any,
        mockSuggestionService as any,
        mockWatchlistService as any,
        mockWatchedService as any,
        mockPickService as any,
      );
    });

    it("picks a movie and transitions round to picked", async () => {
      // getRoundBasic
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      // requireMember returns creator
      mockGroupService.requireMember.mockResolvedValueOnce({
        user_id: "user-1",
        role: "creator",
      });
      // GetCommand for suggestion
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          tmdb_movie_id: 550,
          title: "Fight Club",
          poster_path: "/pB8...",
        },
      });
      // UpdateCommand for round status
      mockSend.mockResolvedValueOnce({});

      const result = await serviceWithPick.pickMovie("r-1", 550, "user-1");

      expect(result.pick_id).toBe("p-1");
      expect(result.tmdb_movie_id).toBe(550);
      expect(mockPickService.createPickForRound).toHaveBeenCalledWith({
        group_id: "g-1",
        round_id: "r-1",
        tmdb_movie_id: 550,
        picked_by: "user-1",
        title: "Fight Club",
        poster_path: "/pB8...",
      });

      // Verify round status updated to 'picked' with atomic condition
      const updateCmd = mockSend.mock.calls[2][0];
      expect(updateCmd.input.ExpressionAttributeValues[":s"]).toBe("selected");
      expect(updateCmd.input.ExpressionAttributeValues[":pid"]).toBe("p-1");
      expect(updateCmd.input.ConditionExpression).toBe("attribute_not_exists(pick_id)");
    });

    it("allows pick when round is closed", async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "closed",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      mockGroupService.requireMember.mockResolvedValueOnce({
        user_id: "user-1",
        role: "creator",
      });
      mockSend.mockResolvedValueOnce({
        Item: { round_id: "r-1", tmdb_movie_id: 550, title: "Fight Club", poster_path: null },
      });
      mockSend.mockResolvedValueOnce({});

      const result = await serviceWithPick.pickMovie("r-1", 550, "user-1");

      expect(result.pick_id).toBe("p-1");
    });

    it("throws ForbiddenError for non-creator", async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      mockGroupService.requireMember.mockResolvedValueOnce({
        user_id: "user-2",
        role: "member",
      });

      await expect(
        serviceWithPick.pickMovie("r-1", 550, "user-2"),
      ).rejects.toThrow("Only the group creator can pick a movie");
    });

    it("throws ConflictError when round is already selected", async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "selected",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      mockGroupService.requireMember.mockResolvedValueOnce({
        user_id: "user-1",
        role: "creator",
      });

      await expect(
        serviceWithPick.pickMovie("r-1", 550, "user-1"),
      ).rejects.toThrow("Round is in 'selected' status, cannot pick");
    });

    it("throws ValidationError when movie not in round", async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      mockGroupService.requireMember.mockResolvedValueOnce({
        user_id: "user-1",
        role: "creator",
      });
      // Suggestion not found
      mockSend.mockResolvedValueOnce({ Item: undefined });

      await expect(
        serviceWithPick.pickMovie("r-1", 999, "user-1"),
      ).rejects.toThrow("Movie not in this round");
    });

    it("throws NotFoundError when round not found", async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      await expect(
        serviceWithPick.pickMovie("r-missing", 550, "user-1"),
      ).rejects.toThrow("Round not found");
    });
  });

  describe("persistSuggestions", () => {
    it("writes each suggestion to DynamoDB", async () => {
      mockSend.mockResolvedValue({});

      const suggestions = [
        {
          tmdb_movie_id: 550,
          title: "Fight Club",
          year: 1999,
          poster_path: "/pB8...",
          overview: "A ticking-time-bomb...",
          genres: ["Drama"],
          content_rating: "R" as const,
          popularity: 61.4,
          vote_average: 8.4,
          streaming: [],
          score: 0.85,
          reason: "Matches your taste.",
          source: "algorithm" as const,
        },
      ];

      const result = await service.persistSuggestions("r-1", suggestions);

      expect(result).toHaveLength(1);
      expect(result[0].round_id).toBe("r-1");
      expect(result[0].tmdb_movie_id).toBe(550);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe("transitionStatus", () => {
    it("transitions selected → watched for any member", async () => {
      // getRoundBasic
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "selected",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      // requireMember returns regular member
      mockGroupService.requireMember.mockResolvedValueOnce({
        user_id: "user-2",
        role: "member",
      });
      // UpdateCommand
      mockSend.mockResolvedValueOnce({
        Attributes: {
          round_id: "r-1",
          group_id: "g-1",
          status: "watched",
          watched_at: "2026-02-22T00:00:00Z",
        },
      });

      const result = await service.transitionStatus("r-1", "watched", "user-2");

      expect(result.status).toBe("watched");
    });

    it("transitions watched → rated for creator", async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "watched",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      mockGroupService.requireMember.mockResolvedValueOnce({
        user_id: "user-1",
        role: "creator",
      });
      mockSend.mockResolvedValueOnce({
        Attributes: {
          round_id: "r-1",
          group_id: "g-1",
          status: "rated",
          rated_at: "2026-02-22T01:00:00Z",
        },
      });

      const result = await service.transitionStatus("r-1", "rated", "user-1");

      expect(result.status).toBe("rated");
    });

    it("throws ForbiddenError when non-creator tries watched → rated", async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "watched",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      mockGroupService.requireMember.mockResolvedValueOnce({
        user_id: "user-2",
        role: "member",
      });

      await expect(
        service.transitionStatus("r-1", "rated", "user-2"),
      ).rejects.toThrow("Only the group creator can close ratings");
    });

    it("throws ConflictError for invalid transition voting → watched", async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      mockGroupService.requireMember.mockResolvedValueOnce({
        user_id: "user-1",
        role: "creator",
      });

      await expect(
        service.transitionStatus("r-1", "watched", "user-1"),
      ).rejects.toThrow("Cannot transition from 'voting' to 'watched'");
    });

    it("throws ConflictError for invalid transition selected → rated", async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "selected",
          started_by: "user-1",
          created_at: "2026-02-21T20:00:00Z",
        },
      });
      mockGroupService.requireMember.mockResolvedValueOnce({
        user_id: "user-1",
        role: "creator",
      });

      await expect(
        service.transitionStatus("r-1", "rated", "user-1"),
      ).rejects.toThrow("Cannot transition from 'selected' to 'rated'");
    });

    it("throws NotFoundError when round does not exist", async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      await expect(
        service.transitionStatus("r-missing", "watched", "user-1"),
      ).rejects.toThrow("Round not found");
    });
  });
});
