import { describe, it, expect, vi, beforeEach } from "vitest";
import { RatingService } from "../../src/services/rating-service.js";

function createMockDocClient() {
  return { send: vi.fn() };
}

function createMockRoundService() {
  return {
    getRoundBasic: vi.fn(),
    transitionStatus: vi.fn(),
  };
}

function createMockGroupService() {
  return {
    getMembers: vi.fn(),
    requireMember: vi.fn(),
  };
}

describe("RatingService", () => {
  let mockSend: ReturnType<typeof vi.fn>;
  let mockRoundService: ReturnType<typeof createMockRoundService>;
  let mockGroupService: ReturnType<typeof createMockGroupService>;
  let service: RatingService;

  beforeEach(() => {
    const client = createMockDocClient();
    mockSend = client.send;
    mockRoundService = createMockRoundService();
    mockGroupService = createMockGroupService();
    service = new RatingService(
      client as any,
      "test-ratings",
      "test-users",
      mockRoundService as any,
      mockGroupService as any,
    );
  });

  describe("submitRating", () => {
    it("submits a rating when round is in watched status", async () => {
      mockRoundService.getRoundBasic.mockResolvedValueOnce({
        round_id: "round-1",
        group_id: "group-1",
        status: "watched",
      });
      mockSend.mockResolvedValueOnce({}); // PutCommand
      // checkAutoTransition: getMembers
      mockGroupService.getMembers.mockResolvedValueOnce([
        { user_id: "user-1" },
        { user_id: "user-2" },
      ]);
      // checkAutoTransition: QueryCommand for existing ratings
      mockSend.mockResolvedValueOnce({
        Items: [{ member_id: "user-1", rating: "loved" }],
      });

      const result = await service.submitRating("round-1", "user-1", "loved");

      expect(result.round_id).toBe("round-1");
      expect(result.member_id).toBe("user-1");
      expect(result.rating).toBe("loved");
      expect(result.rated_at).toBeDefined();
    });

    it("submits a rating when round is in selected status", async () => {
      mockRoundService.getRoundBasic.mockResolvedValueOnce({
        round_id: "round-1",
        group_id: "group-1",
        status: "selected",
      });
      mockSend.mockResolvedValueOnce({}); // PutCommand

      const result = await service.submitRating("round-1", "user-1", "liked");

      expect(result.rating).toBe("liked");
    });

    it("rejects rating when round is in voting status", async () => {
      mockRoundService.getRoundBasic.mockResolvedValueOnce({
        round_id: "round-1",
        group_id: "group-1",
        status: "voting",
      });

      await expect(
        service.submitRating("round-1", "user-1", "loved"),
      ).rejects.toThrow("ratings can only be submitted");
    });

    it("rejects rating when round is in rated status", async () => {
      mockRoundService.getRoundBasic.mockResolvedValueOnce({
        round_id: "round-1",
        group_id: "group-1",
        status: "rated",
      });

      await expect(
        service.submitRating("round-1", "user-1", "loved"),
      ).rejects.toThrow("ratings can only be submitted");
    });

    it("throws NotFoundError when round does not exist", async () => {
      mockRoundService.getRoundBasic.mockResolvedValueOnce(null);

      await expect(
        service.submitRating("round-missing", "user-1", "loved"),
      ).rejects.toThrow("Round not found");
    });

    it("auto-transitions to rated when all attendees have rated", async () => {
      mockRoundService.getRoundBasic.mockResolvedValueOnce({
        round_id: "round-1",
        group_id: "group-1",
        status: "watched",
      });
      mockSend.mockResolvedValueOnce({}); // PutCommand
      // checkAutoTransition: getMembers
      mockGroupService.getMembers.mockResolvedValueOnce([
        { user_id: "user-1" },
        { user_id: "user-2" },
      ]);
      // checkAutoTransition: QueryCommand — both members have rated
      mockSend.mockResolvedValueOnce({
        Items: [
          { member_id: "user-1", rating: "loved" },
          { member_id: "user-2", rating: "liked" },
        ],
      });
      mockRoundService.transitionStatus.mockResolvedValueOnce({});

      await service.submitRating("round-1", "user-2", "liked");

      expect(mockRoundService.transitionStatus).toHaveBeenCalledWith(
        "round-1",
        "rated",
        "",
        { system: true },
      );
    });

    it("does not auto-transition when not all attendees have rated", async () => {
      mockRoundService.getRoundBasic.mockResolvedValueOnce({
        round_id: "round-1",
        group_id: "group-1",
        status: "watched",
      });
      mockSend.mockResolvedValueOnce({}); // PutCommand
      // checkAutoTransition: getMembers
      mockGroupService.getMembers.mockResolvedValueOnce([
        { user_id: "user-1" },
        { user_id: "user-2" },
      ]);
      // checkAutoTransition: QueryCommand — only 1 of 2 rated
      mockSend.mockResolvedValueOnce({
        Items: [{ member_id: "user-1", rating: "loved" }],
      });

      await service.submitRating("round-1", "user-1", "loved");

      expect(mockRoundService.transitionStatus).not.toHaveBeenCalled();
    });

    it("skips auto-transition when round is not in watched status", async () => {
      mockRoundService.getRoundBasic.mockResolvedValueOnce({
        round_id: "round-1",
        group_id: "group-1",
        status: "selected",
      });
      mockSend.mockResolvedValueOnce({}); // PutCommand

      await service.submitRating("round-1", "user-1", "liked");

      // checkAutoTransition should bail out immediately for non-watched status
      expect(mockGroupService.getMembers).not.toHaveBeenCalled();
      expect(mockRoundService.transitionStatus).not.toHaveBeenCalled();
    });

    it("allows upsert (changing a rating)", async () => {
      mockRoundService.getRoundBasic.mockResolvedValueOnce({
        round_id: "round-1",
        group_id: "group-1",
        status: "watched",
      });
      mockSend.mockResolvedValueOnce({}); // PutCommand (upsert)
      // checkAutoTransition: getMembers
      mockGroupService.getMembers.mockResolvedValueOnce([
        { user_id: "user-1" },
        { user_id: "user-2" },
      ]);
      // checkAutoTransition: QueryCommand for existing ratings
      mockSend.mockResolvedValueOnce({
        Items: [{ member_id: "user-1", rating: "did_not_like" }],
      });

      const result = await service.submitRating(
        "round-1",
        "user-1",
        "did_not_like",
      );

      expect(result.rating).toBe("did_not_like");
    });
  });

  describe("getRatingsForSession", () => {
    it("returns all attendees with their rating status", async () => {
      mockRoundService.getRoundBasic.mockResolvedValueOnce({
        round_id: "round-1",
        group_id: "group-1",
        status: "watched",
        attendees: null,
      });

      // getMembers
      mockGroupService.getMembers.mockResolvedValueOnce([
        { group_id: "group-1", user_id: "user-1", role: "creator" },
        { group_id: "group-1", user_id: "user-2", role: "member" },
      ]);

      // QueryCommand for ratings
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            round_id: "round-1",
            member_id: "user-1",
            rating: "loved",
            rated_at: "2026-02-22T00:00:00Z",
          },
        ],
      });

      // GetCommand for user-1 details
      mockSend.mockResolvedValueOnce({
        Item: {
          user_id: "user-1",
          display_name: "Tim",
          avatar_key: "avatar_bear",
        },
      });

      // GetCommand for user-2 details
      mockSend.mockResolvedValueOnce({
        Item: {
          user_id: "user-2",
          display_name: "Sarah",
          avatar_key: "avatar_fox",
        },
      });

      const result = await service.getRatingsForSession("round-1");

      expect(result.round_id).toBe("round-1");
      expect(result.ratings).toHaveLength(2);
      expect(result.ratings[0].member_id).toBe("user-1");
      expect(result.ratings[0].display_name).toBe("Tim");
      expect(result.ratings[0].rating).toBe("loved");
      expect(result.ratings[1].member_id).toBe("user-2");
      expect(result.ratings[1].display_name).toBe("Sarah");
      expect(result.ratings[1].rating).toBeNull();
    });

    it("throws NotFoundError when round does not exist", async () => {
      mockRoundService.getRoundBasic.mockResolvedValueOnce(null);

      await expect(
        service.getRatingsForSession("round-missing"),
      ).rejects.toThrow("Round not found");
    });

    it("respects attendees list when present", async () => {
      mockRoundService.getRoundBasic.mockResolvedValueOnce({
        round_id: "round-1",
        group_id: "group-1",
        status: "watched",
        attendees: ["user-1"],
      });

      mockGroupService.getMembers.mockResolvedValueOnce([
        { group_id: "group-1", user_id: "user-1", role: "creator" },
        { group_id: "group-1", user_id: "user-2", role: "member" },
      ]);

      // QueryCommand for ratings
      mockSend.mockResolvedValueOnce({ Items: [] });

      // GetCommand for user-1 details
      mockSend.mockResolvedValueOnce({
        Item: {
          user_id: "user-1",
          display_name: "Tim",
          avatar_key: "avatar_bear",
        },
      });

      // GetCommand for user-2 (still fetched for all members, but filtered)
      mockSend.mockResolvedValueOnce({
        Item: {
          user_id: "user-2",
          display_name: "Sarah",
          avatar_key: "avatar_fox",
        },
      });

      const result = await service.getRatingsForSession("round-1");

      // Only the attendee should be in the result
      expect(result.ratings).toHaveLength(1);
      expect(result.ratings[0].member_id).toBe("user-1");
    });
  });
});
