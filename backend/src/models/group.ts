import { z } from "zod";

export const CreateGroupSchema = z.object({
  name: z.string().min(1).max(40),
});

export const UpdateGroupSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  streaming_services: z.array(z.string().min(1).max(50)).max(20).optional(),
});

export const GroupSchema = z.object({
  group_id: z.string(),
  name: z.string(),
  created_by: z.string(),
  streaming_services: z.array(z.string()).default([]),
  member_count: z.number().default(0),
  created_at: z.string(),
});

export const GroupMemberSchema = z.object({
  group_id: z.string(),
  user_id: z.string(),
  role: z.enum(["creator", "member"]),
  member_type: z.enum(["independent", "managed"]).optional().default("independent"),
  joined_at: z.string(),
});

export type Group = z.infer<typeof GroupSchema>;
export type GroupMember = z.infer<typeof GroupMemberSchema>;
export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>;
