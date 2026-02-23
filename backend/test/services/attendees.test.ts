import { describe, it, expect, vi, beforeEach } from "vitest";
import { VoteService } from "../../src/services/vote-service.js";
import { PreferenceService } from "../../src/services/preference-service.js";

function createMockDocClient() {
  return { send: vi.fn() };
}

describe("Attendee-scoped features (Slice C2)", () => {
  describe("VoteService.getVoteProgress with attendees", () => {
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

    it("uses attendees as denominator when provided", async () => {
      // Votes query — u1 and u3 voted
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", vote_key: "550#u1", user_id: "u1", tmdb_movie_id: 550, vote: "up" },
          { round_id: "r-1", vote_key: "550#u3", user_id: "u3", tmdb_movie_id: 550, vote: "up" },
          { round_id: "r-1", vote_key: "550#u5", user_id: "u5", tmdb_movie_id: 550, vote: "down" },
        ],
      });
      // No members query needed when attendees provided

      const progress = await service.getVoteProgress("r-1", "g-1", ["u1", "u3"]);

      // 2 attendees, both voted → 2/2
      expect(progress).toEqual({ voted: 2, total: 2 });
      // Should NOT query memberships table
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("only counts attendee votes, ignoring non-attendee votes", async () => {
      // u1 (attendee) and u5 (non-attendee) voted
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", vote_key: "550#u1", user_id: "u1", tmdb_movie_id: 550, vote: "up" },
          { round_id: "r-1", vote_key: "550#u5", user_id: "u5", tmdb_movie_id: 550, vote: "down" },
        ],
      });

      const progress = await service.getVoteProgress("r-1", "g-1", ["u1", "u2", "u3"]);

      // 3 attendees, only u1 voted → 1/3
      expect(progress).toEqual({ voted: 1, total: 3 });
    });

    it("falls back to all members when attendees is null", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", vote_key: "550#u1", user_id: "u1", tmdb_movie_id: 550, vote: "up" },
        ],
      });
      mockSend.mockResolvedValueOnce({
        Items: [{ user_id: "u1" }, { user_id: "u2" }, { user_id: "u3" }, { user_id: "u4" }],
      });

      const progress = await service.getVoteProgress("r-1", "g-1", null);

      expect(progress).toEqual({ voted: 1, total: 4 });
    });

    it("falls back to all members when attendees is empty", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { round_id: "r-1", vote_key: "550#u1", user_id: "u1", tmdb_movie_id: 550, vote: "up" },
        ],
      });
      mockSend.mockResolvedValueOnce({
        Items: [{ user_id: "u1" }, { user_id: "u2" }],
      });

      const progress = await service.getVoteProgress("r-1", "g-1", []);

      expect(progress).toEqual({ voted: 1, total: 2 });
    });

    it("falls back to all members when attendees is undefined", async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });
      mockSend.mockResolvedValueOnce({
        Items: [{ user_id: "u1" }, { user_id: "u2" }],
      });

      const progress = await service.getVoteProgress("r-1", "g-1", undefined);

      expect(progress).toEqual({ voted: 0, total: 2 });
    });
  });

  describe("PreferenceService.getGroupPreferenceSummaryForMembers", () => {
    let mockSend: ReturnType<typeof vi.fn>;
    let service: PreferenceService;

    beforeEach(() => {
      const client = createMockDocClient();
      mockSend = client.send;
      service = new PreferenceService(client as any, "test-preferences");
    });

    it("filters preferences to specified member IDs", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            group_id: "g-1",
            user_id: "u-1",
            genre_likes: ["28"],
            genre_dislikes: ["27"],
            max_content_rating: "R",
            updated_at: "2026-02-14T00:00:00Z",
          },
          {
            group_id: "g-1",
            user_id: "u-2",
            genre_likes: ["35"],
            genre_dislikes: ["27", "99"],
            max_content_rating: "PG",
            updated_at: "2026-02-14T00:00:00Z",
          },
          {
            group_id: "g-1",
            user_id: "u-3",
            genre_likes: ["16"],
            genre_dislikes: [],
            max_content_rating: "PG-13",
            updated_at: "2026-02-14T00:00:00Z",
          },
        ],
      });

      // Only include u-1 and u-3 as attendees
      const summary = await service.getGroupPreferenceSummaryForMembers("g-1", ["u-1", "u-3"]);

      // Liked genres: union of u-1 (28) and u-3 (16)
      expect(summary.liked_genres.sort()).toEqual(["16", "28"]);
      // Disliked genres: intersection of u-1 (27, 99) and u-3 () = empty
      expect(summary.disliked_genres).toEqual([]);
      // Max rating: min of R (u-1) and PG-13 (u-3) = PG-13
      expect(summary.max_content_rating).toBe("PG-13");
      expect(summary.member_count).toBe(2);
    });

    it("returns empty summary when no attendees have preferences", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            group_id: "g-1",
            user_id: "u-1",
            genre_likes: ["28"],
            genre_dislikes: [],
            max_content_rating: "PG",
            updated_at: "2026-02-14T00:00:00Z",
          },
        ],
      });

      // u-99 has no preferences
      const summary = await service.getGroupPreferenceSummaryForMembers("g-1", ["u-99"]);

      expect(summary.member_count).toBe(0);
      expect(summary.liked_genres).toEqual([]);
      expect(summary.max_content_rating).toBeNull();
    });
  });

  describe("VoteService.submitVote attendee enforcement", () => {
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

    it("rejects vote from non-attendee when round has attendees", async () => {
      // GetCommand for round — has attendees list
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
          attendees: ["u1", "u2"],
        },
      });
      // GetCommand for membership — user is a group member
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "u3", role: "member" },
      });

      await expect(
        service.submitVote("r-1", 550, "u3", "up"),
      ).rejects.toThrow("You are not an attendee of this round");
    });

    it("allows vote from attendee when round has attendees", async () => {
      // GetCommand for round
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
          attendees: ["u1", "u2"],
        },
      });
      // GetCommand for membership
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "u1", role: "member" },
      });
      // GetCommand for suggestion
      mockSend.mockResolvedValueOnce({
        Item: { round_id: "r-1", tmdb_movie_id: 550 },
      });
      // PutCommand for vote
      mockSend.mockResolvedValueOnce({});

      const result = await service.submitVote("r-1", 550, "u1", "up");

      expect(result.user_id).toBe("u1");
      expect(result.vote).toBe("up");
    });

    it("allows vote from any member when round has no attendees", async () => {
      // GetCommand for round — no attendees
      mockSend.mockResolvedValueOnce({
        Item: {
          round_id: "r-1",
          group_id: "g-1",
          status: "voting",
        },
      });
      // GetCommand for membership
      mockSend.mockResolvedValueOnce({
        Item: { group_id: "g-1", user_id: "u5", role: "member" },
      });
      // GetCommand for suggestion
      mockSend.mockResolvedValueOnce({
        Item: { round_id: "r-1", tmdb_movie_id: 550 },
      });
      // PutCommand for vote
      mockSend.mockResolvedValueOnce({});

      const result = await service.submitVote("r-1", 550, "u5", "down");

      expect(result.user_id).toBe("u5");
      expect(result.vote).toBe("down");
    });
  });
});
