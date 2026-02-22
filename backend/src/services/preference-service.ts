import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Preference, PutPreferenceInput } from "../models/preference.js";

const RATING_ORDER = ["G", "PG", "PG-13", "R"] as const;

export interface PreferenceSummary {
  liked_genres: string[];
  disliked_genres: string[];
  max_content_rating: string | null;
  member_count: number;
}

export class PreferenceService {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly preferencesTable: string,
  ) {}

  async getPreferences(
    groupId: string,
    userId: string,
  ): Promise<Preference | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.preferencesTable,
        Key: { group_id: groupId, user_id: userId },
      }),
    );

    return (result.Item as Preference) ?? null;
  }

  async putPreferences(
    groupId: string,
    userId: string,
    input: PutPreferenceInput,
  ): Promise<Preference> {
    const now = new Date().toISOString();
    const preference: Preference = {
      group_id: groupId,
      user_id: userId,
      genre_likes: input.genre_likes,
      genre_dislikes: input.genre_dislikes,
      max_content_rating: input.max_content_rating,
      updated_at: now,
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.preferencesTable,
        Item: preference,
      }),
    );

    return preference;
  }

  async getGroupPreferences(groupId: string): Promise<Preference[]> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.preferencesTable,
        KeyConditionExpression: "group_id = :gid",
        ExpressionAttributeValues: { ":gid": groupId },
      }),
    );

    return (result.Items ?? []) as Preference[];
  }

  async getGroupPreferenceSummaryForMembers(
    groupId: string,
    memberIds: string[],
  ): Promise<PreferenceSummary> {
    const allPrefs = await this.getGroupPreferences(groupId);
    const memberSet = new Set(memberIds);
    const prefs = allPrefs.filter((p) => memberSet.has(p.user_id));
    return this.buildSummary(prefs);
  }

  async getGroupPreferenceSummary(groupId: string): Promise<PreferenceSummary> {
    const prefs = await this.getGroupPreferences(groupId);
    return this.buildSummary(prefs);
  }

  private buildSummary(prefs: Preference[]): PreferenceSummary {
    if (prefs.length === 0) {
      return {
        liked_genres: [],
        disliked_genres: [],
        max_content_rating: null,
        member_count: 0,
      };
    }

    const likedSet = new Set<string>();
    for (const p of prefs) {
      for (const g of p.genre_likes) likedSet.add(g);
    }

    // Intersection: only genres disliked by every member who set preferences
    let dislikedSet: Set<string> | null = null;
    for (const p of prefs) {
      const memberDislikes = new Set(p.genre_dislikes);
      if (dislikedSet === null) {
        dislikedSet = memberDislikes;
      } else {
        dislikedSet = new Set([...dislikedSet].filter((g: string) => memberDislikes.has(g)));
      }
    }

    // Min ceiling: lowest rating index across all members
    let minRatingIndex = RATING_ORDER.length - 1;
    for (const p of prefs) {
      const idx = RATING_ORDER.indexOf(p.max_content_rating as typeof RATING_ORDER[number]);
      if (idx >= 0 && idx < minRatingIndex) {
        minRatingIndex = idx;
      }
    }

    return {
      liked_genres: [...likedSet],
      disliked_genres: [...(dislikedSet ?? [])],
      max_content_rating: RATING_ORDER[minRatingIndex],
      member_count: prefs.length,
    };
  }
}
