import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import type { Pick } from "../models/pick.js";
import { NotFoundError, ForbiddenError } from "../lib/errors.js";

export class PickService {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly picksTable: string,
    private readonly membershipsTable: string,
  ) {}

  async createPick(input: {
    group_id: string;
    round_id: string;
    tmdb_movie_id: number;
    picked_by: string;
  }): Promise<Pick> {
    const now = new Date().toISOString();
    const pick: Pick = {
      pick_id: randomUUID(),
      round_id: input.round_id,
      group_id: input.group_id,
      tmdb_movie_id: input.tmdb_movie_id,
      picked_by: input.picked_by,
      picked_at: now,
      watched: false,
      watched_at: null,
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.picksTable,
        Item: pick,
      }),
    );

    return pick;
  }

  async markWatched(
    pickId: string,
    userId: string,
    groupId: string,
  ): Promise<Pick> {
    // Get the pick
    const pickResult = await this.docClient.send(
      new GetCommand({
        TableName: this.picksTable,
        Key: { pick_id: pickId },
      }),
    );

    const pick = pickResult.Item as Pick | undefined;
    if (!pick || pick.group_id !== groupId) {
      throw new NotFoundError("Pick not found");
    }

    // Verify user is a group member
    const memberResult = await this.docClient.send(
      new GetCommand({
        TableName: this.membershipsTable,
        Key: { group_id: groupId, user_id: userId },
      }),
    );

    if (!memberResult.Item) {
      throw new ForbiddenError("Not a member of this group");
    }

    // Update the pick
    const now = new Date().toISOString();
    const result = await this.docClient.send(
      new UpdateCommand({
        TableName: this.picksTable,
        Key: { pick_id: pickId },
        UpdateExpression: "SET watched = :w, watched_at = :wa",
        ExpressionAttributeValues: { ":w": true, ":wa": now },
        ReturnValues: "ALL_NEW",
      }),
    );

    return result.Attributes as Pick;
  }

  async getGroupPicks(groupId: string): Promise<Pick[]> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.picksTable,
        IndexName: "group-picks-index",
        KeyConditionExpression: "group_id = :gid",
        ExpressionAttributeValues: { ":gid": groupId },
      }),
    );

    return (result.Items ?? []) as Pick[];
  }

  async getWatchedMovieIds(groupId: string): Promise<number[]> {
    const picks = await this.getGroupPicks(groupId);
    return picks
      .filter((p) => p.watched === true)
      .map((p) => p.tmdb_movie_id);
  }
}
