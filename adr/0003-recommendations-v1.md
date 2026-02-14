# ADR-0003: Recommendation Algorithm — Deterministic Filter-and-Rank (v1)

**Status:** Accepted
**Date:** 2026-02-14
**Deciders:** Project team
**Depends on:** ADR-0001 (AWS Serverless)

## Context

The app needs to suggest 5–8 movies that a family group will enjoy (US-11). The product brief explicitly defers ML-based recommendations to v2. The v1 algorithm must be:

- **Deterministic** — same inputs produce the same ranked output (no randomness except for tie-breaking).
- **Explainable** — if constraints are relaxed, the app tells the user which ones (US-11 AC).
- **Fast** — suggestions should load in <2 seconds including TMDB API latency.
- **Good enough** — the algorithm must clear the bar of "better than scrolling Netflix for 30 minutes."

## Decision

Implement a **five-stage filter-and-rank pipeline** executed in the Lambda function when a user taps "Suggest Movies."

### Pipeline

```
Stage 1: Aggregate         Stage 2: Query         Stage 3: Filter
Group Preferences    ──▶   TMDB Discover    ──▶   Local Exclusions
                           API
        │                       │                       │
        ▼                       ▼                       ▼
  ┌───────────┐          ┌───────────┐          ┌───────────────┐
  │ Merge all │          │ Fetch     │          │ Remove:       │
  │ members'  │          │ movies    │          │ - Watched     │
  │ prefs     │          │ matching  │          │ - Recently    │
  │ into      │          │ filters   │          │   rejected    │
  │ group     │          │ from TMDB │          │ - Current     │
  │ profile   │          │           │          │   round dups  │
  └───────────┘          └───────────┘          └───────────────┘
                                                       │
                              ┌─────────────────────────┘
                              ▼
                    Stage 4: Score          Stage 5: Return
                    & Rank           ──▶   Top Results
                         │
                         ▼
                  ┌─────────────┐          ┌──────────┐
                  │ Score each  │          │ Return   │
                  │ movie:      │          │ top 5-8  │
                  │ popularity  │          │ movies   │
                  │ + streaming │          │ with     │
                  │ + genre fit │          │ metadata │
                  └─────────────┘          └──────────┘
```

### Stage 1: Aggregate Group Preferences

Query all `Preferences` records for the group and merge:

| Preference | Aggregation Rule |
|---|---|
| Genre likes | **Union** — include any genre liked by ≥ 1 member |
| Genre dislikes | **Unanimous exclude** — only exclude a genre if ALL members dislike it |
| Max content rating | **Minimum** — the most restrictive member's ceiling applies (e.g., one PG member → group ceiling is PG) |
| Streaming services | Direct from the Group record (group-level setting) |

### Stage 2: Query TMDB Discover API

Use TMDB's `/discover/movie` endpoint with parameters:

```
with_genres=<liked genre IDs, OR'd>
without_genres=<unanimously disliked genre IDs>
certification_country=US
certification.lte=<group content rating ceiling>
vote_count.gte=50          (filter out obscure titles)
primary_release_date.gte=1980-01-01  (per OQ-07)
sort_by=popularity.desc
page=1 (fetch ~20 results to have headroom after filtering)
```

**Caching:** TMDB responses are cached in the `TmdbCache` DynamoDB table with a 24-hour TTL. Cache key = hash of the query parameters. This avoids redundant TMDB API calls when group preferences haven't changed.

### Stage 3: Local Exclusions

Remove movies from the TMDB results that are:

1. **Already watched** — exist in the group's `Picks` table with `watched = true`.
2. **Recently rejected** — appeared in the last 3 voting rounds and received a net-negative score (per OQ-14). Tracked via `Suggestions` + `Votes` tables.
3. **In the current round** — if refreshing suggestions ("Show Me More"), exclude movies from the immediately previous batch (US-13).

### Stage 4: Score and Rank

Each remaining movie gets a composite score:

```
score = (0.5 × popularity_norm) + (0.3 × streaming_boost) + (0.2 × genre_match)
```

| Component | Calculation |
|---|---|
| `popularity_norm` | TMDB `popularity` value normalized to 0–1 within the candidate set |
| `streaming_boost` | 1.0 if available on any of the group's streaming services, 0.0 otherwise. Uses TMDB `/movie/{id}/watch/providers` (cached, 12-hour TTL) |
| `genre_match` | Proportion of the movie's genres that appear in the group's liked genres (0–1) |

Ties are broken by TMDB `vote_average` (higher is better), then by `tmdb_movie_id` (deterministic).

### Stage 5: Return Top Results

Return the top 5–8 movies (aim for 8; accept 5 as the minimum). Each result includes:

- TMDB movie ID, title, year, poster path, overview, runtime
- Genre tags, content rating
- Streaming availability (provider names + logo paths)
- Trailer link (YouTube, from TMDB `/movie/{id}/videos`)

### Constraint Relaxation

If fewer than 5 movies survive filtering (Stage 3), relax constraints in this order:

1. **Expand genres** — include movies from neutral genres (not just liked ones).
2. **Raise popularity floor** — lower `vote_count.gte` from 50 to 10.
3. **Include older movies** — extend `primary_release_date.gte` to 1960.

Each relaxation is logged, and the API response includes a `relaxed_constraints` array so the iOS app can display a banner: "We loosened some filters to find more options." (US-11 AC)

## Consequences

### Positive

- **Simple and predictable.** No black-box ranking; easy to debug why a movie was or wasn't suggested.
- **Fast.** One TMDB API call (cached) + DynamoDB lookups for exclusions. Total latency <1s with warm cache.
- **Good enough for v1.** Popularity-based ranking with streaming and genre fit produces recognizable, crowd-pleasing results — exactly what families need.
- **Clear upgrade path.** The scoring weights can be tuned, and the pipeline can be extended with ML re-ranking in v2 without changing the API contract.

### Negative

- **No personalization beyond genre preferences.** Two families with identical preferences get identical suggestions. Acceptable for v1 — the product hypothesis is that genre filtering + voting is the personalization mechanism.
- **TMDB popularity bias.** Very popular movies dominate. Mitigated by the exclusion of watched movies (popular ones get picked and cleared out, revealing less popular options over time).
- **Streaming availability data may be stale.** TMDB's watch-providers endpoint is not real-time. Mitigated by 12-hour cache TTL and treating streaming as a ranking boost (not a hard filter).

### Future Improvements (v2+)

- **Collaborative filtering** — use rating history across groups to suggest movies that similar families enjoyed.
- **Recency weighting** — boost recently released movies.
- **Mood/occasion tags** — "family comedy night" vs "date night thriller."
- **Diversity injection** — ensure genre variety within a single suggestion batch.
