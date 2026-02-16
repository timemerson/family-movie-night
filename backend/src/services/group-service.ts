import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import type { Group, GroupMember } from "../models/group.js";
import { NotFoundError, ForbiddenError, ConflictError } from "../lib/errors.js";

const MAX_GROUP_SIZE = 8;

export interface GroupWithMembers extends Group {
  members: (GroupMember & { display_name: string; avatar_key: string })[];
}

export class GroupService {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly groupsTable: string,
    private readonly membershipsTable: string,
    private readonly usersTable: string,
  ) {}

  async createGroup(
    userId: string,
    name: string,
    userDisplayName: string,
    userAvatarKey: string,
  ): Promise<GroupWithMembers> {
    const now = new Date().toISOString();
    const groupId = randomUUID();

    const group: Group = {
      group_id: groupId,
      name,
      created_by: userId,
      streaming_services: [],
      created_at: now,
    };

    const membership: GroupMember = {
      group_id: groupId,
      user_id: userId,
      role: "creator",
      joined_at: now,
    };

    await this.docClient.send(
      new PutCommand({ TableName: this.groupsTable, Item: group }),
    );

    await this.docClient.send(
      new PutCommand({ TableName: this.membershipsTable, Item: membership }),
    );

    return {
      ...group,
      members: [
        {
          ...membership,
          display_name: userDisplayName,
          avatar_key: userAvatarKey,
        },
      ],
    };
  }

  async getGroup(groupId: string): Promise<Group> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.groupsTable,
        Key: { group_id: groupId },
      }),
    );

    if (!result.Item) {
      throw new NotFoundError("Group not found");
    }

    return result.Item as Group;
  }

  async getGroupWithMembers(groupId: string): Promise<GroupWithMembers> {
    const group = await this.getGroup(groupId);
    const members = await this.getMembers(groupId);

    const enrichedMembers = await Promise.all(
      members.map(async (m) => {
        const userResult = await this.docClient.send(
          new GetCommand({
            TableName: this.usersTable,
            Key: { user_id: m.user_id },
          }),
        );
        const user = userResult.Item;
        return {
          ...m,
          display_name: user?.display_name ?? "Unknown",
          avatar_key: user?.avatar_key ?? "avatar_bear",
        };
      }),
    );

    return { ...group, members: enrichedMembers };
  }

  async updateGroup(
    groupId: string,
    userId: string,
    updates: { name?: string; streaming_services?: string[] },
  ): Promise<Group> {
    await this.requireCreator(groupId, userId);

    const expressions: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};

    if (updates.name !== undefined) {
      expressions.push("#n = :name");
      names["#n"] = "name";
      values[":name"] = updates.name;
    }

    if (updates.streaming_services !== undefined) {
      expressions.push("#ss = :ss");
      names["#ss"] = "streaming_services";
      values[":ss"] = updates.streaming_services;
    }

    if (expressions.length === 0) {
      return this.getGroup(groupId);
    }

    const result = await this.docClient.send(
      new UpdateCommand({
        TableName: this.groupsTable,
        Key: { group_id: groupId },
        UpdateExpression: `SET ${expressions.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      }),
    );

    return result.Attributes as Group;
  }

  async getMembers(groupId: string): Promise<GroupMember[]> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.membershipsTable,
        KeyConditionExpression: "group_id = :gid",
        ExpressionAttributeValues: { ":gid": groupId },
      }),
    );

    return (result.Items ?? []) as GroupMember[];
  }

  async getMembership(
    groupId: string,
    userId: string,
  ): Promise<GroupMember | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.membershipsTable,
        Key: { group_id: groupId, user_id: userId },
      }),
    );

    return (result.Item as GroupMember) ?? null;
  }

  async getUserGroup(userId: string): Promise<GroupMember | null> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.membershipsTable,
        IndexName: "user-groups-index",
        KeyConditionExpression: "user_id = :uid",
        ExpressionAttributeValues: { ":uid": userId },
      }),
    );

    return (result.Items?.[0] as GroupMember) ?? null;
  }

  async addMember(groupId: string, userId: string): Promise<GroupMember> {
    const members = await this.getMembers(groupId);
    if (members.length >= MAX_GROUP_SIZE) {
      throw new ConflictError("Group is full (maximum 8 members)");
    }

    const existing = members.find((m) => m.user_id === userId);
    if (existing) {
      throw new ConflictError("Already a member of this group");
    }

    const now = new Date().toISOString();
    const membership: GroupMember = {
      group_id: groupId,
      user_id: userId,
      role: "member",
      joined_at: now,
    };

    await this.docClient.send(
      new PutCommand({ TableName: this.membershipsTable, Item: membership }),
    );

    return membership;
  }

  async leaveGroup(groupId: string, userId: string): Promise<void> {
    const membership = await this.getMembership(groupId, userId);
    if (!membership) {
      throw new NotFoundError("Not a member of this group");
    }

    await this.docClient.send(
      new DeleteCommand({
        TableName: this.membershipsTable,
        Key: { group_id: groupId, user_id: userId },
      }),
    );

    // If the leaving user was the creator, promote the longest-tenured member
    if (membership.role === "creator") {
      const remaining = await this.getMembers(groupId);
      if (remaining.length > 0) {
        const sorted = remaining.sort(
          (a, b) =>
            new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
        );
        const newCreator = sorted[0];
        await this.docClient.send(
          new UpdateCommand({
            TableName: this.membershipsTable,
            Key: { group_id: groupId, user_id: newCreator.user_id },
            UpdateExpression: "SET #r = :role",
            ExpressionAttributeNames: { "#r": "role" },
            ExpressionAttributeValues: { ":role": "creator" },
          }),
        );
        await this.docClient.send(
          new UpdateCommand({
            TableName: this.groupsTable,
            Key: { group_id: groupId },
            UpdateExpression: "SET created_by = :uid",
            ExpressionAttributeValues: { ":uid": newCreator.user_id },
          }),
        );
      }
    }
  }

  async requireMember(groupId: string, userId: string): Promise<GroupMember> {
    const membership = await this.getMembership(groupId, userId);
    if (!membership) {
      throw new ForbiddenError("Not a member of this group");
    }
    return membership;
  }

  async requireCreator(groupId: string, userId: string): Promise<GroupMember> {
    const membership = await this.requireMember(groupId, userId);
    if (membership.role !== "creator") {
      throw new ForbiddenError("Only the group creator can perform this action");
    }
    return membership;
  }
}
