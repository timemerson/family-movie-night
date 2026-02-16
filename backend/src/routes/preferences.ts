import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth.js";
import { GroupService } from "../services/group-service.js";
import { PreferenceService } from "../services/preference-service.js";
import { getDocClient, tableName } from "../lib/dynamo.js";
import { PutPreferenceSchema } from "../models/preference.js";
import { ValidationError } from "../lib/errors.js";

const preferences = new Hono<AppEnv>();

function getGroupService() {
  return new GroupService(
    getDocClient(),
    tableName("GROUPS"),
    tableName("GROUP_MEMBERSHIPS"),
    tableName("USERS"),
  );
}

function getPreferenceService() {
  return new PreferenceService(getDocClient(), tableName("PREFERENCES"));
}

// GET /groups/:group_id/preferences — get current user's preferences
preferences.get("/groups/:group_id/preferences", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.param("group_id");

  const groupService = getGroupService();
  await groupService.requireMember(groupId, userId);

  const preferenceService = getPreferenceService();
  const prefs = await preferenceService.getPreferences(groupId, userId);

  if (!prefs) {
    return c.json({
      user_id: userId,
      group_id: groupId,
      genre_likes: [],
      genre_dislikes: [],
      max_content_rating: null,
      updated_at: null,
    });
  }

  return c.json(prefs);
});

// GET /groups/:group_id/preferences/summary — aggregated group preferences
preferences.get("/groups/:group_id/preferences/summary", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.param("group_id");

  const groupService = getGroupService();
  await groupService.requireMember(groupId, userId);

  const preferenceService = getPreferenceService();
  const summary = await preferenceService.getGroupPreferenceSummary(groupId);

  return c.json(summary);
});

// PUT /groups/:group_id/preferences — set or replace preferences
preferences.put("/groups/:group_id/preferences", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.param("group_id");

  const groupService = getGroupService();
  await groupService.requireMember(groupId, userId);

  const body = await c.req.json();
  const parsed = PutPreferenceSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0].message);
  }

  const preferenceService = getPreferenceService();
  const prefs = await preferenceService.putPreferences(
    groupId,
    userId,
    parsed.data,
  );

  return c.json(prefs);
});

export { preferences };
