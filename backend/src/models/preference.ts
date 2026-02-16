import { z } from "zod";

const VALID_RATINGS = ["G", "PG", "PG-13", "R"] as const;

export const PutPreferenceSchema = z
  .object({
    genre_likes: z.array(z.string().min(1).max(10)).min(2).max(20),
    genre_dislikes: z.array(z.string().min(1).max(10)).max(20).default([]),
    max_content_rating: z.enum(VALID_RATINGS),
  })
  .refine(
    (data) => {
      const overlap = data.genre_likes.filter((g) =>
        data.genre_dislikes.includes(g),
      );
      return overlap.length === 0;
    },
    { message: "genre_likes and genre_dislikes must not overlap" },
  );

export const PreferenceSchema = z.object({
  user_id: z.string(),
  group_id: z.string(),
  genre_likes: z.array(z.string()),
  genre_dislikes: z.array(z.string()),
  max_content_rating: z.enum(VALID_RATINGS),
  updated_at: z.string(),
});

export type Preference = z.infer<typeof PreferenceSchema>;
export type PutPreferenceInput = z.infer<typeof PutPreferenceSchema>;
