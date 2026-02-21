import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth.js";
import { GroupService } from "../services/group-service.js";
import { WatchlistService } from "../services/watchlist-service.js";
import { TMDBClient } from "../services/tmdb-client.js";
import { AddToWatchlistSchema } from "../models/watchlist.js";
import { getDocClient, tableName } from "../lib/dynamo.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";

const watchlist = new Hono<AppEnv>();

function getGroupService() {
  return new GroupService(
    getDocClient(),
    tableName("GROUPS"),
    tableName("GROUP_MEMBERSHIPS"),
    tableName("USERS"),
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

function getTmdbClient() {
  return new TMDBClient(
    process.env.TMDB_API_KEY ?? "",
    getDocClient(),
    tableName("TMDB_CACHE"),
  );
}

// POST /groups/:group_id/watchlist — add movie to watchlist
watchlist.post("/groups/:group_id/watchlist", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.param("group_id");

  const groupService = getGroupService();
  await groupService.requireMember(groupId, userId);

  const body = await c.req.json();
  const parsed = AddToWatchlistSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0].message);
  }

  // Fetch verified metadata from TMDB
  const tmdbClient = getTmdbClient();
  const detail = await tmdbClient.getMovieDetails(parsed.data.tmdb_movie_id);
  if (!detail) {
    throw new NotFoundError("Movie not found on TMDB");
  }

  const watchlistService = getWatchlistService();
  const item = await watchlistService.addToWatchlist(
    groupId,
    parsed.data.tmdb_movie_id,
    userId,
    {
      title: detail.title,
      poster_path: detail.poster_path ?? "",
      year: detail.year,
      genres: detail.genres,
      content_rating: detail.content_rating ?? "",
    },
  );

  return c.json(item, 201);
});

// GET /groups/:group_id/watchlist — list group's watchlist
watchlist.get("/groups/:group_id/watchlist", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.param("group_id");

  const groupService = getGroupService();
  await groupService.requireMember(groupId, userId);

  const watchlistService = getWatchlistService();
  const items = await watchlistService.getWatchlist(groupId);

  return c.json({
    items,
    count: items.length,
    max: 50,
  });
});

// DELETE /groups/:group_id/watchlist/:tmdb_movie_id — remove from watchlist
watchlist.delete("/groups/:group_id/watchlist/:tmdb_movie_id", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.param("group_id");
  const tmdbMovieId = Number(c.req.param("tmdb_movie_id"));

  const groupService = getGroupService();
  const membership = await groupService.requireMember(groupId, userId);

  const watchlistService = getWatchlistService();
  await watchlistService.removeFromWatchlist(
    groupId,
    tmdbMovieId,
    userId,
    membership.role,
  );

  return c.body(null, 204);
});

export { watchlist };
