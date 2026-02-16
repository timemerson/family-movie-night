import {
  PutCommand,
  QueryCommand,
  UpdateCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { randomUUID, randomBytes } from "node:crypto";
import type { Invite } from "../models/invite.js";
import { NotFoundError, GoneError } from "../lib/errors.js";

const INVITE_TTL_DAYS = 7;
const TTL_BUFFER_HOURS = 24;
const INVITE_URL_BASE = "https://familymovienight.app/invite";

export class InviteService {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly invitesTable: string,
  ) {}

  async createInvite(groupId: string, createdBy: string): Promise<Invite> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    const ttl = Math.floor(
      expiresAt.getTime() / 1000 + TTL_BUFFER_HOURS * 3600,
    );

    const invite: Invite = {
      invite_id: randomUUID(),
      group_id: groupId,
      created_by: createdBy,
      invite_token: randomBytes(6).toString("base64url"),
      status: "pending",
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      ttl,
    };

    await this.docClient.send(
      new PutCommand({ TableName: this.invitesTable, Item: invite }),
    );

    return invite;
  }

  async getInviteByToken(token: string): Promise<Invite> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.invitesTable,
        IndexName: "token-index",
        KeyConditionExpression: "invite_token = :token",
        ExpressionAttributeValues: { ":token": token },
      }),
    );

    const invite = result.Items?.[0] as Invite | undefined;
    if (!invite) {
      throw new NotFoundError("Invite not found");
    }

    return invite;
  }

  async getInviteById(inviteId: string): Promise<Invite> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.invitesTable,
        Key: { invite_id: inviteId },
      }),
    );

    if (!result.Item) {
      throw new NotFoundError("Invite not found");
    }

    return result.Item as Invite;
  }

  async listGroupInvites(groupId: string): Promise<Invite[]> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.invitesTable,
        IndexName: "group-invites-index",
        KeyConditionExpression: "group_id = :gid",
        FilterExpression: "#s = :status",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":gid": groupId,
          ":status": "pending",
        },
        ScanIndexForward: false,
      }),
    );

    return (result.Items ?? []) as Invite[];
  }

  /** Validates that an invite is still usable (pending + not expired).
   *  Invites are multi-use — any number of users can join via the same invite
   *  until the group reaches capacity, the invite is revoked, or it expires. */
  validateInvite(invite: Invite): void {
    if (invite.status !== "pending") {
      throw new GoneError("Invite has been revoked");
    }

    if (new Date(invite.expires_at) < new Date()) {
      throw new GoneError("Invite has expired");
    }
  }

  async revokeInvite(inviteId: string, groupId: string): Promise<void> {
    const invite = await this.getInviteById(inviteId);

    if (invite.group_id !== groupId) {
      throw new NotFoundError("Invite not found");
    }

    await this.docClient.send(
      new UpdateCommand({
        TableName: this.invitesTable,
        Key: { invite_id: inviteId },
        UpdateExpression: "SET #s = :status",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":status": "revoked" },
      }),
    );
  }

  static inviteUrl(token: string): string {
    return `${INVITE_URL_BASE}/${token}`;
  }
}
