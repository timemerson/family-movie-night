import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { WatchlistItem } from "../models/watchlist.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../lib/errors.js";

const MAX_WATCHLIST_SIZE = 50;

export class WatchlistService {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly watchlistTable: string,
    private readonly picksTable: string,
    private readonly watchedMoviesTable: string,
  ) {}

  async addToWatchlist(
    groupId: string,
    tmdbMovieId: number,
    addedBy: string,
    metadata: {
      title: string;
      poster_path: string;
      year: number;
      genres: string[];
      content_rating: string;
    },
  ): Promise<WatchlistItem> {
    // Check if already watched (direct)
    const directWatched = await this.docClient.send(
      new GetCommand({
        TableName: this.watchedMoviesTable,
        Key: { group_id: groupId, tmdb_movie_id: tmdbMovieId },
      }),
    );
    if (directWatched.Item) {
      throw new ValidationError("Already watched");
    }

    // Check if already watched (via pick)
    const picksResult = await this.docClient.send(
      new QueryCommand({
        TableName: this.picksTable,
        IndexName: "group-picks-index",
        KeyConditionExpression: "group_id = :gid",
        ExpressionAttributeValues: { ":gid": groupId },
      }),
    );
    const watchedPick = (picksResult.Items ?? []).find(
      (p: any) => p.tmdb_movie_id === tmdbMovieId && p.watched === true,
    );
    if (watchedPick) {
      throw new ValidationError("Already watched");
    }

    // Check watchlist count (pre-check for fast rejection)
    const count = await this.getWatchlistCount(groupId);
    if (count >= MAX_WATCHLIST_SIZE) {
      throw new ValidationError("Watchlist is full");
    }

    const now = new Date().toISOString();
    const item: WatchlistItem = {
      group_id: groupId,
      tmdb_movie_id: tmdbMovieId,
      added_by: addedBy,
      added_at: now,
      title: metadata.title,
      poster_path: metadata.poster_path,
      year: metadata.year,
      genres: metadata.genres,
      content_rating: metadata.content_rating,
    };

    // Use attribute_not_exists to atomically prevent duplicate inserts
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.watchlistTable,
          Item: item,
          ConditionExpression: "attribute_not_exists(group_id)",
        }),
      );
    } catch (err: any) {
      if (err.name === "ConditionalCheckFailedException") {
        throw new ConflictError("Already on Watchlist");
      }
      throw err;
    }

    return item;
  }

  async removeFromWatchlist(
    groupId: string,
    tmdbMovieId: number,
    userId: string,
    userRole: string,
  ): Promise<void> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.watchlistTable,
        Key: { group_id: groupId, tmdb_movie_id: tmdbMovieId },
      }),
    );

    const item = result.Item as WatchlistItem | undefined;
    if (!item) {
      throw new NotFoundError("Movie not on watchlist");
    }

    if (item.added_by !== userId && userRole !== "creator") {
      throw new ForbiddenError(
        "Only the member who added this movie or the group creator can remove it",
      );
    }

    await this.docClient.send(
      new DeleteCommand({
        TableName: this.watchlistTable,
        Key: { group_id: groupId, tmdb_movie_id: tmdbMovieId },
      }),
    );
  }

  async getWatchlist(groupId: string): Promise<WatchlistItem[]> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.watchlistTable,
        KeyConditionExpression: "group_id = :gid",
        ExpressionAttributeValues: { ":gid": groupId },
      }),
    );

    const items = (result.Items ?? []) as WatchlistItem[];
    // Sort reverse chronological by added_at
    return items.sort(
      (a, b) =>
        new Date(b.added_at).getTime() - new Date(a.added_at).getTime(),
    );
  }

  async isOnWatchlist(
    groupId: string,
    tmdbMovieId: number,
  ): Promise<boolean> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.watchlistTable,
        Key: { group_id: groupId, tmdb_movie_id: tmdbMovieId },
      }),
    );
    return !!result.Item;
  }

  async getWatchlistCount(groupId: string): Promise<number> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.watchlistTable,
        KeyConditionExpression: "group_id = :gid",
        ExpressionAttributeValues: { ":gid": groupId },
        Select: "COUNT",
      }),
    );
    return result.Count ?? 0;
  }

  async removeFromWatchlistIfPresent(
    groupId: string,
    tmdbMovieId: number,
  ): Promise<void> {
    const isOn = await this.isOnWatchlist(groupId, tmdbMovieId);
    if (isOn) {
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.watchlistTable,
          Key: { group_id: groupId, tmdb_movie_id: tmdbMovieId },
        }),
      );
    }
  }
}
