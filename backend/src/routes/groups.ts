import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth.js";
import { GroupService } from "../services/group-service.js";
import { InviteService } from "../services/invite-service.js";
import { UserService } from "../services/user-service.js";
import { RoundService } from "../services/round-service.js";
import { RatingService } from "../services/rating-service.js";
import { PreferenceService } from "../services/preference-service.js";
import { PickService } from "../services/pick-service.js";
import { SuggestionService } from "../services/suggestion-service.js";
import { WatchlistService } from "../services/watchlist-service.js";
import { WatchedService } from "../services/watched-service.js";
import { TMDBClient } from "../services/tmdb-client.js";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { getDocClient, tableName } from "../lib/dynamo.js";
import { CreateGroupSchema, UpdateGroupSchema, CreateManagedMemberSchema } from "../models/group.js";
import { ValidationError, ConflictError } from "../lib/errors.js";

const groups = new Hono<AppEnv>();

function getGroupService() {
  return new GroupService(
    getDocClient(),
    tableName("GROUPS"),
    tableName("GROUP_MEMBERSHIPS"),
    tableName("USERS"),
  );
}

function getInviteService() {
  return new InviteService(getDocClient(), tableName("INVITES"));
}

function getUserService() {
  return new UserService(getDocClient(), tableName("USERS"));
}

// GET /groups/me — get the current user's group (or null)
groups.get("/groups/me", async (c) => {
  const userId = c.get("userId");

  const groupService = getGroupService();
  const membership = await groupService.getUserGroup(userId);

  if (!membership) {
    return c.json({ group: null });
  }

  const group = await groupService.getGroupWithMembers(membership.group_id);
  return c.json(group);
});

// POST /groups — create a new group
groups.post("/groups", async (c) => {
  const userId = c.get("userId");
  const email = c.get("email");
  const body = await c.req.json();

  const parsed = CreateGroupSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0].message);
  }

  // Check if user is already in a group (v1: one group per user)
  const groupService = getGroupService();
  const existing = await groupService.getUserGroup(userId);
  if (existing) {
    throw new ConflictError("You are already in a group");
  }

  // Get the user's profile for display name/avatar
  const userService = getUserService();
  const user = await userService.getOrCreateUser(userId, email);

  const group = await groupService.createGroup(
    userId,
    parsed.data.name,
    user.display_name,
    user.avatar_key,
  );

  return c.json(group, 201);
});

// GET /groups/:group_id — get group details (members only)
groups.get("/groups/:group_id", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.param("group_id");

  const groupService = getGroupService();
  await groupService.requireMember(groupId, userId);

  const group = await groupService.getGroupWithMembers(groupId);
  return c.json(group);
});

// PATCH /groups/:group_id — update group (creator only)
groups.patch("/groups/:group_id", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.param("group_id");
  const body = await c.req.json();

  const parsed = UpdateGroupSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0].message);
  }

  const groupService = getGroupService();
  const group = await groupService.updateGroup(groupId, userId, parsed.data);

  return c.json(group);
});

// DELETE /groups/:group_id/members/me — leave group
// NOTE: This endpoint only allows a user to remove themselves (userId from JWT).
// A future "kick member" endpoint should verify the caller is the group creator.
groups.delete("/groups/:group_id/members/me", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.param("group_id");

  const groupService = getGroupService();
  await groupService.leaveGroup(groupId, userId);

  return c.body(null, 204);
});

// POST /groups/:group_id/members/managed — create managed member (creator only)
groups.post("/groups/:group_id/members/managed", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.param("group_id");

  const body = await c.req.json();
  const parsed = CreateManagedMemberSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0].message);
  }

  const groupService = getGroupService();
  await groupService.requireCreator(groupId, userId);

  const userService = getUserService();
  const member = await groupService.addManagedMember(
    groupId,
    userId,
    parsed.data.display_name,
    parsed.data.avatar_key,
    userService,
  );

  return c.json(member, 201);
});

// DELETE /groups/:group_id/members/:member_id — remove a member
groups.delete("/groups/:group_id/members/:member_id", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.param("group_id");
  const memberId = c.req.param("member_id");

  const groupService = getGroupService();
  const userService = getUserService();

  await groupService.removeMember(groupId, memberId, userId, userService);

  return c.body(null, 204);
});

// POST /groups/:group_id/invites — create invite (creator only)
groups.post("/groups/:group_id/invites", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.param("group_id");

  const groupService = getGroupService();
  await groupService.requireCreator(groupId, userId);

  const inviteService = getInviteService();
  const invite = await inviteService.createInvite(groupId, userId);

  return c.json(
    {
      invite_id: invite.invite_id,
      invite_token: invite.invite_token,
      invite_url: InviteService.inviteUrl(invite.invite_token),
      status: invite.status,
      expires_at: invite.expires_at,
    },
    201,
  );
});

// GET /groups/:group_id/invites — list pending invites (creator only)
groups.get("/groups/:group_id/invites", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.param("group_id");

  const groupService = getGroupService();
  await groupService.requireCreator(groupId, userId);

  const inviteService = getInviteService();
  const invites = await inviteService.listGroupInvites(groupId);

  return c.json({
    invites: invites.map((i) => ({
      invite_id: i.invite_id,
      status: i.status,
      created_at: i.created_at,
      expires_at: i.expires_at,
    })),
  });
});

