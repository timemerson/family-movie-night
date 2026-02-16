import { Hono } from "hono";
import { GroupService } from "../services/group-service.js";
import { InviteService } from "../services/invite-service.js";
import { UserService } from "../services/user-service.js";
import { getDocClient, tableName } from "../lib/dynamo.js";
import { CreateGroupSchema, UpdateGroupSchema } from "../models/group.js";
import { ValidationError, ConflictError } from "../lib/errors.js";

const groups = new Hono();

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

// POST /groups — create a new group
groups.post("/groups", async (c) => {
  const userId = c.get("userId") as string;
  const email = c.get("email") as string;
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
  const userId = c.get("userId") as string;
  const groupId = c.req.param("group_id");

  const groupService = getGroupService();
  await groupService.requireMember(groupId, userId);

  const group = await groupService.getGroupWithMembers(groupId);
  return c.json(group);
});

// PATCH /groups/:group_id — update group (creator only)
groups.patch("/groups/:group_id", async (c) => {
  const userId = c.get("userId") as string;
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
groups.delete("/groups/:group_id/members/me", async (c) => {
  const userId = c.get("userId") as string;
  const groupId = c.req.param("group_id");

  const groupService = getGroupService();
  await groupService.leaveGroup(groupId, userId);

  return c.body(null, 204);
});

// POST /groups/:group_id/invites — create invite (creator only)
groups.post("/groups/:group_id/invites", async (c) => {
  const userId = c.get("userId") as string;
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
  const userId = c.get("userId") as string;
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
  const userId = c.get("userId") as string;
  const groupId = c.req.param("group_id");
  const inviteId = c.req.param("invite_id");

  const groupService = getGroupService();
  await groupService.requireCreator(groupId, userId);

  const inviteService = getInviteService();
  await inviteService.revokeInvite(inviteId, groupId);

  return c.body(null, 204);
});

// POST /invites/:invite_token/accept — accept invite and join group
groups.post("/invites/:invite_token/accept", async (c) => {
  const userId = c.get("userId") as string;
  const token = c.req.param("invite_token");

  const inviteService = getInviteService();
  const invite = await inviteService.getInviteByToken(token);

  // Check user isn't already in a group
  const groupService = getGroupService();
  const existingGroup = await groupService.getUserGroup(userId);
  if (existingGroup) {
    throw new ConflictError("You are already in a group");
  }

  // Validate and accept the invite
  await inviteService.acceptInvite(invite);

  // Add user to the group
  await groupService.addMember(invite.group_id, userId);

  // Get group name for response
  const group = await groupService.getGroup(invite.group_id);

  return c.json({
    group_id: invite.group_id,
    group_name: group.name,
    role: "member",
  });
});

export { groups };
