# Test Matrix — Slice A: Watchlists + Movie Details + Mark Watched

---

## Legend

| Column | Meaning |
|---|---|
| **ID** | Unique test identifier (SA = Slice A) |
| **Layer** | `service` = unit, `route` = integration, `cdk` = infra |
| **Category** | `happy`, `auth`, `permission`, `edge`, `cross-feature`, `concurrency` |
| **PR** | Which PR introduces this test |

---

## PR A1: Watchlist Backend

### Service Tests (`watchlist-service.test.ts`)

| ID | Test | Category | Expected | Notes |
|---|---|---|---|---|
| SA-001 | `addToWatchlist` — success | happy | Item written with addedBy, addedAt | Verify DynamoDB PutItem |
| SA-002 | `addToWatchlist` — duplicate movie | edge | `ConflictError` (409) | Conditional write: `attribute_not_exists(tmdb_movie_id)` |
| SA-003 | `addToWatchlist` — watchlist full (50 movies) | edge | `ValidationError` (400) | Count query before write |
| SA-004 | `addToWatchlist` — movie already watched (direct) | cross-feature | `ValidationError` (400) "Already watched" | Checks WatchedMovies table |
| SA-005 | `addToWatchlist` — movie already watched (via pick) | cross-feature | `ValidationError` (400) "Already watched" | Checks Picks table |
| SA-006 | `removeFromWatchlist` — by adder | permission | Success (DeleteItem) | `added_by === userId` |
| SA-007 | `removeFromWatchlist` — by creator | permission | Success (DeleteItem) | Creator can remove any |
| SA-008 | `removeFromWatchlist` — by other member | permission | `ForbiddenError` (403) | Not adder, not creator |
| SA-009 | `removeFromWatchlist` — movie not on watchlist | edge | `NotFoundError` (404) | GetItem returns nothing |
| SA-010 | `getWatchlist` — returns reverse-chronological | happy | Items sorted by `added_at` desc | Application-level sort |
| SA-011 | `getWatchlist` — empty list | edge | `[]` | No items in group |
| SA-012 | `getWatchlistCount` — returns correct count | happy | Number matches items | Used for cap enforcement |
| SA-013 | `isOnWatchlist` — true | happy | `true` | GetItem hit |
| SA-014 | `isOnWatchlist` — false | happy | `false` | GetItem miss |

### Route Tests (`watchlist.test.ts`)

| ID | Test | Category | Expected | Notes |
|---|---|---|---|---|
| SA-015 | `POST /groups/:id/watchlist` — 201 success | happy | Watchlist item returned | Valid body + member |
| SA-016 | `POST /groups/:id/watchlist` — 409 duplicate | edge | Error: "Already on Watchlist" | |
| SA-017 | `POST /groups/:id/watchlist` — 400 already watched | cross-feature | Error: "Already watched" | |
| SA-018 | `POST /groups/:id/watchlist` — 400 watchlist full | edge | Error: "Watchlist is full" | |
| SA-019 | `POST /groups/:id/watchlist` — 400 missing fields | edge | Zod validation errors | Missing title, tmdb_movie_id |
| SA-020 | `POST /groups/:id/watchlist` — 403 non-member | auth | Error: "Not a member" | User not in group |
| SA-021 | `POST /groups/:id/watchlist` — 401 no JWT | auth | Error: "Unauthorized" | No auth header |
| SA-022 | `GET /groups/:id/watchlist` — 200 with items | happy | Array + count + max | |
| SA-023 | `GET /groups/:id/watchlist` — 200 empty | edge | Empty array, count=0 | |
| SA-024 | `GET /groups/:id/watchlist` — 403 non-member | auth | Error: "Not a member" | |
| SA-025 | `DELETE /.../watchlist/:mid` — 204 by adder | permission | No content | Own movie |
| SA-026 | `DELETE /.../watchlist/:mid` — 204 by creator | permission | No content | Creator override |
| SA-027 | `DELETE /.../watchlist/:mid` — 403 by other member | permission | Error: "Forbidden" | Not adder, not creator |
| SA-028 | `DELETE /.../watchlist/:mid` — 404 not found | edge | Error: "Not found" | Movie not on watchlist |

