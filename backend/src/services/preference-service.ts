import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Preference, PutPreferenceInput } from "../models/preference.js";

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
}
