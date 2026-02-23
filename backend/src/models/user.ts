import { z } from "zod";

export const UserSchema = z.object({
  user_id: z.string(),
  email: z.string().email().optional().default(""),
  display_name: z.string(),
  avatar_key: z.string().default("avatar_bear"),
  created_at: z.string(),
  is_managed: z.boolean().optional().default(false),
  parent_user_id: z.string().nullable().optional().default(null),
  notification_prefs: z
    .object({
      vote_nudge: z.boolean().default(true),
      pick_announce: z.boolean().default(true),
      new_round: z.boolean().default(true),
    })
    .default({}),
});

export type User = z.infer<typeof UserSchema>;
