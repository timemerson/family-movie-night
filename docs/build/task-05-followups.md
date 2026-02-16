# Task 05 Follow-ups

Items identified during PR #11 code review. None are blockers — all can be addressed in a single cleanup PR.

---

### Follow-up 05-A: `getContentRating` cache null-handling bug (P1)

**Problem:** In `tmdb-client.ts:94`, the cache check `if (cached !== undefined && cached !== null)` means that a cached `null` value (movie with no US certification) is treated as a cache miss, causing repeated TMDB API calls for the same movie.

**Fix:** Change to `if (cached !== undefined) return cached;` so `null` results are properly cached. Alternatively, use a sentinel value like `"__NONE__"`.

**File:** `backend/src/services/tmdb-client.ts` (line 94)

**Note:** `getContentRating` is not currently called anywhere (`content_rating` is hardcoded to `null` in `toSuggestion`), so this is latent. Fix before wiring it up.

---

### Follow-up 05-B: Validate TMDB API key at startup (P1)

**Problem:** If `TMDB_API_KEY` env var is empty, TMDB calls silently fail with 401 and users get opaque 500 errors.

**Fix:** Add a guard in `TMDBClient` constructor (or at route level) that throws a clear error if the key is missing/empty.

**File:** `backend/src/services/tmdb-client.ts` (constructor) or `backend/src/routes/suggestions.ts`

---

### Follow-up 05-C: Clean up empty `with_genres` param in TMDB discover call (P2)

**Problem:** When `summary.liked_genres` is empty (after constraint relaxation), `with_genres=""` is sent to TMDB. TMDB ignores it, so it works, but it's confusing and inconsistent with how `without_genres` is handled (skipped when empty).

**Fix:** Pass `undefined` when empty and skip setting the param in `tmdb-client.ts`.

**Files:** `backend/src/services/suggestion-service.ts` (line 85), `backend/src/services/tmdb-client.ts` (line 41)

---

### Follow-up 05-D: ADR-0003 missing from repo (P2)

**Problem:** PR description, runbook, and backlog reference "ADR-0003" for the suggestion algorithm, but no `adr/` directory or ADR file exists in the repository.

**Fix:** Either create `adr/ADR-0003-suggestion-algorithm.md` documenting the five-stage pipeline, or remove the ADR references.

---

### Follow-up 05-E: Cap `exclude_movie_ids` growth in iOS "Show Me More" (P2)

**Problem:** In `SuggestionsViewModel.swift:46`, each `refresh()` appends the full current batch to `excludeMovieIds`. After many refreshes this becomes a very long query string.

**Fix:** Cap at ~50 IDs (keep most recent) or reset after a threshold.

**File:** `ios/FamilyMovieNight/Features/Suggestions/SuggestionsViewModel.swift`

---

### Follow-up 05-F: Wire up `content_rating` field in suggestions (P2)

**Problem:** `content_rating` is always `null` in the suggestion response (`suggestion-service.ts:130`). The `getContentRating` method exists but isn't called.

**Fix:** Call `tmdbClient.getContentRating()` during scoring (or in parallel with `getWatchProviders`) and populate the field. Depends on 05-A being fixed first.

**File:** `backend/src/services/suggestion-service.ts` (toSuggestion method)

---

## Summary

| Follow-up | Priority | Description |
|---|---|---|
| 05-A: Cache null-handling bug | P1 | `getContentRating` cache miss on null values |
| 05-B: API key validation | P1 | Fail fast when TMDB_API_KEY is missing |
| 05-C: Empty `with_genres` param | P2 | Cosmetic: don't send empty string to TMDB |
| 05-D: Missing ADR-0003 | P2 | Referenced but not committed |
| 05-E: Cap exclude_movie_ids | P2 | iOS query string growth on repeated refresh |
| 05-F: Wire up content_rating | P2 | Field always null, method exists but unused |

**Estimated PRs:** 1 (all items can be combined)
