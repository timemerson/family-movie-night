import {
  GetCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
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
      is_managed: false,
      parent_user_id: null,
      notification_prefs: {
        vote_nudge: true,
        pick_announce: true,
        new_round: true,
      },
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: user,
          ConditionExpression: "attribute_not_exists(user_id)",
        }),
      );
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.name === "ConditionalCheckFailedException"
      ) {
        // Another request created the user first — fetch and return it
        const retry = await this.docClient.send(
          new GetCommand({
            TableName: this.tableName,
            Key: { user_id: userId },
          }),
        );
        if (retry.Item) {
          return retry.Item as User;
        }
      }
      throw err;
    }

    return user;
  }

  async getUser(userId: string): Promise<User | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { user_id: userId },
      }),
    );
    return (result.Item as User) ?? null;
  }

  async createManagedMember(
    parentUserId: string,
    displayName: string,
    avatarKey: string = "avatar_bear",
  ): Promise<User> {
    const now = new Date().toISOString();
    const userId = `managed_${randomUUID()}`;

    const user: User = {
      user_id: userId,
      email: "",
      display_name: displayName,
      avatar_key: avatarKey,
      created_at: now,
      is_managed: true,
      parent_user_id: parentUserId,
      notification_prefs: {
        vote_nudge: false,
        pick_announce: false,
        new_round: false,
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
