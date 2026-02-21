import { z } from "zod";

export const WatchlistItemSchema = z.object({
  group_id: z.string(),
  tmdb_movie_id: z.number(),
  added_by: z.string(),
  added_at: z.string(),
  title: z.string(),
  poster_path: z.string(),
  year: z.number(),
  genres: z.array(z.string()),
  content_rating: z.string(),
});

export const AddToWatchlistSchema = z.object({
  tmdb_movie_id: z.number({ required_error: "tmdb_movie_id is required" }),
  title: z.string({ required_error: "title is required" }),
  poster_path: z.string({ required_error: "poster_path is required" }),
  year: z.number({ required_error: "year is required" }),
  genres: z.array(z.string()).default([]),
  content_rating: z.string({ required_error: "content_rating is required" }),
});

export type WatchlistItem = z.infer<typeof WatchlistItemSchema>;
export type AddToWatchlistInput = z.infer<typeof AddToWatchlistSchema>;
