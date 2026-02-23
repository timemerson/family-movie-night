import {
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Vote } from "../models/vote.js";
import type { RoundResultMovie } from "../models/vote.js";
import type { RoundSuggestion } from "../models/round.js";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../lib/errors.js";

export class VoteService {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly votesTable: string,
    private readonly roundsTable: string,
    private readonly suggestionsTable: string,
    private readonly membershipsTable: string,
  ) {}

  async submitVote(
    roundId: string,
    tmdbMovieId: number,
    userId: string,
    vote: "up" | "down",
  ): Promise<Vote> {
    // Get round and verify status
    const roundResult = await this.docClient.send(
      new GetCommand({
        TableName: this.roundsTable,
        Key: { round_id: roundId },
      }),
    );

    const round = roundResult.Item;
    if (!round) {
      throw new NotFoundError("Round not found");
    }

    if (round.status !== "voting") {
      throw new ValidationError("Round is not accepting votes");
    }

    // Verify user is a group member
    const memberResult = await this.docClient.send(
      new GetCommand({
        TableName: this.membershipsTable,
        Key: { group_id: round.group_id, user_id: userId },
      }),
    );

    if (!memberResult.Item) {
      throw new ForbiddenError("Not a member of this group");
    }

    // If round has an attendees list, verify user is an attendee
    if (round.attendees && round.attendees.length > 0) {
      if (!round.attendees.includes(userId)) {
        throw new ForbiddenError("You are not an attendee of this round");
      }
    }

    // Verify movie is in the round's suggestions
    const suggestionResult = await this.docClient.send(
      new GetCommand({
        TableName: this.suggestionsTable,
        Key: { round_id: roundId, tmdb_movie_id: tmdbMovieId },
      }),
    );

    if (!suggestionResult.Item) {
      throw new ValidationError("Movie not in this round");
    }

    // Write vote (upsert — PutItem overwrites)
    const now = new Date().toISOString();
    const voteKey = `${tmdbMovieId}#${userId}`;
    const voteItem: Vote = {
      round_id: roundId,
      vote_key: voteKey,
      tmdb_movie_id: tmdbMovieId,
      user_id: userId,
      vote,
      voted_at: now,
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.votesTable,
        Item: voteItem,
      }),
    );

    return voteItem;
  }

  async getVotesForRound(roundId: string): Promise<Vote[]> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.votesTable,
        KeyConditionExpression: "round_id = :rid",
        ExpressionAttributeValues: { ":rid": roundId },
      }),
    );

    return (result.Items ?? []) as Vote[];
  }

  async getUserVotesForRound(roundId: string, userId: string): Promise<Vote[]> {
    const allVotes = await this.getVotesForRound(roundId);
    return allVotes.filter((v) => v.user_id === userId);
  }

  async getRoundResults(
    roundId: string,
    memberDisplayNames: Map<string, string>,
  ): Promise<RoundResultMovie[]> {
    // Get suggestions for this round
    const suggestionsResult = await this.docClient.send(
      new QueryCommand({
        TableName: this.suggestionsTable,
        KeyConditionExpression: "round_id = :rid",
        ExpressionAttributeValues: { ":rid": roundId },
      }),
    );
    const suggestions = (suggestionsResult.Items ?? []) as RoundSuggestion[];

    // Get all votes for this round
    const votes = await this.getVotesForRound(roundId);

    // Aggregate votes per movie
    const votesByMovie = new Map<number, Vote[]>();
    for (const v of votes) {
      const arr = votesByMovie.get(v.tmdb_movie_id) ?? [];
      arr.push(v);
      votesByMovie.set(v.tmdb_movie_id, arr);
    }

    // Build results
    const results: (RoundResultMovie & { popularity: number })[] = suggestions.map((s) => {
      const movieVotes = votesByMovie.get(s.tmdb_movie_id) ?? [];
      const votesUp = movieVotes.filter((v) => v.vote === "up").length;
      const votesDown = movieVotes.filter((v) => v.vote === "down").length;
      const netScore = votesUp - votesDown;
      const voters = movieVotes.map((v) => ({
        user_id: v.user_id,
        display_name: memberDisplayNames.get(v.user_id) ?? v.user_id,
        vote: v.vote,
      }));

      return {
        tmdb_movie_id: s.tmdb_movie_id,
        title: s.title,
        poster_path: s.poster_path,
        source: s.source,
        net_score: netScore,
        votes_up: votesUp,
        votes_down: votesDown,
        voters,
        rank: 0,
        tied: false,
        popularity: s.popularity,
      };
    });

    // Sort: net_score DESC, then popularity DESC (tie-break)
    results.sort((a, b) => {
      if (b.net_score !== a.net_score) return b.net_score - a.net_score;
      return b.popularity - a.popularity;
    });

    // Assign ranks and detect ties
    for (let i = 0; i < results.length; i++) {
      if (i === 0) {
        results[i].rank = 1;
      } else {
        const prev = results[i - 1];
        if (
          results[i].net_score === prev.net_score &&
          results[i].popularity === prev.popularity
        ) {
          results[i].rank = prev.rank;
          results[i].tied = true;
          prev.tied = true;
        } else {
          results[i].rank = i + 1;
        }
      }
    }

    // Return without the internal popularity field
    return results.map(({ popularity: _, ...rest }) => rest);
  }

  async getVoteProgress(
    roundId: string,
    groupId: string,
    attendees?: string[] | null,
  ): Promise<{ voted: number; total: number }> {
    // Get all votes to count unique voters
    const votes = await this.getVotesForRound(roundId);
    const uniqueVoters = new Set(votes.map((v) => v.user_id));

    // Use attendees as denominator when present, otherwise fall back to all members
    if (attendees && attendees.length > 0) {
      // Only count voters who are in the attendees list
      const attendeeSet = new Set(attendees);
      const attendeeVoters = [...uniqueVoters].filter((v) => attendeeSet.has(v));
      return {
        voted: attendeeVoters.length,
        total: attendees.length,
      };
    }

    // Fallback: all group members
    const membersResult = await this.docClient.send(
      new QueryCommand({
        TableName: this.membershipsTable,
        KeyConditionExpression: "group_id = :gid",
        ExpressionAttributeValues: { ":gid": groupId },
      }),
    );

    return {
      voted: uniqueVoters.size,
      total: (membersResult.Items ?? []).length,
    };
  }
}
