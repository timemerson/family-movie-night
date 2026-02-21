import { z } from "zod";
import { SuggestionSchema } from "./suggestion.js";

// --- Round ---

export const RoundSchema = z.object({
  round_id: z.string(),
  group_id: z.string(),
  status: z.enum(["voting", "closed", "picked", "discarded"]),
  started_by: z.string(),
  created_at: z.string(),
  closed_at: z.string().nullable().optional(),
  pick_id: z.string().nullable().optional(),
});

export type Round = z.infer<typeof RoundSchema>;

// --- Create Round Request ---

export const CreateRoundSchema = z.object({
  exclude_movie_ids: z.array(z.number()).optional().default([]),
  include_watchlist: z.boolean().optional().default(false),
});

export type CreateRoundInput = z.infer<typeof CreateRoundSchema>;

// --- Close Round Request ---

export const CloseRoundSchema = z.object({
  status: z.literal("closed"),
});

// --- Pick Movie Request ---

export const PickMovieSchema = z.object({
  tmdb_movie_id: z.number({ required_error: "tmdb_movie_id is required" }),
});

// --- Round Suggestion (persisted to DynamoDB) ---

export const RoundSuggestionSchema = SuggestionSchema.extend({
  round_id: z.string(),
  source: z.enum(["algorithm", "watchlist"]),
});

export type RoundSuggestion = z.infer<typeof RoundSuggestionSchema>;

// --- Round with full details (for GET response) ---

export interface SuggestionWithVotes {
  tmdb_movie_id: number;
  title: string;
  year: number;
  poster_path: string | null;
  genres: string[];
  content_rating: string | null;
  overview: string;
  source: string;
  streaming: { provider_name: string; logo_path: string | null }[];
  score: number;
  reason: string;
  popularity: number;
  vote_average: number;
  votes: { up: number; down: number };
  voters: { user_id: string; display_name: string; vote: string }[];
}

export interface RoundWithDetails {
  round_id: string;
  group_id: string;
  status: string;
  started_by: string;
  created_at: string;
  closed_at?: string | null;
  suggestions: SuggestionWithVotes[];
  vote_progress: { voted: number; total: number };
  pick: {
    pick_id: string;
    tmdb_movie_id: number;
    title: string;
    picked_by: string;
    picked_at: string;
    watched: boolean;
  } | null;
}
