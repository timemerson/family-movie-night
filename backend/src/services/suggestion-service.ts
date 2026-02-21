import type { PreferenceService, PreferenceSummary } from "./preference-service.js";
import type { PickService } from "./pick-service.js";
import type { WatchedService } from "./watched-service.js";
import type { TMDBClient } from "./tmdb-client.js";
import type { TMDBMovie, Suggestion, StreamingProvider } from "../models/suggestion.js";
import { TMDB_GENRE_MAP, RATING_ORDER } from "../models/suggestion.js";
import { ValidationError } from "../lib/errors.js";

const MIN_SUGGESTIONS = 3;
const MAX_SUGGESTIONS = 5;

export interface SuggestionsResult {
  suggestions: Suggestion[];
  relaxed_constraints: string[];
}

export class SuggestionService {
  constructor(
    private readonly preferenceService: PreferenceService,
    private readonly pickService: PickService,
    private readonly tmdbClient: TMDBClient,
    private readonly streamingServices: string[],
    private readonly watchedService?: WatchedService,
  ) {}

  async getSuggestions(
    groupId: string,
    excludeMovieIds: number[] = [],
  ): Promise<SuggestionsResult> {
    // Stage 1: Aggregate group preferences
    const summary = await this.preferenceService.getGroupPreferenceSummary(groupId);

    if (summary.member_count < 2) {
      throw new ValidationError(
        "At least 2 members must set preferences before generating suggestions",
      );
    }

    // Stage 3 (early): Get watched movie IDs for exclusion (combined: picks + direct)
    let watchedIds: number[];
    if (this.watchedService) {
      const watchedSet = await this.watchedService.getAllWatchedMovieIds(groupId);
      watchedIds = [...watchedSet];
    } else {
      watchedIds = await this.pickService.getWatchedMovieIds(groupId);
    }
    const excludeSet = new Set([...watchedIds, ...excludeMovieIds]);

    // Stage 2+3+4: Query TMDB, filter, score — with progressive relaxation
    const relaxedConstraints: string[] = [];
    let candidates = await this.queryAndFilter(
      summary,
      excludeSet,
      50,
      "1980-01-01",
    );

    // Constraint relaxation if fewer than MIN_SUGGESTIONS
    if (candidates.length < MIN_SUGGESTIONS) {
      relaxedConstraints.push("expanded_genres");
      candidates = await this.queryAndFilter(
        { ...summary, liked_genres: [], disliked_genres: [] },
        excludeSet,
        50,
        "1980-01-01",
      );
    }

    if (candidates.length < MIN_SUGGESTIONS) {
      relaxedConstraints.push("lowered_popularity_floor");
      candidates = await this.queryAndFilter(
        { ...summary, liked_genres: [], disliked_genres: [] },
        excludeSet,
        10,
        "1980-01-01",
      );
    }

    if (candidates.length < MIN_SUGGESTIONS) {
      relaxedConstraints.push("included_older_movies");
      candidates = await this.queryAndFilter(
        { ...summary, liked_genres: [], disliked_genres: [] },
        excludeSet,
        10,
        "1960-01-01",
      );
    }

    // Stage 4: Score and rank
    const scored = await this.scoreAndRank(candidates, summary);

    // Stage 5: Return top results
    const top = scored.slice(0, MAX_SUGGESTIONS);

    return {
      suggestions: top,
      relaxed_constraints: relaxedConstraints,
    };
  }

  private async queryAndFilter(
    summary: PreferenceSummary,
    excludeSet: Set<number>,
    voteCountGte: number,
    releaseDateGte: string,
  ): Promise<TMDBMovie[]> {
    const likedGenres = summary.liked_genres.length > 0
      ? summary.liked_genres.join(",")
      : undefined;

    const dislikedGenres = summary.disliked_genres.length > 0
      ? summary.disliked_genres.join(",")
      : undefined;

    const certLte = summary.max_content_rating ?? "PG-13";

    const movies = await this.tmdbClient.discoverMovies({
      with_genres: likedGenres ?? "",
      without_genres: dislikedGenres,
      certification_lte: certLte,
      vote_count_gte: voteCountGte,
      primary_release_date_gte: releaseDateGte,
      page: 1,
    });

    // Filter out watched + excluded movies
    return movies.filter((m) => !excludeSet.has(m.id));
  }

