import { z } from "zod";

export const WatchedMovieSchema = z.object({
  group_id: z.string(),
  tmdb_movie_id: z.number(),
  marked_by: z.string(),
  watched_at: z.string(),
  title: z.string(),
  poster_path: z.string(),
  year: z.number(),
  source: z.literal("direct"),
});

export const MarkWatchedDirectSchema = z.object({
  tmdb_movie_id: z.number({ required_error: "tmdb_movie_id is required" }),
  title: z.string({ required_error: "title is required" }),
  poster_path: z.string({ required_error: "poster_path is required" }),
  year: z.number({ required_error: "year is required" }),
});

export interface CombinedWatchedMovie {
  tmdb_movie_id: number;
  title: string;
  poster_path: string;
  year: number;
  watched_at: string;
  source: "picked" | "direct";
  marked_by: string;
  pick_id?: string;
  avg_rating?: number;
}

export type WatchedMovie = z.infer<typeof WatchedMovieSchema>;
export type MarkWatchedDirectInput = z.infer<typeof MarkWatchedDirectSchema>;
