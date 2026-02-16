import { Hono } from "hono";
import { GroupService } from "../services/group-service.js";
import { PreferenceService } from "../services/preference-service.js";
import { PickService } from "../services/pick-service.js";
import { SuggestionService } from "../services/suggestion-service.js";
import { TMDBClient } from "../services/tmdb-client.js";
import { getDocClient, tableName } from "../lib/dynamo.js";

const suggestions = new Hono();

function getGroupService() {
  return new GroupService(
    getDocClient(),
    tableName("GROUPS"),
    tableName("GROUP_MEMBERSHIPS"),
    tableName("USERS"),
  );
}

function getSuggestionService(streamingServices: string[]) {
  const docClient = getDocClient();
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
  return new SuggestionService(
    preferenceService,
    pickService,
    tmdbClient,
    streamingServices,
  );
}

// GET /groups/:group_id/suggestions — get movie suggestions for the group
suggestions.get("/groups/:group_id/suggestions", async (c) => {
  const userId = c.get("userId") as string;
  const groupId = c.req.param("group_id");

  const groupService = getGroupService();
  await groupService.requireMember(groupId, userId);

  // Get group to access streaming services
  const group = await groupService.getGroup(groupId);
  const streamingServices = group?.streaming_services ?? [];

  // Parse optional exclude_movie_ids from query string
  const excludeParam = c.req.query("exclude_movie_ids");
  const excludeMovieIds = excludeParam
    ? excludeParam.split(",").map(Number).filter((n) => !isNaN(n))
    : [];

  const suggestionService = getSuggestionService(streamingServices);
  const result = await suggestionService.getSuggestions(groupId, excludeMovieIds);

  return c.json(result);
});

export { suggestions };
