import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth.js";
import { GroupService } from "../services/group-service.js";
import { UserService } from "../services/user-service.js";
import { PreferenceService } from "../services/preference-service.js";
import { getDocClient, tableName } from "../lib/dynamo.js";
import { PutPreferenceSchema } from "../models/preference.js";
import { ValidationError, ForbiddenError } from "../lib/errors.js";

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

/**
 * Resolve the effective member ID from query param, acting-as header, or JWT.
 * Validates ownership: only the creator or the parent of a managed member
 * can access/set another member's preferences.
 */
async function resolvePreferenceMemberId(
  c: any,
  groupId: string,
  groupService: GroupService,
): Promise<string> {
  const userId = c.get("userId");
  const actingMemberId = c.get("actingMemberId");
  const queryMemberId = c.req.query("member_id");

  const effectiveId = queryMemberId ?? actingMemberId ?? userId;

  // If accessing own preferences (direct or via acting-as), no extra check needed
  if (effectiveId === userId || effectiveId === actingMemberId) {
    // Verify the effective member is in this group
    await groupService.requireMember(groupId, effectiveId);
    return effectiveId;
  }

  // Accessing another member's preferences — must be creator or parent
  await groupService.requireMember(groupId, userId);
  const callerMembership = await groupService.getMembership(groupId, userId);

  if (callerMembership?.role === "creator") {
    // Creator can manage any member's preferences
    await groupService.requireMember(groupId, effectiveId);
    return effectiveId;
  }

  // Check if the target is a managed member owned by caller
  const userService = new UserService(getDocClient(), tableName("USERS"));
  const targetUser = await userService.getUser(effectiveId);
  if (targetUser?.is_managed && targetUser.parent_user_id === userId) {
    await groupService.requireMember(groupId, effectiveId);
    return effectiveId;
  }

  throw new ForbiddenError("Cannot access another member's preferences");
}

// GET /groups/:group_id/preferences — get preferences (supports ?member_id=)
preferences.get("/groups/:group_id/preferences", async (c) => {
  const groupId = c.req.param("group_id");

  const groupService = getGroupService();
  const memberId = await resolvePreferenceMemberId(c, groupId, groupService);

  const preferenceService = getPreferenceService();
  const prefs = await preferenceService.getPreferences(groupId, memberId);

  if (!prefs) {
    return c.json({
      user_id: memberId,
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

// PUT /groups/:group_id/preferences — set or replace preferences (supports ?member_id=)
preferences.put("/groups/:group_id/preferences", async (c) => {
  const groupId = c.req.param("group_id");

  const groupService = getGroupService();
  const memberId = await resolvePreferenceMemberId(c, groupId, groupService);

  const body = await c.req.json();
  const parsed = PutPreferenceSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0].message);
  }

  const preferenceService = getPreferenceService();
  const prefs = await preferenceService.putPreferences(
    groupId,
    memberId,
    parsed.data,
  );

  return c.json(prefs);
});

export { preferences };