// DELETE /groups/:group_id/invites/:invite_id — revoke invite (creator only)
groups.delete("/groups/:group_id/invites/:invite_id", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.param("group_id");
  const inviteId = c.req.param("invite_id");

  const groupService = getGroupService();
  await groupService.requireCreator(groupId, userId);

  const inviteService = getInviteService();
  await inviteService.revokeInvite(inviteId, groupId);

  return c.body(null, 204);
});

// GET /groups/:group_id/sessions — paginated list of past sessions
groups.get("/groups/:group_id/sessions", async (c) => {
  const userId = c.get("userId");
  const groupId = c.req.param("group_id");

  const groupService = getGroupService();
  await groupService.requireMember(groupId, userId);

  const docClient = getDocClient();
  const preferenceService = new PreferenceService(docClient, tableName("PREFERENCES"));
  const pickService = new PickService(docClient, tableName("PICKS"), tableName("GROUP_MEMBERSHIPS"));
  const tmdbClient = new TMDBClient(process.env.TMDB_API_KEY ?? "", docClient, tableName("TMDB_CACHE"));
  const watchlistService = new WatchlistService(docClient, tableName("WATCHLIST"), tableName("PICKS"), tableName("WATCHED_MOVIES"));
  const watchedService = new WatchedService(docClient, tableName("WATCHED_MOVIES"), tableName("PICKS"), watchlistService);
  const suggestionService = new SuggestionService(preferenceService, pickService, tmdbClient, [], watchedService);
  const roundService = new RoundService(
    docClient, tableName("ROUNDS"), tableName("SUGGESTIONS"), tableName("VOTES"), tableName("PICKS"),
    groupService, suggestionService, watchlistService, watchedService, pickService,
  );
  const ratingService = new RatingService(docClient, tableName("RATINGS"), tableName("USERS"), roundService, groupService);

  // Pagination: DynamoDB-level cursor + limit
  const cursor = c.req.query("cursor") ?? undefined;
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 50);

  // Query only the page of rounds we need (newest first)
  const { rounds, nextCursor } = await roundService.getRoundsForGroup(groupId, { limit, cursor });

  // Get members for display names
  const members = await groupService.getMembers(groupId);
  const memberMap = new Map(
    members.map((m: any) => [m.user_id, { display_name: m.display_name ?? m.user_id, avatar_key: m.avatar_key ?? "avatar_bear" }]),
  );

  // Enrich only the page of rounds
  const sessions = await Promise.all(
    rounds.map(async (round) => {
      // Get pick info if exists
      let pick = null;
      if (round.pick_id) {
        try {
          const pickResult = await docClient.send(
            new GetCommand({ TableName: tableName("PICKS"), Key: { pick_id: round.pick_id } }),
          );
          if (pickResult.Item) {
            // Get suggestion title/poster for pick
            const sugResult = await docClient.send(
              new GetCommand({
                TableName: tableName("SUGGESTIONS"),
                Key: { round_id: round.round_id, tmdb_movie_id: pickResult.Item.tmdb_movie_id },
              }),
            );
            pick = {
              tmdb_movie_id: pickResult.Item.tmdb_movie_id,
              title: sugResult.Item?.title ?? "",
              poster_path: sugResult.Item?.poster_path ?? null,
            };
          }
        } catch {
          // Skip if pick lookup fails
        }
      }

      // Get ratings summary
      let ratings_summary = null;
      if (["watched", "rated"].includes(round.status)) {
        try {
          const ratingsData = await ratingService.getRatingsForSession(round.round_id);
          const loved = ratingsData.ratings.filter((r) => r.rating === "loved").length;
          const liked = ratingsData.ratings.filter((r) => r.rating === "liked").length;
          const did_not_like = ratingsData.ratings.filter((r) => r.rating === "did_not_like").length;
          ratings_summary = { loved, liked, did_not_like };
        } catch {
          // Skip if ratings lookup fails
        }
      }

      // Build attendees list
      const attendeeIds = round.attendees ?? members.map((m: any) => m.user_id);
      const attendees = attendeeIds.map((id: string) => {
        const info = memberMap.get(id);
        return {
          member_id: id,
          display_name: info?.display_name ?? id,
          avatar_key: info?.avatar_key ?? "avatar_bear",
        };
      });

      return {
        round_id: round.round_id,
        status: round.status,
        created_at: round.created_at,
        attendees,
        pick,
        ratings_summary,
      };
    }),
  );

  return c.json({ sessions, next_cursor: nextCursor });
});

// POST /invites/:invite_token/accept — accept invite and join group
groups.post("/invites/:invite_token/accept", async (c) => {
  const userId = c.get("userId");
  const token = c.req.param("invite_token");

  const inviteService = getInviteService();
  const invite = await inviteService.getInviteByToken(token);

  // Validate invite is still usable (pending + not expired)
  inviteService.validateInvite(invite);

  // Check user isn't already in a group
  const groupService = getGroupService();
  const existingGroup = await groupService.getUserGroup(userId);
  if (existingGroup) {
    throw new ConflictError("You are already in a group");
  }

  // Verify the group still exists and get its name for the response
  const group = await groupService.getGroup(invite.group_id);

  // Add user to the group (transaction enforces capacity + uniqueness)
  await groupService.addMember(invite.group_id, userId);

  return c.json({
    group_id: invite.group_id,
    group_name: group.name,
    role: "member",
  });
});

export { groups };
