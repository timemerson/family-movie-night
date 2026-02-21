import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth.js";
import { GroupService } from "../services/group-service.js";
import { WatchlistService } from "../services/watchlist-service.js";
import { WatchedService } from "../services/watched-service.js";
import { TMDBClient } from "../services/tmdb-client.js";
import { getDocClient, tableName } from "../lib/dynamo.js";
import { NotFoundError } from "../lib/errors.js";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

const movies = new Hono<AppEnv>();

function getGroupService() {
  return new GroupService(
    getDocClient(),
    tableName("GROUPS"),
    tableName("GROUP_MEMBERSHIPS"),
    tableName("USERS"),
  );
}

function getTmdbClient() {
  return new TMDBClient(
    process.env.TMDB_API_KEY ?? "",
    getDocClient(),
    tableName("TMDB_CACHE"),
  );
}

function getWatchlistService() {
  return new WatchlistService(
    getDocClient(),
    tableName("WATCHLIST"),
    tableName("PICKS"),
    tableName("WATCHED_MOVIES"),
  );
}

function getWatchedService() {
  return new WatchedService(
    getDocClient(),
    tableName("WATCHED_MOVIES"),
    tableName("PICKS"),
    getWatchlistService(),
  );
}

// GET /movies/:tmdb_movie_id — get movie details with optional group context
movies.get("/movies/:tmdb_movie_id", async (c) => {
  const userId = c.get("userId");
  const tmdbMovieId = Number(c.req.param("tmdb_movie_id"));
  const groupId = c.req.query("group_id");

  // Fetch TMDB metadata
  const tmdbClient = getTmdbClient();
  const detail = await tmdbClient.getMovieDetails(tmdbMovieId);
  if (!detail) {
    throw new NotFoundError("Movie not found");
  }

  // Fetch streaming providers
  const streaming = await tmdbClient.getWatchProviders(tmdbMovieId);

  const response: any = {
    ...detail,
    streaming,
  };

  // If group_id is provided, add group context
  if (groupId) {
    const groupService = getGroupService();
    await groupService.requireMember(groupId, userId);

    const watchlistService = getWatchlistService();
    const watchedService = getWatchedService();
    const docClient = getDocClient();

    // Watchlist status
    const onWatchlist = await watchlistService.isOnWatchlist(
      groupId,
      tmdbMovieId,
    );
    let watchlistStatus: any = { on_watchlist: false };
    if (onWatchlist) {
      // Get the full watchlist item for added_by info
      const watchlistItems = await watchlistService.getWatchlist(groupId);
      const item = watchlistItems.find(
        (i) => i.tmdb_movie_id === tmdbMovieId,
      );
      if (item) {
        watchlistStatus = {
          on_watchlist: true,
          added_by: item.added_by,
          added_at: item.added_at,
        };
      }
    }

    // Watched status
    const isWatched = await watchedService.isWatched(groupId, tmdbMovieId);
    const watchedStatus: any = { watched: isWatched };
    if (isWatched) {
      const combined = await watchedService.getCombinedWatchedMovies(groupId);
      const watchedItem = combined.find(
        (w) => w.tmdb_movie_id === tmdbMovieId,
      );
      if (watchedItem) {
        watchedStatus.watched_at = watchedItem.watched_at;
        watchedStatus.source = watchedItem.source;
        watchedStatus.marked_by = watchedItem.marked_by;
      }
    }

    // Vote history — find rounds containing this movie
    const voteHistory: any[] = [];
    let activeRound: any = null;

    const roundsResult = await docClient.send(
      new QueryCommand({
        TableName: tableName("ROUNDS"),
        IndexName: "group-rounds-index",
        KeyConditionExpression: "group_id = :gid",
        ExpressionAttributeValues: { ":gid": groupId },
      }),
    );

    const rounds = roundsResult.Items ?? [];
    for (const round of rounds) {
      // Check if movie was in this round's suggestions
      const suggestionsResult = await docClient.send(
        new QueryCommand({
          TableName: tableName("SUGGESTIONS"),
          KeyConditionExpression:
            "round_id = :rid AND tmdb_movie_id = :mid",
          ExpressionAttributeValues: {
            ":rid": round.round_id,
            ":mid": tmdbMovieId,
          },
        }),
      );

      if ((suggestionsResult.Items ?? []).length > 0) {
        // Get votes for this movie in this round
        const votesResult = await docClient.send(
          new QueryCommand({
            TableName: tableName("VOTES"),
            KeyConditionExpression: "round_id = :rid",
            ExpressionAttributeValues: { ":rid": round.round_id },
          }),
        );

        const movieVotes = (votesResult.Items ?? []).filter(
          (v: any) => v.tmdb_movie_id === tmdbMovieId,
        );
        const votesUp = movieVotes.filter(
          (v: any) => v.vote === "up",
        ).length;
        const votesDown = movieVotes.filter(
          (v: any) => v.vote === "down",
        ).length;

        if (round.status === "voting") {
          activeRound = {
            round_id: round.round_id,
            votes_up: votesUp,
            votes_down: votesDown,
            user_vote:
              movieVotes.find((v: any) => v.user_id === userId)?.vote ??
              null,
          };
        } else {
          voteHistory.push({
            round_id: round.round_id,
            created_at: round.created_at,
            votes_up: votesUp,
            votes_down: votesDown,
          });
        }
      }
    }

    response.group_context = {
      watchlist_status: watchlistStatus,
      watched_status: watchedStatus,
      vote_history: voteHistory,
      active_round: activeRound,
    };
  }

  return c.json(response);
});

export { movies };
