import { z } from "zod";

export const InviteSchema = z.object({
  invite_id: z.string(),
  group_id: z.string(),
  created_by: z.string(),
  invite_token: z.string(),
  status: z.enum(["pending", "accepted", "revoked", "expired"]),
  created_at: z.string(),
  expires_at: z.string(),
  ttl: z.number(),
});

export type Invite = z.infer<typeof InviteSchema>;
