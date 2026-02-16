import {
  GetCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { User } from "../models/user.js";

export class UserService {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async getOrCreateUser(
    userId: string,
    email: string,
    displayName?: string,
  ): Promise<User> {
    // Try to get the existing user first
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { user_id: userId },
      }),
    );

    if (result.Item) {
      return result.Item as User;
    }

    // JIT provisioning: create a new user
    const now = new Date().toISOString();
    const user: User = {
      user_id: userId,
      email,
      display_name: displayName ?? email.split("@")[0],
      avatar_key: "avatar_bear",
      created_at: now,
      notification_prefs: {
        vote_nudge: true,
        pick_announce: true,
        new_round: true,
      },
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: user,
        ConditionExpression: "attribute_not_exists(user_id)",
      }),
    );

    return user;
  }

  async deleteUser(userId: string): Promise<void> {
    await this.docClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { user_id: userId },
      }),
    );
  }
}
