import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  TransactWriteCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import type { Group, GroupMember } from "../models/group.js";
import type { UserService } from "./user-service.js";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from "../lib/errors.js";

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
      member_count: 1,
      created_at: now,
    };

    const membership: GroupMember = {
      group_id: groupId,
      user_id: userId,
      role: "creator",
      member_type: "independent",
      joined_at: now,
    };

    await this.docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: this.groupsTable, Item: group } },
          { Put: { TableName: this.membershipsTable, Item: membership } },
        ],
      }),
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

    if (members.length === 0) {
      return { ...group, members: [] };
    }

    const batchResult = await this.docClient.send(
      new BatchGetCommand({
        RequestItems: {
          [this.usersTable]: {
            Keys: members.map((m) => ({ user_id: m.user_id })),
          },
        },
      }),
    );

    const users = batchResult.Responses?.[this.usersTable] ?? [];
    const userMap = new Map(
      users.map((u) => [u.user_id as string, u]),
    );

    const enrichedMembers = members.map((m) => {
      const user = userMap.get(m.user_id);
      return {
        ...m,
        display_name: (user?.display_name as string) ?? "Unknown",
        avatar_key: (user?.avatar_key as string) ?? "avatar_bear",
      };
    });

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
    const now = new Date().toISOString();
    const membership: GroupMember = {
      group_id: groupId,
      user_id: userId,
      role: "member",
      member_type: "independent",
      joined_at: now,
    };

    try {
      await this.docClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.groupsTable,
                Key: { group_id: groupId },
                UpdateExpression: "SET member_count = member_count + :one",
                ConditionExpression:
                  "attribute_exists(group_id) AND member_count < :max",
                ExpressionAttributeValues: {
                  ":one": 1,
                  ":max": MAX_GROUP_SIZE,
                },
              },
            },
            {
              Put: {
                TableName: this.membershipsTable,
                Item: membership,
                ConditionExpression:
                  "attribute_not_exists(group_id) AND attribute_not_exists(user_id)",
              },
            },
          ],
        }),
      );
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.name === "TransactionCanceledException"
      ) {
        const reasons = (err as unknown as Record<string, unknown>)
          .CancellationReasons as Array<{ Code: string }> | undefined;
        if (reasons?.[1]?.Code === "ConditionalCheckFailed") {
          throw new ConflictError("Already a member of this group");
        }
        throw new ConflictError("Group is full (maximum 8 members)");
      }
      throw err;
    }

    return membership;
  }

  async leaveGroup(groupId: string, userId: string): Promise<void> {
    const membership = await this.getMembership(groupId, userId);
    if (!membership) {
      throw new NotFoundError("Not a member of this group");
    }

    if (membership.role === "creator") {
      const remaining = await this.getMembers(groupId);
      const others = remaining.filter((m) => m.user_id !== userId);

      if (others.length > 0) {
        // Promote the longest-tenured member to creator
        const sorted = others.sort(
          (a, b) =>
            new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
        );
        const newCreator = sorted[0];

        await this.docClient.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Delete: {
                  TableName: this.membershipsTable,
                  Key: { group_id: groupId, user_id: userId },
                },
              },
              {
                Update: {
                  TableName: this.membershipsTable,
                  Key: { group_id: groupId, user_id: newCreator.user_id },
                  UpdateExpression: "SET #r = :role",
                  ExpressionAttributeNames: { "#r": "role" },
                  ExpressionAttributeValues: { ":role": "creator" },
                },
              },
              {
                Update: {
                  TableName: this.groupsTable,
                  Key: { group_id: groupId },
                  UpdateExpression:
                    "SET created_by = :uid, member_count = member_count - :one",
                  ExpressionAttributeValues: {
                    ":uid": newCreator.user_id,
                    ":one": 1,
                  },
                },
              },
            ],
          }),
        );
      } else {
        // Last member leaving — delete the group entirely.
        // Pending invites are cleaned up by DynamoDB TTL; any attempt to use
        // a stale invite will fail because addMember verifies the group exists.
        await this.docClient.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Delete: {
                  TableName: this.membershipsTable,
                  Key: { group_id: groupId, user_id: userId },
                },
              },
              {
                Delete: {
                  TableName: this.groupsTable,
                  Key: { group_id: groupId },
                },
              },
            ],
          }),
        );
      }
    } else {
      // Regular member leaving
      await this.docClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: this.membershipsTable,
                Key: { group_id: groupId, user_id: userId },
              },
            },
            {
              Update: {
                TableName: this.groupsTable,
                Key: { group_id: groupId },
                UpdateExpression: "SET member_count = member_count - :one",
                ExpressionAttributeValues: { ":one": 1 },
              },
            },
          ],
        }),
      );
    }
  }

  async addManagedMember(
    groupId: string,
    creatorUserId: string,
    displayName: string,
    avatarKey: string,
    userService: UserService,
  ): Promise<GroupMember & { display_name: string; avatar_key: string }> {
    // Create managed user record
    const managedUser = await userService.createManagedMember(
      creatorUserId,
      displayName,
      avatarKey,
    );

    const now = new Date().toISOString();
    const membership: GroupMember = {
      group_id: groupId,
      user_id: managedUser.user_id,
      role: "member",
      member_type: "managed",
      joined_at: now,
    };

    try {
      await this.docClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.groupsTable,
                Key: { group_id: groupId },
                UpdateExpression: "SET member_count = member_count + :one",
                ConditionExpression:
                  "attribute_exists(group_id) AND member_count < :max",
                ExpressionAttributeValues: {
                  ":one": 1,
                  ":max": MAX_GROUP_SIZE,
                },
              },
            },
            {
              Put: {
                TableName: this.membershipsTable,
                Item: membership,
                ConditionExpression:
                  "attribute_not_exists(group_id) AND attribute_not_exists(user_id)",
              },
            },
          ],
        }),
      );
    } catch (err: unknown) {
      // Clean up managed user if membership creation fails
      await userService.deleteUser(managedUser.user_id);
      if (
        err instanceof Error &&
        err.name === "TransactionCanceledException"
      ) {
        throw new ConflictError("Group is full (maximum 8 members)");
      }
      throw err;
    }

    return {
      ...membership,
      display_name: displayName,
      avatar_key: avatarKey,
    };
  }

  async removeMember(
    groupId: string,
    memberId: string,
    callerUserId: string,
    userService: UserService,
  ): Promise<void> {
    // Verify caller is a group member
    const callerMembership = await this.getMembership(groupId, callerUserId);
    if (!callerMembership) {
      throw new ForbiddenError("Not a member of this group");
    }

    // Get target membership
    const targetMembership = await this.getMembership(groupId, memberId);
    if (!targetMembership) {
      throw new NotFoundError("Member not found in this group");
    }

    // Permission check
    if (targetMembership.member_type === "managed") {
      // Managed members can be removed by: group creator OR their parent
      const targetUser = await userService.getUser(memberId);
      const isParent = targetUser?.parent_user_id === callerUserId;
      const isCreator = callerMembership.role === "creator";
      if (!isParent && !isCreator) {
        throw new ForbiddenError("Cannot remove this managed member");
      }
    } else {
      // Independent members: only self-remove or creator can remove
      if (callerUserId !== memberId && callerMembership.role !== "creator") {
        throw new ForbiddenError("Cannot remove other members");
      }
      // Creators cannot be removed via this endpoint — they must use leaveGroup
      if (targetMembership.role === "creator") {
        throw new ValidationError("Group creator must use the leave group endpoint");
      }
    }

    // Delete membership + decrement member_count
    await this.docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName: this.membershipsTable,
              Key: { group_id: groupId, user_id: memberId },
            },
          },
          {
            Update: {
              TableName: this.groupsTable,
              Key: { group_id: groupId },
              UpdateExpression: "SET member_count = member_count - :one",
              ExpressionAttributeValues: { ":one": 1 },
            },
          },
        ],
      }),
    );

    // If managed member, also delete the synthetic user record.
    // Best-effort: if this fails, the orphaned user record is inert
    // (no membership points to it) and will not affect functionality.
    if (targetMembership.member_type === "managed") {
      try {
        await userService.deleteUser(memberId);
      } catch {
        // Orphaned managed user record — acceptable, no group membership remains
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
      throw new ForbiddenError(
        "Only the group creator can perform this action",
      );
    }
    return membership;
  }
}
