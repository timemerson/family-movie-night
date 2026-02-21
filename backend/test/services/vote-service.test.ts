import { describe, it, expect, vi, beforeEach } from "vitest";
import { VoteService } from "../../src/services/vote-service.js";

function createMockDocClient() {
  return { send: vi.fn() };
}

describe("VoteService", () => {
  let mockSend: ReturnType<typeof vi.fn>;
  let service: VoteService;

  beforeEach(() => {
    const client = createMockDocClient();
    mockSend = client.send;
    service = new VoteService(
      client as any,
      "test-votes",
      "test-rounds",
      "test-suggestions",
      "test-memberships",
    );
  });

  describe("submitVote", () => {
    it("writes a thumbs up vote", async () => {
      // GetCommand for round
      mockSend.mockResolvedValueOnce({
        Item: { round_id: "r-1", group_id: "g-1", status: "voting" },
      });
      // GetCommand for membership
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-1", role: "member" },
      });
      // GetCommand for suggestion
      mockSend.mockResolvedValueOnce({
        Item: { round_id: "r-1", tmdb_movie_id: 550, title: "Fight Club" },
      });
      // PutCommand for vote
      mockSend.mockResolvedValueOnce({});

      const vote = await service.submitVote("r-1", 550, "user-1", "up");

      expect(vote.round_id).toBe("r-1");
      expect(vote.tmdb_movie_id).toBe(550);
      expect(vote.user_id).toBe("user-1");
      expect(vote.vote).toBe("up");
      expect(vote.vote_key).toBe("550#user-1");
      expect(vote.voted_at).toBeTruthy();
    });

    it("writes a thumbs down vote", async () => {
      mockSend.mockResolvedValueOnce({
        Item: { round_id: "r-1", group_id: "g-1", status: "voting" },
      });
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-1", role: "member" },
      });
      mockSend.mockResolvedValueOnce({
        Item: { round_id: "r-1", tmdb_movie_id: 550 },
      });
      mockSend.mockResolvedValueOnce({});

      const vote = await service.submitVote("r-1", 550, "user-1", "down");

      expect(vote.vote).toBe("down");
    });

    it("overwrites existing vote (change vote)", async () => {
      mockSend.mockResolvedValueOnce({
        Item: { round_id: "r-1", group_id: "g-1", status: "voting" },
      });
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-1", role: "member" },
      });
      mockSend.mockResolvedValueOnce({
        Item: { round_id: "r-1", tmdb_movie_id: 550 },
      });
      mockSend.mockResolvedValueOnce({});

      const vote = await service.submitVote("r-1", 550, "user-1", "down");

      expect(vote.vote).toBe("down");
      // PutItem is the 4th call — uses same vote_key so it overwrites
      const putCmd = mockSend.mock.calls[3][0];
      expect(putCmd.input.Item.vote_key).toBe("550#user-1");
    });

    it("throws ValidationError when round is not voting", async () => {
      mockSend.mockResolvedValueOnce({
        Item: { round_id: "r-1", group_id: "g-1", status: "closed" },
      });

      await expect(
        service.submitVote("r-1", 550, "user-1", "up"),
      ).rejects.toThrow("Round is not accepting votes");
    });

    it("throws ValidationError when movie not in round", async () => {
      mockSend.mockResolvedValueOnce({
        Item: { round_id: "r-1", group_id: "g-1", status: "voting" },
      });
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "user-1", role: "member" },
      });
      // Suggestion not found
      mockSend.mockResolvedValueOnce({ Item: undefined });

      await expect(
        service.submitVote("r-1", 999, "user-1", "up"),
      ).rejects.toThrow("Movie not in this round");
    });

    it("throws ForbiddenError for non-member", async () => {
      mockSend.mockResolvedValueOnce({
        Item: { round_id: "r-1", group_id: "g-1", status: "voting" },
      });
      // Not a member
      mockSend.mockResolvedValueOnce({ Item: undefined });

      await expect(
        service.submitVote("r-1", 550, "user-999", "up"),
      ).rejects.toThrow("Not a member");
    });

    it("throws NotFoundError for unknown round", async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      await expect(
        service.submitVote("r-nonexistent", 550, "user-1", "up"),
      ).rejects.toThrow("Round not found");
    });
  });

  describe("getRoundResults", () => {
    const memberNames = new Map([
      ["user-1", "Alice"],
      ["user-2", "Bob"],
      ["user-3", "Charlie"],
    ]);

    it("ranks by net score descending", async () => {
      // Suggestions
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", tmdb_movie_id: 550, title: "Fight Club", poster_path: "/pB8...", source: "algorithm", popularity: 61.4 },
          { round_id: "r-1", tmdb_movie_id: 680, title: "Pulp Fiction", poster_path: "/d5i...", source: "algorithm", popularity: 55.0 },
        ],
      });
      // Votes query
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", vote_key: "550#user-1", tmdb_movie_id: 550, user_id: "user-1", vote: "up" },
          { round_id: "r-1", vote_key: "550#user-2", tmdb_movie_id: 550, user_id: "user-2", vote: "up" },
          { round_id: "r-1", vote_key: "550#user-3", tmdb_movie_id: 550, user_id: "user-3", vote: "down" },
          { round_id: "r-1", vote_key: "680#user-1", tmdb_movie_id: 680, user_id: "user-1", vote: "down" },
          { round_id: "r-1", vote_key: "680#user-2", tmdb_movie_id: 680, user_id: "user-2", vote: "down" },
        ],
      });

      const results = await service.getRoundResults("r-1", memberNames);

      expect(results).toHaveLength(2);
      // Fight Club: 2 up - 1 down = net +1
      expect(results[0].tmdb_movie_id).toBe(550);
      expect(results[0].net_score).toBe(1);
      expect(results[0].rank).toBe(1);
      // Pulp Fiction: 0 up - 2 down = net -2
      expect(results[1].tmdb_movie_id).toBe(680);
      expect(results[1].net_score).toBe(-2);
      expect(results[1].rank).toBe(2);
    });

    it("breaks ties by TMDB popularity", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", tmdb_movie_id: 550, title: "Fight Club", poster_path: "/pB8...", source: "algorithm", popularity: 61.4 },
          { round_id: "r-1", tmdb_movie_id: 680, title: "Pulp Fiction", poster_path: "/d5i...", source: "algorithm", popularity: 55.0 },
        ],
      });
      // Same net score
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", vote_key: "550#user-1", tmdb_movie_id: 550, user_id: "user-1", vote: "up" },
          { round_id: "r-1", vote_key: "680#user-1", tmdb_movie_id: 680, user_id: "user-1", vote: "up" },
        ],
      });

      const results = await service.getRoundResults("r-1", memberNames);

      // Both net_score = 1, Fight Club higher popularity
      expect(results[0].tmdb_movie_id).toBe(550);
      expect(results[1].tmdb_movie_id).toBe(680);
      expect(results[0].tied).toBe(false);
      expect(results[1].tied).toBe(false);
    });

    it("flags tied movies when net score and popularity are equal", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", tmdb_movie_id: 550, title: "Movie A", poster_path: null, source: "algorithm", popularity: 50.0 },
          { round_id: "r-1", tmdb_movie_id: 680, title: "Movie B", poster_path: null, source: "algorithm", popularity: 50.0 },
        ],
      });
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", vote_key: "550#user-1", tmdb_movie_id: 550, user_id: "user-1", vote: "up" },
          { round_id: "r-1", vote_key: "680#user-1", tmdb_movie_id: 680, user_id: "user-1", vote: "up" },
        ],
      });

      const results = await service.getRoundResults("r-1", memberNames);

      expect(results[0].tied).toBe(true);
      expect(results[1].tied).toBe(true);
      expect(results[0].rank).toBe(1);
      expect(results[1].rank).toBe(1);
    });

    it("handles zero votes — all at score 0", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", tmdb_movie_id: 550, title: "Movie A", poster_path: null, source: "algorithm", popularity: 50.0 },
          { round_id: "r-1", tmdb_movie_id: 680, title: "Movie B", poster_path: null, source: "algorithm", popularity: 50.0 },
        ],
      });
      mockSend.mockResolvedValueOnce({ Items: [] });

      const results = await service.getRoundResults("r-1", memberNames);

      expect(results.every((r) => r.net_score === 0)).toBe(true);
      expect(results.every((r) => r.rank === 1)).toBe(true);
      expect(results.every((r) => r.tied === true)).toBe(true);
    });

    it("single voter determines ranking", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", tmdb_movie_id: 550, title: "Movie A", poster_path: null, source: "algorithm", popularity: 50.0 },
          { round_id: "r-1", tmdb_movie_id: 680, title: "Movie B", poster_path: null, source: "algorithm", popularity: 50.0 },
        ],
      });
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", vote_key: "550#user-1", tmdb_movie_id: 550, user_id: "user-1", vote: "up" },
          { round_id: "r-1", vote_key: "680#user-1", tmdb_movie_id: 680, user_id: "user-1", vote: "down" },
        ],
      });

      const results = await service.getRoundResults("r-1", memberNames);

      expect(results[0].tmdb_movie_id).toBe(550);
      expect(results[0].net_score).toBe(1);
      expect(results[1].tmdb_movie_id).toBe(680);
      expect(results[1].net_score).toBe(-1);
    });

    it("includes voter display names", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", tmdb_movie_id: 550, title: "Movie A", poster_path: null, source: "algorithm", popularity: 50.0 },
        ],
      });
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", vote_key: "550#user-1", tmdb_movie_id: 550, user_id: "user-1", vote: "up" },
        ],
      });

      const results = await service.getRoundResults("r-1", memberNames);

      expect(results[0].voters).toHaveLength(1);
      expect(results[0].voters[0].display_name).toBe("Alice");
      expect(results[0].voters[0].vote).toBe("up");
    });
  });

  describe("getVoteProgress", () => {
    it("returns 0 of 4 when nobody voted", async () => {
      // Votes query
      mockSend.mockResolvedValueOnce({ Items: [] });
      // Members query
      mockSend.mockResolvedValueOnce({
        Items: [
          { user_id: "u1" },
          { user_id: "u2" },
          { user_id: "u3" },
          { user_id: "u4" },
        ],
      });

      const progress = await service.getVoteProgress("r-1", "g-1");

      expect(progress).toEqual({ voted: 0, total: 4 });
    });

    it("returns 3 of 4 when 3 have voted", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", vote_key: "550#u1", user_id: "u1", tmdb_movie_id: 550, vote: "up" },
          { round_id: "r-1", vote_key: "550#u2", user_id: "u2", tmdb_movie_id: 550, vote: "down" },
          { round_id: "r-1", vote_key: "680#u1", user_id: "u1", tmdb_movie_id: 680, vote: "up" },
          { round_id: "r-1", vote_key: "550#u3", user_id: "u3", tmdb_movie_id: 550, vote: "up" },
        ],
      });
      mockSend.mockResolvedValueOnce({
        Items: [{ user_id: "u1" }, { user_id: "u2" }, { user_id: "u3" }, { user_id: "u4" }],
      });

      const progress = await service.getVoteProgress("r-1", "g-1");

      expect(progress).toEqual({ voted: 3, total: 4 });
    });

    it("returns all voted", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", vote_key: "550#u1", user_id: "u1", tmdb_movie_id: 550, vote: "up" },
          { round_id: "r-1", vote_key: "550#u2", user_id: "u2", tmdb_movie_id: 550, vote: "up" },
        ],
      });
      mockSend.mockResolvedValueOnce({
        Items: [{ user_id: "u1" }, { user_id: "u2" }],
      });

      const progress = await service.getVoteProgress("r-1", "g-1");

      expect(progress).toEqual({ voted: 2, total: 2 });
    });
  });

  describe("getUserVotesForRound", () => {
    it("returns only the specified user's votes", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", vote_key: "550#user-1", user_id: "user-1", tmdb_movie_id: 550, vote: "up" },
          { round_id: "r-1", vote_key: "680#user-1", user_id: "user-1", tmdb_movie_id: 680, vote: "down" },
          { round_id: "r-1", vote_key: "550#user-2", user_id: "user-2", tmdb_movie_id: 550, vote: "up" },
        ],
      });

      const userVotes = await service.getUserVotesForRound("r-1", "user-1");

      expect(userVotes).toHaveLength(2);
      expect(userVotes.every((v) => v.user_id === "user-1")).toBe(true);
    });
  });

  describe("concurrency", () => {
    it("two users vote on same movie — both succeed (different items)", async () => {
      const roundItem = { round_id: "r-1", group_id: "g-1", status: "voting" };
      const suggestionItem = { round_id: "r-1", tmdb_movie_id: 550 };

      // Use mockImplementation to handle interleaved calls
      let callIdx = 0;
      mockSend.mockImplementation(() => {
        callIdx++;
        // Round checks (calls 1, 5)
        // Membership checks (calls 2, 6)
        // Suggestion checks (calls 3, 7)
        // Vote writes (calls 4, 8)
        if (callIdx <= 4) {
          // User A's 4 calls
          if (callIdx === 1) return Promise.resolve({ Item: roundItem });
          if (callIdx === 2) return Promise.resolve({ Item: { group_id: "g-1", user_id: "userA" } });
          if (callIdx === 3) return Promise.resolve({ Item: suggestionItem });
          return Promise.resolve({});
        }
        // User B's 4 calls
        if (callIdx === 5) return Promise.resolve({ Item: roundItem });
        if (callIdx === 6) return Promise.resolve({ Item: { group_id: "g-1", user_id: "userB" } });
        if (callIdx === 7) return Promise.resolve({ Item: suggestionItem });
        return Promise.resolve({});
      });

      // Run sequentially to test that different vote_keys are written
      const voteA = await service.submitVote("r-1", 550, "userA", "up");
      const voteB = await service.submitVote("r-1", 550, "userB", "down");

      expect(voteA.vote_key).toBe("550#userA");
      expect(voteB.vote_key).toBe("550#userB");
      expect(voteA.vote).toBe("up");
      expect(voteB.vote).toBe("down");
      // Verify 8 total DynamoDB calls (4 per user)
      expect(callIdx).toBe(8);
    });

    it("same user rapid-fire votes — last write wins", async () => {
      // First vote
      mockSend.mockResolvedValueOnce({ Item: { round_id: "r-1", group_id: "g-1", status: "voting" } });
      mockSend.mockResolvedValueOnce({ Item: { group_id: "g-1", user_id: "user-1" } });
      mockSend.mockResolvedValueOnce({ Item: { round_id: "r-1", tmdb_movie_id: 550 } });
      mockSend.mockResolvedValueOnce({});

      await service.submitVote("r-1", 550, "user-1", "up");

      // Second vote (overwrites)
      mockSend.mockResolvedValueOnce({ Item: { round_id: "r-1", group_id: "g-1", status: "voting" } });
      mockSend.mockResolvedValueOnce({ Item: { group_id: "g-1", user_id: "user-1" } });
      mockSend.mockResolvedValueOnce({ Item: { round_id: "r-1", tmdb_movie_id: 550 } });
      mockSend.mockResolvedValueOnce({});

      const vote2 = await service.submitVote("r-1", 550, "user-1", "down");

      expect(vote2.vote).toBe("down");
      expect(vote2.vote_key).toBe("550#user-1");
    });
  });
});
