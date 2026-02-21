import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth.js";
import { GroupService } from "../services/group-service.js";
import { PreferenceService } from "../services/preference-service.js";
import { PickService } from "../services/pick-service.js";
import { WatchlistService } from "../services/watchlist-service.js";
import { WatchedService } from "../services/watched-service.js";
import { SuggestionService } from "../services/suggestion-service.js";
import { RoundService } from "../services/round-service.js";
import { TMDBClient } from "../services/tmdb-client.js";
import { CreateRoundSchema, CloseRoundSchema, PickMovieSchema } from "../models/round.js";
import { getDocClient, tableName } from "../lib/dynamo.js";
import { ValidationError } from "../lib/errors.js";

const rounds = new Hono<AppEnv>();

function getServices(streamingServices: string[]) {
  const docClient = getDocClient();
  const groupService = new GroupService(
    docClient,
    tableName("GROUPS"),
    tableName("GROUP_MEMBERSHIPS"),
    tableName("USERS"),
  );
  const preferenceService = new PreferenceService(
    docClient,
    tableName("PREFERENCES"),
  );
  const pickService = new PickService(
    docClient,
    tableName("PICKS"),
    tableName("GROUP_MEMBERSHIPS"),
  );
  const tmdbClient = new TMDBClient(
    process.env.TMDB_API_KEY ?? "",
    docClient,
    tableName("TMDB_CACHE"),
  );
  const watchlistService = new WatchlistService(
    docClient,
    tableName("WATCHLIST"),
    tableName("PICKS"),
    tableName("WATCHED_MOVIES"),
  );
  const watchedService = new WatchedService(
    docClient,
    tableName("WATCHED_MOVIES"),
    tableName("PICKS"),
    watchlistService,
  );
  const suggestionService = new SuggestionService(
    preferenceService,
    pickService,
    tmdbClient,
    streamingServices,
    watchedService,
  );
  const roundService = new RoundService(
    docClient,
    tableName("ROUNDS"),
    tableName("SUGGESTIONS"),
    tableName("VOTES"),
    tableName("PICKS"),
    groupService,
    suggestionService,
    watchlistService,
    watchedService,
    pickService,
  );
  return { groupService, roundService };
}

// POST /groups/:group_id/rounds — start a new voting round
rounds.post("/groups/:group_id/rounds", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.param("group_id");

  const docClient = getDocClient();
  const groupService = new GroupService(
    docClient,
    tableName("GROUPS"),
    tableName("GROUP_MEMBERSHIPS"),
    tableName("USERS"),
  );
  await groupService.requireMember(groupId, userId);

  // Get group for streaming services
  const group = await groupService.getGroup(groupId);
  const streamingServices = group?.streaming_services ?? [];

  const { roundService } = getServices(streamingServices);

  // Parse optional body
  let body: { exclude_movie_ids?: number[]; include_watchlist?: boolean } = {};
  try {
    const raw = await c.req.json();
    body = CreateRoundSchema.parse(raw);
  } catch {
    // No body or invalid body — use defaults
  }

  try {
    const result = await roundService.createRound(groupId, userId, {
      exclude_movie_ids: body.exclude_movie_ids,
      include_watchlist: body.include_watchlist,
    });

    return c.json(
      {
        round_id: result.round.round_id,
        group_id: result.round.group_id,
        status: result.round.status,
        started_by: result.round.started_by,
        created_at: result.round.created_at,
        suggestions: result.suggestions,
        watchlist_eligible_count: result.watchlist_eligible_count,
        relaxed_constraints: result.relaxed_constraints,
      },
      201,
    );
  } catch (e: any) {
    if (e.status === 422) {
      return c.json({ error: e.message }, 422);
    }
    if (e.name === "ConflictError") {
      return c.json(
        { error: e.message, active_round_id: e.active_round_id },
        409,
      );
    }
    throw e;
  }
});

// GET /rounds/:round_id — get round details with suggestions, votes, progress
rounds.get("/rounds/:round_id", async (c) => {
  const userId = c.get("userId");
  const roundId = c.req.param("round_id");

  const { groupService, roundService } = getServices([]);

  const roundDetails = await roundService.getRound(roundId);

  // Verify user is a member of the round's group
  await groupService.requireMember(roundDetails.group_id, userId);

  return c.json(roundDetails);
});

// PATCH /rounds/:round_id — close a round (creator only)
rounds.patch("/rounds/:round_id", async (c) => {
  const userId = c.get("userId");
  const roundId = c.req.param("round_id");

  const raw = await c.req.json();
  const parsed = CloseRoundSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError("Invalid request: status must be 'closed'");
  }

  const { roundService } = getServices([]);

  const updated = await roundService.closeRound(roundId, userId);
  return c.json(updated);
});

// POST /rounds/:round_id/pick — lock in a movie pick (creator only)
rounds.post("/rounds/:round_id/pick", async (c) => {
  const userId = c.get("userId");
  const roundId = c.req.param("round_id");

  const raw = await c.req.json();
  const parsed = PickMovieSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError("Invalid request: tmdb_movie_id is required");
  }

  const { groupService, roundService } = getServices([]);

  // Get round to find group_id for membership check
  const round = await roundService.getRoundBasic(roundId);
  if (!round) {
    throw new ValidationError("Round not found");
  }
  await groupService.requireMember(round.group_id, userId);

  const pick = await roundService.pickMovie(roundId, parsed.data.tmdb_movie_id, userId);

  return c.json({
    pick_id: pick.pick_id,
    round_id: pick.round_id,
    group_id: pick.group_id,
    tmdb_movie_id: pick.tmdb_movie_id,
    picked_by: pick.picked_by,
    picked_at: pick.picked_at,
    watched: pick.watched,
  }, 201);
});

export { rounds };
