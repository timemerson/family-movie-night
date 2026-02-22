import { z } from "zod";

export const RatingValueEnum = z.enum(["loved", "liked", "did_not_like"]);
export type RatingValue = z.infer<typeof RatingValueEnum>;

export const RatingSchema = z.object({
  round_id: z.string(),
  member_id: z.string(),
  rating: RatingValueEnum,
  rated_at: z.string(),
});

export type Rating = z.infer<typeof RatingSchema>;

export const SubmitRatingSchema = z.object({
  rating: RatingValueEnum,
});

export type SubmitRatingInput = z.infer<typeof SubmitRatingSchema>;
