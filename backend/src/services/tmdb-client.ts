import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createHash } from "node:crypto";
import type {
  TMDBMovie,
  TMDBMovieDetail,
  TMDBDiscoverResponse,
  StreamingProvider,
} from "../models/suggestion.js";

export interface DiscoverParams {
  with_genres: string;
  without_genres?: string;
  certification_lte: string;
  vote_count_gte: number;
  primary_release_date_gte: string;
  page: number;
}

interface WatchProvidersResponse {
  results?: {
    US?: {
      flatrate?: { provider_name: string; logo_path: string | null }[];
    };
  };
}

export class TMDBClient {
  constructor(
    private readonly apiKey: string,
    private readonly docClient: DynamoDBDocumentClient,
    private readonly cacheTable: string,
  ) {}

  async discoverMovies(params: DiscoverParams): Promise<TMDBMovie[]> {
    const cacheKey = `discover:${this.hashParams(params)}`;
    const cached = await this.getCache<TMDBMovie[]>(cacheKey, 24);
    if (cached) return cached;

    const url = new URL("https://api.themoviedb.org/3/discover/movie");
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("with_genres", params.with_genres);
    if (params.without_genres) {
      url.searchParams.set("without_genres", params.without_genres);
    }
    url.searchParams.set("certification_country", "US");
    url.searchParams.set("certification.lte", params.certification_lte);
    url.searchParams.set("vote_count.gte", String(params.vote_count_gte));
    url.searchParams.set(
      "primary_release_date.gte",
      params.primary_release_date_gte,
    );
    url.searchParams.set("sort_by", "popularity.desc");
    url.searchParams.set("page", String(params.page));

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`TMDB discover failed: ${res.status}`);
    }

    const data = (await res.json()) as TMDBDiscoverResponse;
    const movies = data.results ?? [];

    await this.setCache(cacheKey, movies, 24);
    return movies;
  }

  async getWatchProviders(movieId: number): Promise<StreamingProvider[]> {
    const cacheKey = `providers:${movieId}`;
    const cached = await this.getCache<StreamingProvider[]>(cacheKey, 12);
    if (cached) return cached;

    const url = new URL(
      `https://api.themoviedb.org/3/movie/${movieId}/watch/providers`,
    );
    url.searchParams.set("api_key", this.apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) return [];

    const data = (await res.json()) as WatchProvidersResponse;
    const flatrate = data.results?.US?.flatrate ?? [];
    const providers: StreamingProvider[] = flatrate.map((p) => ({
      provider_name: p.provider_name,
      logo_path: p.logo_path,
    }));

    await this.setCache(cacheKey, providers, 12);
    return providers;
  }

  async getMovieDetails(movieId: number): Promise<TMDBMovieDetail | null> {
    const cacheKey = `detail:${movieId}`;
    const cached = await this.getCache<TMDBMovieDetail>(cacheKey, 24);
    if (cached) return cached;

    const url = new URL(
      `https://api.themoviedb.org/3/movie/${movieId}`,
    );
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("append_to_response", "credits,videos,release_dates");

    const res = await fetch(url.toString());
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`TMDB movie detail failed: ${res.status}`);
    }

    const data = await res.json() as any;
    const year = data.release_date
      ? parseInt(data.release_date.substring(0, 4), 10)
      : 0;

    // Extract US certification
    const usRelease = data.release_dates?.results?.find(
      (r: any) => r.iso_3166_1 === "US",
    );
    const contentRating = usRelease?.release_dates?.find(
      (rd: any) => rd.certification,
    )?.certification ?? null;

    // Extract top 5 cast
    const cast = (data.credits?.cast ?? []).slice(0, 5).map((c: any) => ({
      name: c.name,
      character: c.character,
    }));

    // Extract trailer URL
    const trailer = (data.videos?.results ?? []).find(
      (v: any) => v.type === "Trailer" && v.site === "YouTube",
    );
    const trailerUrl = trailer
      ? `https://www.youtube.com/watch?v=${trailer.key}`
      : null;

    const detail: TMDBMovieDetail = {
      tmdb_movie_id: data.id,
      title: data.title,
      year,
      poster_path: data.poster_path,
      overview: data.overview ?? "",
      runtime: data.runtime ?? 0,
      genres: (data.genres ?? []).map((g: any) => g.name),
      content_rating: contentRating,
      cast,
      popularity: data.popularity ?? 0,
      vote_average: data.vote_average ?? 0,
      trailer_url: trailerUrl,
    };

    await this.setCache(cacheKey, detail, 24);
    return detail;
  }

  async getContentRating(movieId: number): Promise<string | null> {
    const cacheKey = `rating:${movieId}`;
    const cached = await this.getCache<string | null>(cacheKey, 24);
    if (cached !== undefined && cached !== null) return cached;

    const url = new URL(
      `https://api.themoviedb.org/3/movie/${movieId}/release_dates`,
    );
    url.searchParams.set("api_key", this.apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = (await res.json()) as {
      results?: { iso_3166_1: string; release_dates: { certification: string }[] }[];
    };
    const us = data.results?.find((r) => r.iso_3166_1 === "US");
    const cert =
      us?.release_dates.find((rd) => rd.certification)?.certification ?? null;

    await this.setCache(cacheKey, cert, 24);
    return cert;
  }

  private hashParams(params: DiscoverParams): string {
    const str = JSON.stringify(params);
    return createHash("sha256").update(str).digest("hex").slice(0, 16);
  }

  private async getCache<T>(key: string, _ttlHours: number): Promise<T | undefined> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.cacheTable,
          Key: { cache_key: key },
        }),
      );
      if (!result.Item) return undefined;
      const now = Math.floor(Date.now() / 1000);
      if (result.Item.ttl && result.Item.ttl < now) return undefined;
      return result.Item.data as T;
    } catch {
      return undefined;
    }
  }

  private async setCache<T>(key: string, data: T, ttlHours: number): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + ttlHours * 3600;
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.cacheTable,
          Item: { cache_key: key, data, ttl },
        }),
      );
    } catch {
      // Cache write failure is non-fatal
    }
  }
}
