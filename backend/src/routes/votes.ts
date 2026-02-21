import { Hono } from "hono";
import type { AppEnv } from "../middleware/auth.js";
import { GroupService } from "../services/group-service.js";
import { VoteService } from "../services/vote-service.js";
import { RoundService } from "../services/round-service.js";
import { SubmitVoteSchema } from "../models/vote.js";
import { getDocClient, tableName } from "../lib/dynamo.js";
import { ValidationError } from "../lib/errors.js";

const votes = new Hono<AppEnv>();

function getVoteService() {
  const docClient = getDocClient();
  return new VoteService(
    docClient,
    tableName("VOTES"),
    tableName("ROUNDS"),
    tableName("SUGGESTIONS"),
    tableName("GROUP_MEMBERSHIPS"),
  );
}

function getGroupService() {
  return new GroupService(
    getDocClient(),
    tableName("GROUPS"),
    tableName("GROUP_MEMBERSHIPS"),
    tableName("USERS"),
  );
}

// POST /rounds/:round_id/votes — submit or change a vote
votes.post("/rounds/:round_id/votes", async (c) => {
  const userId = c.get("userId");
  const roundId = c.req.param("round_id");

  const raw = await c.req.json();
  const parsed = SubmitVoteSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => i.message).join(", "),
    );
  }

  const voteService = getVoteService();
  const vote = await voteService.submitVote(
    roundId,
    parsed.data.tmdb_movie_id,
    userId,
    parsed.data.vote,
  );

  return c.json(vote);
});

// GET /rounds/:round_id/results — get ranked voting results
votes.get("/rounds/:round_id/results", async (c) => {
  const userId = c.get("userId");
  const roundId = c.req.param("round_id");

  const docClient = getDocClient();
  // Get round to verify group membership
  const roundResult = await docClient.send(
    new (await import("@aws-sdk/lib-dynamodb")).GetCommand({
      TableName: tableName("ROUNDS"),
      Key: { round_id: roundId },
    }),
  );

  const round = roundResult.Item;
  if (!round) {
    const { NotFoundError } = await import("../lib/errors.js");
    throw new NotFoundError("Round not found");
  }

  // Verify membership
  const groupService = getGroupService();
  await groupService.requireMember(round.group_id, userId);

  // Get member display names
  const members = await groupService.getMembers(round.group_id);
  const memberNames = new Map(
    members.map((m: any) => [m.user_id, m.display_name ?? m.user_id]),
  );

  const voteService = getVoteService();
  const results = await voteService.getRoundResults(roundId, memberNames);
  const progress = await voteService.getVoteProgress(roundId, round.group_id);

  return c.json({
    round_id: roundId,
    status: round.status,
    results,
    vote_progress: progress,
  });
});

export { votes };
