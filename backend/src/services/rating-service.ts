import {
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Rating, RatingValue } from "../models/rating.js";
import type { GroupService } from "./group-service.js";
import type { RoundService } from "./round-service.js";
import {
  NotFoundError,
  ValidationError,
} from "../lib/errors.js";

export interface RatingEntryResponse {
  member_id: string;
  display_name: string;
  avatar_key: string | null;
  rating: string | null;
  rated_at: string | null;
}

export class RatingService {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly ratingsTable: string,
    private readonly usersTable: string,
    private readonly roundService: RoundService,
    private readonly groupService: GroupService,
  ) {}

  async submitRating(
    roundId: string,
    memberId: string,
    rating: RatingValue,
  ): Promise<Rating> {
    const round = await this.roundService.getRoundBasic(roundId);
    if (!round) {
      throw new NotFoundError("Round not found");
    }

    // Ratings are accepted when round is in selected, watched, or rated status
    // (selected allows rating before explicit "watched" transition for flexibility)
    if (!["selected", "watched"].includes(round.status)) {
      throw new ValidationError(
        `Round is in '${round.status}' status; ratings can only be submitted when the round is in 'selected' or 'watched' status`,
      );
    }

    const now = new Date().toISOString();
    const item: Rating = {
      round_id: roundId,
      member_id: memberId,
      rating,
      rated_at: now,
    };

    // Upsert — allows changing a rating before ratings are closed
    await this.docClient.send(
      new PutCommand({
        TableName: this.ratingsTable,
        Item: item,
      }),
    );

    // Auto-transition to 'rated' when all attendees have rated
    await this.checkAutoTransition(roundId, round);

    return item;
  }

  /**
   * After a rating is submitted, check if all attendees have now rated.
   * If so, automatically transition the round to 'rated' status.
   */
  private async checkAutoTransition(
    roundId: string,
    round: { group_id: string; status: string; attendees?: string[] | null },
  ): Promise<void> {
    // Only auto-transition from 'watched' status
    if (round.status !== "watched") return;

    const members = await this.groupService.getMembers(round.group_id);
    const attendeeIds = round.attendees
      ? new Set(round.attendees)
      : new Set(members.map((m: any) => m.user_id));

    // Get all ratings for this round
    const ratingsResult = await this.docClient.send(
      new QueryCommand({
        TableName: this.ratingsTable,
        KeyConditionExpression: "round_id = :rid",
        ExpressionAttributeValues: { ":rid": roundId },
      }),
    );
    const ratings = ratingsResult.Items ?? [];
    const ratedMemberIds = new Set(ratings.map((r: any) => r.member_id));

    // Check if every attendee has rated
    const allRated = [...attendeeIds].every((id) => ratedMemberIds.has(id));
    if (!allRated) return;

    // Auto-transition via round service with system flag to skip creator check
    try {
      await this.roundService.transitionStatus(roundId, "rated", "", { system: true });
    } catch {
      // Silently ignore — race condition or already transitioned
    }
  }

  async getRatingsForSession(
    roundId: string,
  ): Promise<{ round_id: string; ratings: RatingEntryResponse[] }> {
    const round = await this.roundService.getRoundBasic(roundId);
    if (!round) {
      throw new NotFoundError("Round not found");
    }

    // Get all members of the group
    const members = await this.groupService.getMembers(round.group_id);

    // Determine attendee set: use round.attendees if present, otherwise all members
    const attendeeIds = round.attendees
      ? new Set(round.attendees)
      : new Set(members.map((m: any) => m.user_id));

    // Get existing ratings for this round
    const ratingsResult = await this.docClient.send(
      new QueryCommand({
        TableName: this.ratingsTable,
        KeyConditionExpression: "round_id = :rid",
        ExpressionAttributeValues: { ":rid": roundId },
      }),
    );
    const ratings = (ratingsResult.Items ?? []) as Rating[];
    const ratingMap = new Map(ratings.map((r) => [r.member_id, r]));

    // Look up display names from users table via group service
    // Members already have user_id; we need display_name and avatar_key from users
    const userIds = members.map((m: any) => m.user_id);
    const userMap = await this.getUserDetails(userIds);

    // Build response: one entry per attendee
    const entries: RatingEntryResponse[] = members
      .filter((m: any) => attendeeIds.has(m.user_id))
      .map((m: any) => {
        const user = userMap.get(m.user_id);
        const rating = ratingMap.get(m.user_id);
        return {
          member_id: m.user_id,
          display_name: user?.display_name ?? m.user_id,
          avatar_key: user?.avatar_key ?? null,
          rating: rating?.rating ?? null,
          rated_at: rating?.rated_at ?? null,
        };
      });

    return { round_id: roundId, ratings: entries };
  }

  private async getUserDetails(
    userIds: string[],
  ): Promise<Map<string, { display_name: string; avatar_key: string }>> {
    // Use the group service's underlying users table via batch get
    // For simplicity, query members individually (household size is 2-8)
    const map = new Map<
      string,
      { display_name: string; avatar_key: string }
    >();

    for (const userId of userIds) {
      try {
        const result = await this.docClient.send(
          new GetCommand({
            TableName: this.usersTable,
            Key: { user_id: userId },
          }),
        );
        if (result.Item) {
          map.set(userId, {
            display_name: result.Item.display_name ?? userId,
            avatar_key: result.Item.avatar_key ?? "avatar_bear",
          });
        }
      } catch {
        // Skip failed lookups
      }
    }

    return map;
  }
}
