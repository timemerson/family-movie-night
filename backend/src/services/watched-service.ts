import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { WatchedMovie, CombinedWatchedMovie } from "../models/watched-movie.js";
import type { WatchlistService } from "./watchlist-service.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../lib/errors.js";

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export class WatchedService {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly watchedMoviesTable: string,
    private readonly picksTable: string,
    private readonly watchlistService: WatchlistService,
  ) {}

  async markDirectlyWatched(
    groupId: string,
    tmdbMovieId: number,
    markedBy: string,
    metadata: {
      title: string;
      poster_path: string;
      year: number;
    },
  ): Promise<WatchedMovie> {
    // Check if already directly watched
    const directResult = await this.docClient.send(
      new GetCommand({
        TableName: this.watchedMoviesTable,
        Key: { group_id: groupId, tmdb_movie_id: tmdbMovieId },
      }),
    );
    if (directResult.Item) {
      throw new ConflictError("Already watched");
    }

    // Check if already watched via pick
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
      throw new ConflictError("Already watched");
    }

    const now = new Date().toISOString();
    const item: WatchedMovie = {
      group_id: groupId,
      tmdb_movie_id: tmdbMovieId,
      marked_by: markedBy,
      watched_at: now,
      title: metadata.title,
      poster_path: metadata.poster_path,
      year: metadata.year,
      source: "direct",
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.watchedMoviesTable,
        Item: item,
      }),
    );

    // Auto-remove from watchlist if present
    await this.watchlistService.removeFromWatchlistIfPresent(
      groupId,
      tmdbMovieId,
    );

    return item;
  }

  async unmarkDirectlyWatched(
    groupId: string,
    tmdbMovieId: number,
    userId: string,
    userRole: string,
  ): Promise<void> {
    // Check direct watched
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.watchedMoviesTable,
        Key: { group_id: groupId, tmdb_movie_id: tmdbMovieId },
      }),
    );

    const item = result.Item as WatchedMovie | undefined;
    if (!item) {
      // Check if it's a pick-watched movie
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
        throw new ValidationError("Cannot undo a movie watched through a round");
      }
      throw new NotFoundError("Movie not found in watched list");
    }

    // Check permission
    if (item.marked_by !== userId && userRole !== "creator") {
      throw new ForbiddenError(
        "Only the member who marked this movie or the group creator can undo it",
      );
    }

    // Check 24-hour window
    const watchedTime = new Date(item.watched_at).getTime();
    const now = Date.now();
    if (now - watchedTime >= UNDO_WINDOW_MS) {
      throw new ValidationError("Undo window expired");
    }

    await this.docClient.send(
      new DeleteCommand({
        TableName: this.watchedMoviesTable,
        Key: { group_id: groupId, tmdb_movie_id: tmdbMovieId },
      }),
    );
  }

  async getDirectlyWatchedMovies(groupId: string): Promise<WatchedMovie[]> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.watchedMoviesTable,
        KeyConditionExpression: "group_id = :gid",
        ExpressionAttributeValues: { ":gid": groupId },
      }),
    );
    return (result.Items ?? []) as WatchedMovie[];
  }

  async getCombinedWatchedMovies(
    groupId: string,
  ): Promise<CombinedWatchedMovie[]> {
    // Get directly watched
    const directMovies = await this.getDirectlyWatchedMovies(groupId);

    // Get pick-watched
    const picksResult = await this.docClient.send(
      new QueryCommand({
        TableName: this.picksTable,
        IndexName: "group-picks-index",
        KeyConditionExpression: "group_id = :gid",
        ExpressionAttributeValues: { ":gid": groupId },
      }),
    );
    const picks = (picksResult.Items ?? []).filter(
      (p: any) => p.watched === true,
    );

    const combined: CombinedWatchedMovie[] = [];

    // Add direct-watched
    for (const m of directMovies) {
      combined.push({
        tmdb_movie_id: m.tmdb_movie_id,
        title: m.title,
        poster_path: m.poster_path,
        year: m.year,
        watched_at: m.watched_at,
        source: "direct",
        marked_by: m.marked_by,
      });
    }

    // Add pick-watched (avoid duplicates)
    const directIds = new Set(directMovies.map((m) => m.tmdb_movie_id));
    for (const p of picks) {
      if (!directIds.has(p.tmdb_movie_id)) {
        combined.push({
          tmdb_movie_id: p.tmdb_movie_id,
          title: p.title ?? "",
          poster_path: p.poster_path ?? "",
          year: 0,
          watched_at: p.watched_at,
          source: "picked",
          marked_by: p.picked_by,
          pick_id: p.pick_id,
        });
      }
    }

    // Sort reverse chronologically
    combined.sort(
      (a, b) =>
        new Date(b.watched_at).getTime() - new Date(a.watched_at).getTime(),
    );

    return combined;
  }

  async getAllWatchedMovieIds(groupId: string): Promise<Set<number>> {
    const combined = await this.getCombinedWatchedMovies(groupId);
    return new Set(combined.map((m) => m.tmdb_movie_id));
  }

  async isWatched(groupId: string, tmdbMovieId: number): Promise<boolean> {
    // Check direct
    const directResult = await this.docClient.send(
      new GetCommand({
        TableName: this.watchedMoviesTable,
        Key: { group_id: groupId, tmdb_movie_id: tmdbMovieId },
      }),
    );
    if (directResult.Item) return true;

    // Check picks
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
    return !!watchedPick;
  }
}
