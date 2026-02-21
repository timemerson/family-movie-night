import { z } from "zod";

export const VoteSchema = z.object({
  round_id: z.string(),
  vote_key: z.string(), // composite: {tmdb_movie_id}#{user_id}
  tmdb_movie_id: z.number(),
  user_id: z.string(),
  vote: z.enum(["up", "down"]),
  voted_at: z.string(),
});

export type Vote = z.infer<typeof VoteSchema>;

export const SubmitVoteSchema = z.object({
  tmdb_movie_id: z.number({ required_error: "tmdb_movie_id is required" }),
  vote: z.enum(["up", "down"], {
    required_error: "vote is required",
    invalid_type_error: "vote must be 'up' or 'down'",
  }),
});

export type SubmitVoteInput = z.infer<typeof SubmitVoteSchema>;

// --- Round results ---

export interface RoundResultMovie {
  tmdb_movie_id: number;
  title: string;
  poster_path: string | null;
  source: string;
  net_score: number;
  votes_up: number;
  votes_down: number;
  voters: { user_id: string; display_name: string; vote: string }[];
  rank: number;
  tied: boolean;
}

export interface RoundResults {
  round_id: string;
  status: string;
  results: RoundResultMovie[];
  vote_progress: { voted: number; total: number };
}
