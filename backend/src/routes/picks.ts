import { Hono } from "hono";
import { GroupService } from "../services/group-service.js";
import { PickService } from "../services/pick-service.js";
import { getDocClient, tableName } from "../lib/dynamo.js";

const picks = new Hono();

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

// POST /groups/:group_id/picks/:pick_id/watched — mark a pick as watched
picks.post("/groups/:group_id/picks/:pick_id/watched", async (c) => {
  const userId = c.get("userId") as string;
  const groupId = c.req.param("group_id");
  const pickId = c.req.param("pick_id");

  const groupService = getGroupService();
  await groupService.requireMember(groupId, userId);

  const pickService = getPickService();
  const pick = await pickService.markWatched(pickId, userId, groupId);

  return c.json(pick);
});

// GET /groups/:group_id/watched — get watched movie IDs for a group
picks.get("/groups/:group_id/watched", async (c) => {
  const userId = c.get("userId") as string;
  const groupId = c.req.param("group_id");

  const groupService = getGroupService();
  await groupService.requireMember(groupId, userId);

  const pickService = getPickService();
  const movieIds = await pickService.getWatchedMovieIds(groupId);

  return c.json({ movie_ids: movieIds });
});

export { picks };
