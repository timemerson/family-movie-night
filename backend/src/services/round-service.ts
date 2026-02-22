import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import type {
  Round,
  RoundSuggestion,
  RoundWithDetails,
  SuggestionWithVotes,
} from "../models/round.js";
import { normalizeStatus } from "../models/round.js";
import type { Suggestion } from "../models/suggestion.js";
import type { Pick } from "../models/pick.js";
import type { GroupService } from "./group-service.js";
import type { PickService } from "./pick-service.js";
import type { SuggestionService, SuggestionsResult } from "./suggestion-service.js";
import type { WatchlistService } from "./watchlist-service.js";
import type { WatchedService } from "./watched-service.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../lib/errors.js";

const MAX_WATCHLIST_IN_ROUND = 4;

export class RoundService {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly roundsTable: string,
    private readonly suggestionsTable: string,
    private readonly votesTable: string,
    private readonly picksTable: string,
    private readonly groupService: GroupService,
    private readonly suggestionService: SuggestionService,
    private readonly watchlistService: WatchlistService,
    private readonly watchedService: WatchedService,
    private readonly pickService?: PickService,
  ) {}

  async createRound(
    groupId: string,
    startedBy: string,
    options?: { exclude_movie_ids?: number[]; include_watchlist?: boolean },
  ): Promise<{
    round: Round;
    suggestions: RoundSuggestion[];
    watchlist_eligible_count: number;
    relaxed_constraints: string[];
  }> {
    // Check for active round
    const active = await this.getActiveRound(groupId);
    if (active) {
      const err = new ConflictError("An active round already exists for this group");
      (err as any).active_round_id = active.round_id;
      throw err;
    }

    // Generate suggestions via algorithm
    const excludeIds = options?.exclude_movie_ids ?? [];
    let result: SuggestionsResult;
    try {
      result = await this.suggestionService.getSuggestions(groupId, excludeIds);
    } catch (e: any) {
      if (e.name === "ValidationError") {
        // Re-throw as 422 for insufficient preferences
        const err = new ValidationError(e.message);
        (err as any).status = 422;
        throw err;
      }
      throw e;
    }

    // Optionally add watchlist movies
    let watchlistEligibleCount = 0;
    const watchlistSuggestions: Suggestion[] = [];

    if (options?.include_watchlist) {
      const watchlist = await this.watchlistService.getWatchlist(groupId);
      const watchedIds = await this.watchedService.getAllWatchedMovieIds(groupId);
      const algoMovieIds = new Set(result.suggestions.map((s) => s.tmdb_movie_id));
      const excludeSet = new Set([...excludeIds, ...watchedIds]);

      const eligible = watchlist.filter(
        (w) => !excludeSet.has(w.tmdb_movie_id) && !algoMovieIds.has(w.tmdb_movie_id),
      );
      watchlistEligibleCount = eligible.length;

      for (const item of eligible.slice(0, MAX_WATCHLIST_IN_ROUND)) {
        watchlistSuggestions.push({
          tmdb_movie_id: item.tmdb_movie_id,
          title: item.title,
          year: item.year,
          poster_path: item.poster_path,
          overview: "",
          genres: item.genres,
          content_rating: item.content_rating,
          popularity: 0,
          vote_average: 0,
          streaming: [],
          score: 0,
          reason: "From your watchlist",
        });
      }
    }

    // Create the round
    const now = new Date().toISOString();
    const round: Round = {
      round_id: randomUUID(),
      group_id: groupId,
      status: "voting",
      started_by: startedBy,
      created_at: now,
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.roundsTable,
        Item: round,
        ConditionExpression: "attribute_not_exists(round_id)",
      }),
    );

    // Post-write consistency check: re-query for active rounds.
    // If two concurrent creates both passed the pre-check, one must yield.
    const recheck = await this.getActiveRound(groupId);
    if (recheck && recheck.round_id !== round.round_id) {
      // Another round was created concurrently — delete ours
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.roundsTable,
          Key: { round_id: round.round_id },
        }),
      );
      const err = new ConflictError("An active round already exists for this group");
      (err as any).active_round_id = recheck.round_id;
      throw err;
    }

    // Persist suggestions
    const allSuggestions = [
      ...result.suggestions.map((s) => ({ ...s, source: "algorithm" as const })),
      ...watchlistSuggestions.map((s) => ({ ...s, source: "watchlist" as const })),
    ];

    const roundSuggestions = await this.persistSuggestions(round.round_id, allSuggestions);

    return {
      round,
      suggestions: roundSuggestions,
      watchlist_eligible_count: watchlistEligibleCount,
      relaxed_constraints: result.relaxed_constraints,
    };
  }

  async getRound(roundId: string): Promise<RoundWithDetails> {
    // Get round
    const roundResult = await this.docClient.send(
      new GetCommand({
        TableName: this.roundsTable,
        Key: { round_id: roundId },
      }),
    );

    const round = roundResult.Item as Round | undefined;
    if (!round) {
      throw new NotFoundError("Round not found");
    }

    // Get suggestions for this round
    const suggestionsResult = await this.docClient.send(
      new QueryCommand({
        TableName: this.suggestionsTable,
        KeyConditionExpression: "round_id = :rid",
        ExpressionAttributeValues: { ":rid": roundId },
      }),
    );
    const suggestions = (suggestionsResult.Items ?? []) as RoundSuggestion[];

    // Get votes for this round
    const votesResult = await this.docClient.send(
      new QueryCommand({
        TableName: this.votesTable,
        KeyConditionExpression: "round_id = :rid",
        ExpressionAttributeValues: { ":rid": roundId },
      }),
    );
    const votes = (votesResult.Items ?? []) as Array<{
      round_id: string;
      vote_key: string;
      tmdb_movie_id: number;
      user_id: string;
      vote: string;
      voted_at: string;
    }>;

    // Get members for vote progress + voter display names
    const members = await this.groupService.getMembers(round.group_id);
    const memberMap = new Map(
      members.map((m: any) => [m.user_id, m.display_name ?? m.user_id]),
    );

    // Aggregate votes per suggestion
    const votesByMovie = new Map<number, typeof votes>();
    for (const v of votes) {
      const arr = votesByMovie.get(v.tmdb_movie_id) ?? [];
      arr.push(v);
      votesByMovie.set(v.tmdb_movie_id, arr);
    }

    // Count unique voters
    const uniqueVoters = new Set(votes.map((v) => v.user_id));

    const suggestionsWithVotes: SuggestionWithVotes[] = suggestions.map((s) => {
      const movieVotes = votesByMovie.get(s.tmdb_movie_id) ?? [];
      const up = movieVotes.filter((v) => v.vote === "up").length;
      const down = movieVotes.filter((v) => v.vote === "down").length;
      const voters = movieVotes.map((v) => ({
        user_id: v.user_id,
        display_name: memberMap.get(v.user_id) ?? v.user_id,
        vote: v.vote,
      }));

      return {
        tmdb_movie_id: s.tmdb_movie_id,
        title: s.title,
        year: s.year,
        poster_path: s.poster_path,
        genres: s.genres,
        content_rating: s.content_rating,
        overview: s.overview,
        source: s.source,
        streaming: s.streaming,
        score: s.score,
        reason: s.reason,
        popularity: s.popularity,
        vote_average: s.vote_average,
        votes: { up, down },
        voters,
      };
    });

    // Get pick if exists
    let pick = null;
    if (round.pick_id) {
      const pickResult = await this.docClient.send(
        new GetCommand({
          TableName: this.picksTable,
          Key: { pick_id: round.pick_id },
        }),
      );
      if (pickResult.Item) {
        const p = pickResult.Item;
        pick = {
          pick_id: p.pick_id,
          tmdb_movie_id: p.tmdb_movie_id,
          title: suggestions.find((s) => s.tmdb_movie_id === p.tmdb_movie_id)?.title ?? "",
          picked_by: p.picked_by,
          picked_at: p.picked_at,
          watched: p.watched,
        };
      }
    }

    return {
      round_id: round.round_id,
      group_id: round.group_id,
      status: normalizeStatus(round.status),
      started_by: round.started_by,
      created_at: round.created_at,
      closed_at: round.closed_at,
      suggestions: suggestionsWithVotes,
      vote_progress: {
        voted: uniqueVoters.size,
        total: members.length,
      },
      pick,
    };
  }

  async closeRound(roundId: string, userId: string): Promise<Round> {
    const round = await this.getRoundBasic(roundId);
    if (!round) {
      throw new NotFoundError("Round not found");
    }

    // Only creator can close
    const member = await this.groupService.requireMember(round.group_id, userId);
    if ((member as any).role !== "creator") {
      throw new ForbiddenError("Only the group creator can close a round");
    }

    // Must be in voting status
    if (round.status !== "voting") {
      throw new ConflictError(`Round is in '${round.status}' status, cannot close`);
    }

    const now = new Date().toISOString();
    const result = await this.docClient.send(
      new UpdateCommand({
        TableName: this.roundsTable,
        Key: { round_id: roundId },
        UpdateExpression: "SET #s = :s, closed_at = :ca",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":s": "closed", ":ca": now },
        ReturnValues: "ALL_NEW",
      }),
    );

    return result.Attributes as Round;
  }

  async getActiveRound(groupId: string): Promise<Round | null> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.roundsTable,
        IndexName: "group-rounds-index",
        KeyConditionExpression: "group_id = :gid",
        ExpressionAttributeValues: { ":gid": groupId },
        ScanIndexForward: false, // newest first
      }),
    );

    const rounds = (result.Items ?? []) as Round[];
    // Normalize statuses before searching
    const normalized = rounds.map((r) => ({ ...r, status: normalizeStatus(r.status) }));
    // Find the most recent active (voting) round
    const active = normalized.find((r) => r.status === "voting");
    return active ?? null;
  }

  async getRoundsForGroup(groupId: string): Promise<Round[]> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.roundsTable,
        IndexName: "group-rounds-index",
        KeyConditionExpression: "group_id = :gid",
        ExpressionAttributeValues: { ":gid": groupId },
        ScanIndexForward: false,
      }),
    );

    const rounds = (result.Items ?? []) as Round[];
    return rounds.map((r) => ({ ...r, status: normalizeStatus(r.status) }));
  }

  async persistSuggestions(
    roundId: string,
    suggestions: (Suggestion & { source: "algorithm" | "watchlist" })[],
  ): Promise<RoundSuggestion[]> {
    const items: RoundSuggestion[] = [];
    for (const s of suggestions) {
      const item: RoundSuggestion = {
        round_id: roundId,
        ...s,
      };
      await this.docClient.send(
        new PutCommand({
          TableName: this.suggestionsTable,
          Item: item,
        }),
      );
      items.push(item);
    }
    return items;
  }

  async pickMovie(
    roundId: string,
    tmdbMovieId: number,
    userId: string,
  ): Promise<Pick> {
    const round = await this.getRoundBasic(roundId);
    if (!round) {
      throw new NotFoundError("Round not found");
    }

    // Only creator can pick
    const member = await this.groupService.requireMember(round.group_id, userId);
    if ((member as any).role !== "creator") {
      throw new ForbiddenError("Only the group creator can pick a movie");
    }

    // Round must be voting or closed to pick a movie
    if (round.status !== "voting" && round.status !== "closed") {
      throw new ConflictError(
        `Round is in '${round.status}' status, cannot pick`,
      );
    }

    // Verify movie is in round's suggestions
    const suggestionResult = await this.docClient.send(
      new GetCommand({
        TableName: this.suggestionsTable,
        Key: { round_id: roundId, tmdb_movie_id: tmdbMovieId },
      }),
    );
    if (!suggestionResult.Item) {
      throw new ValidationError("Movie not in this round");
    }

    const suggestion = suggestionResult.Item as RoundSuggestion;

    if (!this.pickService) {
      throw new Error("PickService is required for pickMovie");
    }

    // Create pick with conditional write (prevents duplicates)
    const pick = await this.pickService.createPickForRound({
      group_id: round.group_id,
      round_id: roundId,
      tmdb_movie_id: tmdbMovieId,
      picked_by: userId,
      title: suggestion.title,
      poster_path: suggestion.poster_path,
    });

    // Atomically transition round to 'selected' — attribute_not_exists(pick_id)
    // prevents a second pick even if two requests race past the query pre-check
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.roundsTable,
          Key: { round_id: roundId },
          UpdateExpression: "SET #s = :s, pick_id = :pid",
          ConditionExpression: "attribute_not_exists(pick_id)",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: { ":s": "selected", ":pid": pick.pick_id },
        }),
      );
    } catch (err: any) {
      if (err.name === "ConditionalCheckFailedException") {
        throw new ConflictError("A pick already exists for this round");
      }
      throw err;
    }

    return pick;
  }

  /**
   * Transition a round to a new status with validation.
   * Valid transitions:
   *   voting -> closed (creator only, existing closeRound method)
   *   selected -> watched (any member)
   *   watched -> rated (creator only, or auto when all attendees rated)
   */
  async transitionStatus(
    roundId: string,
    targetStatus: "watched" | "rated",
    userId: string,
  ): Promise<Round> {
    const round = await this.getRoundBasic(roundId);
    if (!round) {
      throw new NotFoundError("Round not found");
    }

    // Validate membership
    const member = await this.groupService.requireMember(round.group_id, userId);

    // Validate transition
    const validTransitions: Record<string, string[]> = {
      selected: ["watched"],
      watched: ["rated"],
    };
    const allowed = validTransitions[round.status] ?? [];
    if (!allowed.includes(targetStatus)) {
      throw new ConflictError(
        `Cannot transition from '${round.status}' to '${targetStatus}'`,
      );
    }

    // Only creator can close ratings
    if (targetStatus === "rated" && (member as any).role !== "creator") {
      throw new ForbiddenError("Only the group creator can close ratings");
    }

    const now = new Date().toISOString();
    const updateExpr =
      targetStatus === "watched"
        ? "SET #s = :s, watched_at = :ts"
        : "SET #s = :s, rated_at = :ts";

    const result = await this.docClient.send(
      new UpdateCommand({
        TableName: this.roundsTable,
        Key: { round_id: roundId },
        UpdateExpression: updateExpr,
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":s": targetStatus, ":ts": now },
        ReturnValues: "ALL_NEW",
      }),
    );

    return result.Attributes as Round;
  }

  /** Get round without joins (for internal checks) */
  async getRoundBasic(roundId: string): Promise<Round | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.roundsTable,
        Key: { round_id: roundId },
      }),
    );
    if (!result.Item) return null;
    const round = result.Item as Round;
    return { ...round, status: normalizeStatus(round.status) };
  }
}