### CDK Tests

| ID | Test | Category | Expected | Notes |
|---|---|---|---|---|
| SA-029 | watchlistTable created | cdk | Table in synth output | DynamoDB assertions |
| SA-030 | watchlistTable IAM grant | cdk | Lambda has read/write | Policy assertion |
| SA-031 | WATCHLIST_TABLE env var set | cdk | Env var in Lambda config | |

---

## PR A2: Direct Mark-Watched + Combined Watched List

### Service Tests (`watched-service.test.ts`)

| ID | Test | Category | Expected | Notes |
|---|---|---|---|---|
| SA-032 | `markDirectlyWatched` — success | happy | Item written to WatchedMovies | |
| SA-033 | `markDirectlyWatched` — already watched (direct) | edge | `ConflictError` (409) | Duplicate in WatchedMovies |
| SA-034 | `markDirectlyWatched` — already watched (via pick) | cross-feature | `ConflictError` (409) | Picks table check |
| SA-035 | `markDirectlyWatched` — auto-removes from watchlist | cross-feature | Watchlist DeleteItem called | Verifies watchlist cleanup |
| SA-036 | `markDirectlyWatched` — not on watchlist (no error) | edge | Success (no watchlist delete) | Graceful when absent |
| SA-037 | `unmarkDirectlyWatched` — within 24h by marker | happy | DeleteItem from WatchedMovies | Time check passes |
| SA-038 | `unmarkDirectlyWatched` — after 24h | edge | `ValidationError` (400) "Undo window expired" | Time check fails |
| SA-039 | `unmarkDirectlyWatched` — at exactly 24h boundary | edge | `ValidationError` (400) | Boundary condition |
| SA-040 | `unmarkDirectlyWatched` — by other member | permission | `ForbiddenError` (403) | Not marker, not creator |
| SA-041 | `unmarkDirectlyWatched` — by creator (not marker) | permission | Success | Creator override |
| SA-042 | `unmarkDirectlyWatched` — picked movie | edge | `ValidationError` (400) "Cannot undo round-watched" | Source check |
| SA-043 | `unmarkDirectlyWatched` — movie not watched | edge | `NotFoundError` (404) | |
| SA-044 | `getCombinedWatchedMovies` — merges picks + direct | cross-feature | Union of both tables | Deduplication if same movie |
| SA-045 | `getCombinedWatchedMovies` — only picks | cross-feature | Just pick-watched movies | No direct marks |
| SA-046 | `getCombinedWatchedMovies` — only direct | cross-feature | Just directly-marked movies | No picks |
| SA-047 | `getCombinedWatchedMovies` — empty | edge | `[]` | No watched movies |
| SA-048 | `getAllWatchedMovieIds` — returns complete set | cross-feature | Set of all tmdb_movie_ids | Both sources |
| SA-049 | `isWatched` — true (from picks) | cross-feature | `true` | |
| SA-050 | `isWatched` — true (from direct) | cross-feature | `true` | |
| SA-051 | `isWatched` — false | happy | `false` | |

### Route Tests (updated `picks.test.ts`)

| ID | Test | Category | Expected | Notes |
|---|---|---|---|---|
| SA-052 | `POST /groups/:id/watched` — 201 | happy | WatchedMovie returned | |
| SA-053 | `POST /groups/:id/watched` — 409 already watched | edge | Conflict error | |
| SA-054 | `POST /groups/:id/watched` — 403 non-member | auth | Not a member | |
| SA-055 | `DELETE /groups/:id/watched/:mid` — 204 within 24h | happy | Undo success | |
| SA-056 | `DELETE /groups/:id/watched/:mid` — 400 expired | edge | Undo window expired | |
| SA-057 | `DELETE /groups/:id/watched/:mid` — 403 wrong user | permission | Forbidden | |
| SA-058 | `DELETE /groups/:id/watched/:mid` — 400 picked movie | edge | Cannot undo | |
| SA-059 | `GET /groups/:id/watched` — 200 combined list | cross-feature | Merged picks + direct | |
| SA-060 | `GET /groups/:id/watched` — 200 empty | edge | Empty array | |

