import { z } from "zod";

// --- TMDB API response shapes ---

export const TMDBMovieSchema = z.object({
  id: z.number(),
  title: z.string(),
  overview: z.string(),
  poster_path: z.string().nullable(),
  release_date: z.string(),
  genre_ids: z.array(z.number()),
  popularity: z.number(),
  vote_average: z.number(),
  vote_count: z.number(),
});

export const TMDBDiscoverResponseSchema = z.object({
  page: z.number(),
  total_results: z.number(),
  results: z.array(TMDBMovieSchema),
});

export type TMDBMovie = z.infer<typeof TMDBMovieSchema>;
export type TMDBDiscoverResponse = z.infer<typeof TMDBDiscoverResponseSchema>;

// --- Streaming provider from TMDB watch/providers ---

export const StreamingProviderSchema = z.object({
  provider_name: z.string(),
  logo_path: z.string().nullable(),
});

export type StreamingProvider = z.infer<typeof StreamingProviderSchema>;

// --- Suggestion output (what we return to the client) ---

export const SuggestionSchema = z.object({
  tmdb_movie_id: z.number(),
  title: z.string(),
  year: z.number(),
  poster_path: z.string().nullable(),
  overview: z.string(),
  genres: z.array(z.string()),
  content_rating: z.string().nullable(),
  popularity: z.number(),
  vote_average: z.number(),
  streaming: z.array(StreamingProviderSchema),
  score: z.number(),
  reason: z.string(),
});

export type Suggestion = z.infer<typeof SuggestionSchema>;

export const SuggestionsResponseSchema = z.object({
  suggestions: z.array(SuggestionSchema),
  relaxed_constraints: z.array(z.string()),
});

export type SuggestionsResponse = z.infer<typeof SuggestionsResponseSchema>;

// --- Full movie detail (from TMDB /movie/{id} with appended data) ---

export interface TMDBMovieDetail {
  tmdb_movie_id: number;
  title: string;
  year: number;
  poster_path: string | null;
  overview: string;
  runtime: number;
  genres: string[];
  content_rating: string | null;
  cast: { name: string; character: string }[];
  popularity: number;
  vote_average: number;
  trailer_url: string | null;
}

// --- TMDB genre ID → name mapping ---

export const TMDB_GENRE_MAP: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

// --- MPAA content rating order ---

export const RATING_ORDER = ["G", "PG", "PG-13", "R"] as const;