  private async scoreAndRank(
    movies: TMDBMovie[],
    summary: PreferenceSummary,
  ): Promise<Suggestion[]> {
    if (movies.length === 0) return [];

    // Normalize popularity
    const maxPop = Math.max(...movies.map((m) => m.popularity));
    const likedGenreSet = new Set(summary.liked_genres.map(Number));

    // Fetch streaming providers in parallel
    const providerResults = await Promise.all(
      movies.map((m) => this.tmdbClient.getWatchProviders(m.id)),
    );

    const scored: {
      movie: TMDBMovie;
      score: number;
      streaming: StreamingProvider[];
      reason: string;
    }[] = [];

    for (let i = 0; i < movies.length; i++) {
      const movie = movies[i];
      const providers = providerResults[i];

      const popularityNorm = maxPop > 0 ? movie.popularity / maxPop : 0;

      const streamingBoost = this.hasMatchingStreaming(providers)
        ? 1.0
        : 0.0;

      const genreMatch =
        movie.genre_ids.length > 0
          ? movie.genre_ids.filter((g) => likedGenreSet.has(g)).length /
            movie.genre_ids.length
          : 0;

      const score =
        0.5 * popularityNorm + 0.3 * streamingBoost + 0.2 * genreMatch;

      const reason = this.buildReason(
        movie,
        likedGenreSet,
        streamingBoost > 0,
        popularityNorm,
      );

      scored.push({ movie, score, streaming: providers, reason });
    }

    // Sort by score desc, then vote_average desc, then id asc (deterministic)
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.movie.vote_average !== a.movie.vote_average)
        return b.movie.vote_average - a.movie.vote_average;
      return a.movie.id - b.movie.id;
    });

    return scored.map((s) => this.toSuggestion(s.movie, s.score, s.streaming, s.reason));
  }

  private hasMatchingStreaming(providers: StreamingProvider[]): boolean {
    if (this.streamingServices.length === 0) return false;
    const normalizedGroup = new Set(
      this.streamingServices.map((s) => s.toLowerCase()),
    );
    return providers.some((p) =>
      normalizedGroup.has(p.provider_name.toLowerCase()),
    );
  }

  private buildReason(
    movie: TMDBMovie,
    likedGenres: Set<number>,
    onStreaming: boolean,
    popularityNorm: number,
  ): string {
    const reasons: string[] = [];

    const matchedGenres = movie.genre_ids
      .filter((g) => likedGenres.has(g))
      .map((g) => TMDB_GENRE_MAP[g])
      .filter(Boolean);

    if (matchedGenres.length > 0) {
      reasons.push(
        `Matches your group's taste in ${matchedGenres.join(", ")}`,
      );
    }

    if (onStreaming) {
      reasons.push("Available on your streaming services");
    }

    if (popularityNorm > 0.8) {
      reasons.push("Highly popular");
    }

    if (movie.vote_average >= 7.5) {
      reasons.push(`Rated ${movie.vote_average.toFixed(1)}/10`);
    }

    return reasons.length > 0
      ? reasons.join(". ") + "."
      : "Fits your group's preferences.";
  }

  private toSuggestion(
    movie: TMDBMovie,
    score: number,
    streaming: StreamingProvider[],
    reason: string,
  ): Suggestion {
    const year = movie.release_date
      ? parseInt(movie.release_date.substring(0, 4), 10)
      : 0;

    const genres = movie.genre_ids
      .map((g) => TMDB_GENRE_MAP[g])
      .filter(Boolean);

    return {
      tmdb_movie_id: movie.id,
      title: movie.title,
      year,
      poster_path: movie.poster_path,
      overview: movie.overview,
      genres,
      content_rating: null, // Could be enriched with getContentRating call
      popularity: movie.popularity,
      vote_average: movie.vote_average,
      streaming,
      score,
      reason,
    };
  }
}