### Integration Tests

| ID | Test | Category | Expected | Notes |
|---|---|---|---|---|
| SA-061 | Suggestion algorithm excludes combined watched | cross-feature | Directly-watched movies not suggested | End-to-end |
| SA-062 | Add to watchlist → mark watched → auto-removed | cross-feature | Watchlist item gone after mark-watched | Full lifecycle |

### CDK Tests

| ID | Test | Category | Expected | Notes |
|---|---|---|---|---|
| SA-063 | watchedMoviesTable created | cdk | Table in synth | |
| SA-064 | watchedMoviesTable IAM grant | cdk | Lambda has read/write | |
| SA-065 | WATCHED_MOVIES_TABLE env var set | cdk | Env var in Lambda config | |

---

## PR A3: Movie Detail Endpoint

### Route Tests (`movies.test.ts`)

| ID | Test | Category | Expected | Notes |
|---|---|---|---|---|
| SA-066 | `GET /movies/:id` — 200 basic metadata | happy | TMDB data returned | No group_id param |
| SA-067 | `GET /movies/:id?group_id=X` — watchlist = on | cross-feature | `watchlist_status.on_watchlist: true` | With adder info |
| SA-068 | `GET /movies/:id?group_id=X` — watchlist = off | cross-feature | `watchlist_status.on_watchlist: false` | |
| SA-069 | `GET /movies/:id?group_id=X` — watched = true (direct) | cross-feature | `watched_status.watched: true, source: "direct"` | |
| SA-070 | `GET /movies/:id?group_id=X` — watched = true (pick) | cross-feature | `watched_status.watched: true, source: "picked"` | |
| SA-071 | `GET /movies/:id?group_id=X` — watched = false | cross-feature | `watched_status.watched: false` | |
| SA-072 | `GET /movies/:id?group_id=X` — vote history present | cross-feature | Array of round summaries | Previous rounds |
| SA-073 | `GET /movies/:id?group_id=X` — no vote history | cross-feature | Empty array | Never in a round |
| SA-074 | `GET /movies/:id?group_id=X` — active round state | cross-feature | Current tally + user's vote | Movie in active round |
| SA-075 | `GET /movies/:id?group_id=X` — 403 non-member | auth | Forbidden | Group context denied |
| SA-076 | `GET /movies/:id` — 404 unknown movie | edge | TMDB miss | |
| SA-077 | `GET /movies/:id` — 401 no JWT | auth | Unauthorized | |

### CDK Tests

| ID | Test | Category | Expected | Notes |
|---|---|---|---|---|
| SA-078 | roundsTable IAM grant added | cdk | Lambda has read | Needed for vote history |
| SA-079 | suggestionsTable IAM grant added | cdk | Lambda has read | Needed for round lookup |
| SA-080 | votesTable IAM grant added | cdk | Lambda has read | Needed for vote history |

---

## Coverage Summary

| Category | Count | % |
|---|---|---|
| Happy path | 19 | 24% |
| Auth / permission | 19 | 24% |
| Edge cases | 21 | 26% |
| Cross-feature | 17 | 21% |
| CDK | 8 | 10% |
| **Total** | **80** | |

### Cross-Feature Interactions Tested

1. **Watchlist ↔ Watched:** Adding already-watched movie to watchlist is blocked
2. **Watched ↔ Watchlist:** Marking a watchlist movie as watched auto-removes it
3. **Watched ↔ Suggestions:** Combined watched IDs exclude movies from algorithm
4. **Movie Detail ↔ All:** Detail endpoint reflects watchlist, watched, and vote state
5. **Direct-watched ↔ Pick-watched:** Both sources contribute to watched movie set
