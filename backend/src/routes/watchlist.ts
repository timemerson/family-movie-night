import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth.js";
import { GroupService } from "../services/group-service.js";
import { WatchlistService } from "../services/watchlist-service.js";
import { AddToWatchlistSchema } from "../models/watchlist.js";
import { getDocClient, tableName } from "../lib/dynamo.js";
import { ValidationError } from "../lib/errors.js";

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

  const watchlistService = getWatchlistService();
  const item = await watchlistService.addToWatchlist(
    groupId,
    parsed.data.tmdb_movie_id,
    userId,
    {
      title: parsed.data.title,
      poster_path: parsed.data.poster_path,
      year: parsed.data.year,
      genres: parsed.data.genres,
      content_rating: parsed.data.content_rating,
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
