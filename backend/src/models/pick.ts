import { z } from "zod";

export const PickSchema = z.object({
  pick_id: z.string(),
  round_id: z.string(),
  group_id: z.string(),
  tmdb_movie_id: z.number(),
  picked_by: z.string(),
  picked_at: z.string(),
  watched: z.boolean(),
  watched_at: z.string().nullable(),
});

export const MarkWatchedSchema = z.object({});

export type Pick = z.infer<typeof PickSchema>;
export type MarkWatchedInput = z.infer<typeof MarkWatchedSchema>;
