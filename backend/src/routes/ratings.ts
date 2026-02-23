import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth.js";
import { GroupService } from "../services/group-service.js";
import { RoundService } from "../services/round-service.js";
import { RatingService } from "../services/rating-service.js";
import { SuggestionService } from "../services/suggestion-service.js";
import { PreferenceService } from "../services/preference-service.js";
import { PickService } from "../services/pick-service.js";
import { WatchlistService } from "../services/watchlist-service.js";
import { WatchedService } from "../services/watched-service.js";
import { TMDBClient } from "../services/tmdb-client.js";
import { SubmitRatingSchema } from "../models/rating.js";
import { getDocClient, tableName } from "../lib/dynamo.js";
import { ValidationError } from "../lib/errors.js";

const ratings = new Hono<AppEnv>();

function getServices() {
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
    [],
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
  const ratingService = new RatingService(
    docClient,
    tableName("RATINGS"),
    tableName("USERS"),
    roundService,
    groupService,
  );
  return { groupService, roundService, ratingService };
}

// POST /rounds/:round_id/ratings — submit a rating
ratings.post("/rounds/:round_id/ratings", async (c) => {
  const userId = c.get("userId");
  const actingMemberId = c.get("actingMemberId");
  const effectiveUserId = actingMemberId ?? userId;
  const roundId = c.req.param("round_id");

  const raw = await c.req.json();
  const parsed = SubmitRatingSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError(
      "Invalid request: rating must be 'loved', 'liked', or 'did_not_like'",
    );
  }

  const { groupService, roundService, ratingService } = getServices();

  // Verify round exists and user is a member of its group
  const round = await roundService.getRoundBasic(roundId);
  if (!round) {
    throw new ValidationError("Round not found");
  }
  await groupService.requireMember(round.group_id, userId);

  const rating = await ratingService.submitRating(
    roundId,
    effectiveUserId,
    parsed.data.rating,
  );

  return c.json(
    {
      round_id: rating.round_id,
      member_id: rating.member_id,
      rating: rating.rating,
      rated_at: rating.rated_at,
    },
    201,
  );
});

// GET /rounds/:round_id/ratings — get ratings for a session
ratings.get("/rounds/:round_id/ratings", async (c) => {
  const userId = c.get("userId");
  const roundId = c.req.param("round_id");

  const { groupService, roundService, ratingService } = getServices();

  // Verify round exists and user is a member of its group
  const round = await roundService.getRoundBasic(roundId);
  if (!round) {
    throw new ValidationError("Round not found");
  }
  await groupService.requireMember(round.group_id, userId);

  const result = await ratingService.getRatingsForSession(roundId);
  return c.json(result);
});

export { ratings };
