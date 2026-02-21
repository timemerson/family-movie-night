import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth.js";
import { GroupService } from "../services/group-service.js";
import { PickService } from "../services/pick-service.js";
import { WatchlistService } from "../services/watchlist-service.js";
import { WatchedService } from "../services/watched-service.js";
import { MarkWatchedDirectSchema } from "../models/watched-movie.js";
import { getDocClient, tableName } from "../lib/dynamo.js";
import { ValidationError } from "../lib/errors.js";

const picks = new Hono<AppEnv>();

function getGroupService() {
  return new GroupService(
    getDocClient(),
    tableName("GROUPS"),
    tableName("GROUP_MEMBERSHIPS"),
    tableName("USERS"),
  );
}

function getPickService() {
  return new PickService(
    getDocClient(),
    tableName("PICKS"),
    tableName("GROUP_MEMBERSHIPS"),
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

// POST /groups/:group_id/picks/:pick_id/watched — mark a pick as watched
picks.post("/groups/:group_id/picks/:pick_id/watched", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.param("group_id");
  const pickId = c.req.param("pick_id");

  const groupService = getGroupService();
  await groupService.requireMember(groupId, userId);

  const pickService = getPickService();
  const pick = await pickService.markWatched(pickId, userId, groupId);

  return c.json(pick);
});

// POST /groups/:group_id/watched — mark a movie as directly watched
picks.post("/groups/:group_id/watched", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.param("group_id");

  const groupService = getGroupService();
  await groupService.requireMember(groupId, userId);

  const body = await c.req.json();
  const parsed = MarkWatchedDirectSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0].message);
  }

  const watchedService = getWatchedService();
  const item = await watchedService.markDirectlyWatched(
    groupId,
    parsed.data.tmdb_movie_id,
    userId,
    {
      title: parsed.data.title,
      poster_path: parsed.data.poster_path,
      year: parsed.data.year,
    },
  );

  return c.json(item, 201);
});

// DELETE /groups/:group_id/watched/:tmdb_movie_id — undo direct mark-watched
picks.delete("/groups/:group_id/watched/:tmdb_movie_id", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.param("group_id");
  const tmdbMovieId = Number(c.req.param("tmdb_movie_id"));

  const groupService = getGroupService();
  const membership = await groupService.requireMember(groupId, userId);

  const watchedService = getWatchedService();
  await watchedService.unmarkDirectlyWatched(
    groupId,
    tmdbMovieId,
    userId,
    membership.role,
  );

  return c.body(null, 204);
});

// GET /groups/:group_id/watched — get combined watched list
picks.get("/groups/:group_id/watched", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.param("group_id");

  const groupService = getGroupService();
  await groupService.requireMember(groupId, userId);

  const watchedService = getWatchedService();
  const watchedMovies = await watchedService.getCombinedWatchedMovies(groupId);

  return c.json({ watched_movies: watchedMovies });
});

export { picks };
