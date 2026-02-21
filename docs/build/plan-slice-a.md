# Slice A: Watchlists + Movie Details + Mark Watched

> **Scope:** Group watchlist management, direct mark-as-watched, combined watched list, movie detail with group context, iOS UI for all three.
>
> **User stories covered:** US-26, US-27, US-28, US-32, US-33, US-34, US-35, US-36, US-40

---

## Data Model Changes

### New Table: Watchlist

Group's shared "watch later" list. Max 50 movies per group.

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `group_id` | S | **PK** | |
| `tmdb_movie_id` | N | **SK** | |
| `added_by` | S | | `user_id` of the member who added it |
| `added_at` | S | | ISO 8601 |
| `title` | S | | Denormalized from TMDB |
| `poster_path` | S | | Denormalized |
| `year` | N | | Denormalized |
| `genres` | L | | Denormalized genre name strings |
| `content_rating` | S | | Denormalized |

**Access patterns:**
- Get watchlist for group: `PK=group_id` (Query, ScanIndexForward=false for reverse chronological by added_at — but SK is tmdb_movie_id, so we sort in application code by `added_at`)
- Check if movie is on watchlist: `PK=group_id, SK=tmdb_movie_id` (GetItem)
- Add/remove: PutItem / DeleteItem

No GSIs needed.

### New Table: WatchedMovies

Directly-marked "already watched" movies (not from rounds). Complements Picks table (which tracks movies watched via the round→pick flow).

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `group_id` | S | **PK** | |
| `tmdb_movie_id` | N | **SK** | |
| `marked_by` | S | | `user_id` who marked it |
| `watched_at` | S | | ISO 8601 |
| `title` | S | | Denormalized |
| `poster_path` | S | | Denormalized |
| `year` | N | | Denormalized |
| `source` | S | | Always `"direct"` in this table |

**Access patterns:**
- Get all direct-watched for group: `PK=group_id` (Query)
- Check if movie is directly watched: `PK=group_id, SK=tmdb_movie_id` (GetItem)
- Mark/unmark: PutItem / DeleteItem

No GSIs needed.

### Combined "Watched" View

The full watched list is the union of:
1. **Picks** where `watched = true` (movies that went through a round)
2. **WatchedMovies** (directly marked)

`getAllWatchedMovieIds(groupId)` queries both tables and merges.

---

## PR A1: Watchlist Backend — Table + Service + Routes

**Branch:** `feat/slice-a1-watchlist`

### Scope

Implement the group watchlist: adding movies, viewing the list, and removing movies. Enforce group membership on all operations, permission rules for removal, 50-movie cap, and duplicate prevention (already-on-watchlist, already-watched).

### Files Created

| File | Purpose |
|---|---|
| `backend/src/models/watchlist.ts` | Zod schemas: `WatchlistItemSchema`, `AddToWatchlistSchema` |
| `backend/src/services/watchlist-service.ts` | `WatchlistService` class |
| `backend/src/routes/watchlist.ts` | Hono routes |
| `backend/test/services/watchlist-service.test.ts` | Service unit tests |
| `backend/test/routes/watchlist.test.ts` | Route integration tests |

### Files Modified

| File | Change |
|---|---|
| `backend/cdk/lib/data-stack.ts` | Add `watchlistTable` (PK=group_id, SK=tmdb_movie_id) |
| `backend/cdk/lib/api-stack.ts` | `dataStack.watchlistTable.grantReadWriteData(this.handler)` + env var `WATCHLIST_TABLE` |
| `backend/src/index.ts` | Mount watchlist routes |
| `backend/src/lib/dynamo.ts` | Add `WATCHLIST` to table name helper (if needed) |
| `backend/test/cdk/api-stack.test.ts` | IAM assertion for watchlistTable |

### API Endpoints

#### `POST /groups/:group_id/watchlist`
Add a movie to the group watchlist. (US-26, US-34)

**Request:**
```json
{
  "tmdb_movie_id": 550,
  "title": "Fight Club",
  "poster_path": "/pB8...",
  "year": 1999,
  "genres": ["Drama", "Thriller"],
  "content_rating": "R"
}
```

**Auth:** JWT + group member

**Validation:**
- Movie not already on watchlist → 409
- Movie not on watched list (picks or direct) → 400 "Already watched"
- Watchlist not full (< 50) → 400 "Watchlist is full"

**Response 201:** Watchlist item with `added_by`, `added_at`.

#### `GET /groups/:group_id/watchlist`
List the group's watchlist. (US-27)

**Auth:** JWT + group member

**Response 200:**
```json
{
  "items": [ { ...watchlist item... } ],
  "count": 12,
  "max": 50
}
```
Items sorted reverse-chronologically by `added_at`.

#### `DELETE /groups/:group_id/watchlist/:tmdb_movie_id`
Remove a movie from the watchlist. (US-28)

**Auth:** JWT + group member

**Permission:** Adder can remove their own additions. Creator can remove any. Other members cannot remove others' additions → 403.

**Response 204:** No content.

### Service Methods

```typescript
class WatchlistService {
  addToWatchlist(groupId, tmdbMovieId, addedBy, metadata): Promise<WatchlistItem>
  removeFromWatchlist(groupId, tmdbMovieId, userId, userRole): Promise<void>
  getWatchlist(groupId): Promise<WatchlistItem[]>
  isOnWatchlist(groupId, tmdbMovieId): Promise<boolean>
  getWatchlistCount(groupId): Promise<number>
}
```

### Tests

| Test | Type | What it verifies |
|---|---|---|
| addToWatchlist — success | Service | Item written to DynamoDB |
| addToWatchlist — duplicate → ConflictError | Service | Conditional write rejects duplicate |
| addToWatchlist — full (50) → ValidationError | Service | Count check before write |
| removeFromWatchlist — by adder → success | Service | DeleteItem succeeds |
| removeFromWatchlist — by creator → success | Service | Creator override |
| removeFromWatchlist — by other member → ForbiddenError | Service | Permission check |
| removeFromWatchlist — not found → NotFoundError | Service | GetItem miss |
| getWatchlist — returns reverse-chronological | Service | Sort by added_at desc |
| getWatchlist — empty → [] | Service | Empty Query result |
| POST /groups/:id/watchlist — 201 | Route | End-to-end add |
| POST /groups/:id/watchlist — 409 duplicate | Route | Conflict response |
| POST /groups/:id/watchlist — 403 non-member | Route | Auth check |
| POST /groups/:id/watchlist — 400 validation | Route | Missing required fields |
| GET /groups/:id/watchlist — 200 | Route | List with count |
| GET /groups/:id/watchlist — 403 non-member | Route | Auth check |
| DELETE /.../watchlist/:mid — 204 by adder | Route | Permission: own item |
| DELETE /.../watchlist/:mid — 204 by creator | Route | Permission: creator override |
| DELETE /.../watchlist/:mid — 403 by other | Route | Permission denied |
| CDK: watchlistTable IAM grant | CDK | Policy assertion |

### Definition of Done

- [ ] Watchlist DynamoDB table created in CDK
- [ ] All three endpoints functional with correct auth/permissions
- [ ] 50-movie cap enforced
- [ ] Duplicate prevention (already on watchlist, already watched)
- [ ] All tests pass (service + route + CDK)
- [ ] Code merged to main

---

## PR A2: Direct Mark-Watched + Combined Watched List

**Branch:** `feat/slice-a2-watched-movies`

**Depends on:** A1 (needs watchlist service for auto-remove)

### Scope

Implement directly marking movies as "already watched" (without going through a round), undo within 24 hours, combined watched list merging picks + direct marks, and auto-removal from watchlist.

### Files Created

| File | Purpose |
|---|---|
| `backend/src/models/watched-movie.ts` | Zod schemas: `WatchedMovieSchema`, `MarkWatchedDirectSchema` |
| `backend/src/services/watched-service.ts` | `WatchedService` class |
| `backend/test/services/watched-service.test.ts` | Service unit tests |

### Files Modified

| File | Change |
|---|---|
| `backend/cdk/lib/data-stack.ts` | Add `watchedMoviesTable` (PK=group_id, SK=tmdb_movie_id) |
| `backend/cdk/lib/api-stack.ts` | IAM grant + env var `WATCHED_MOVIES_TABLE` |
| `backend/src/routes/picks.ts` | Refactor watched endpoints: add `POST /groups/:gid/watched`, `DELETE /groups/:gid/watched/:mid`, update `GET /groups/:gid/watched` to return combined list |
| `backend/src/services/suggestion-service.ts` | Use `WatchedService.getAllWatchedMovieIds()` instead of `PickService.getWatchedMovieIds()` |
| `backend/test/routes/picks.test.ts` | Update tests for new/changed endpoints |
| `backend/test/cdk/api-stack.test.ts` | IAM assertion for watchedMoviesTable |

### API Endpoints

#### `POST /groups/:group_id/watched`
Mark a movie as directly watched (not through a round). (US-33)

**Request:**
```json
{
  "tmdb_movie_id": 550,
  "title": "Fight Club",
  "poster_path": "/pB8...",
  "year": 1999
}
```

**Auth:** JWT + group member

**Side effects:**
- If movie is on the watchlist → auto-remove from watchlist
- Movie excluded from future suggestions

**Response 201:** WatchedMovie item.

#### `DELETE /groups/:group_id/watched/:tmdb_movie_id`
Undo a direct mark-as-watched. (US-36)

**Auth:** JWT + group member

**Validation:**
- Only directly-marked movies can be un-marked (not picked-and-watched) → 400
- Only within 24 hours of marking → 400 "Undo window expired"
- Only the marker or creator can undo → 403

**Response 204:** No content.

#### `GET /groups/:group_id/watched` (updated)
Return the combined watched list from both sources. (US-35)

**Response 200:**
```json
{
  "watched_movies": [
    {
      "tmdb_movie_id": 550,
      "title": "Fight Club",
      "poster_path": "/...",
      "year": 1999,
      "watched_at": "2026-02-20T20:00:00Z",
      "source": "picked",
      "marked_by": "uuid",
      "pick_id": "uuid",
      "avg_rating": 4.2
    },
    {
      "tmdb_movie_id": 680,
      "title": "Pulp Fiction",
      "watched_at": "2026-02-19T20:00:00Z",
      "source": "direct",
      "marked_by": "uuid"
    }
  ]
}
```

### Service Methods

```typescript
class WatchedService {
  constructor(
    docClient,
    watchedMoviesTable,
    picksTable,
    watchlistService: WatchlistService
  )

  markDirectlyWatched(groupId, tmdbMovieId, markedBy, metadata): Promise<WatchedMovie>
  unmarkDirectlyWatched(groupId, tmdbMovieId, userId, userRole): Promise<void>
  getDirectlyWatchedMovies(groupId): Promise<WatchedMovie[]>
  getCombinedWatchedMovies(groupId): Promise<CombinedWatchedMovie[]>
  getAllWatchedMovieIds(groupId): Promise<Set<number>>
  isWatched(groupId, tmdbMovieId): Promise<boolean>
}
```

### Tests

| Test | Type | What it verifies |
|---|---|---|
| markDirectlyWatched — success | Service | Item written to WatchedMovies |
| markDirectlyWatched — already watched (direct) → ConflictError | Service | Duplicate check |
| markDirectlyWatched — already watched (pick) → ConflictError | Service | Cross-table check |
| markDirectlyWatched — auto-removes from watchlist | Service | Watchlist cleanup |
| markDirectlyWatched — not on watchlist → no error | Service | Graceful when not on watchlist |
| unmarkDirectlyWatched — within 24h by marker → success | Service | DeleteItem + time check |
| unmarkDirectlyWatched — after 24h → ValidationError | Service | Time window enforcement |
| unmarkDirectlyWatched — by other member → ForbiddenError | Service | Permission check |
| unmarkDirectlyWatched — by creator → success | Service | Creator override |
| unmarkDirectlyWatched — picked movie → ValidationError | Service | Can't undo round-watched |
| getCombinedWatchedMovies — merges both sources | Service | Union of picks + direct |
| getAllWatchedMovieIds — returns complete set | Service | Both tables queried |
| POST /groups/:id/watched — 201 | Route | End-to-end |
| POST /groups/:id/watched — 409 already watched | Route | Conflict |
| POST /groups/:id/watched — 403 non-member | Route | Auth |
| DELETE /groups/:id/watched/:mid — 204 | Route | Undo success |
| DELETE /groups/:id/watched/:mid — 400 expired | Route | 24h window |
| DELETE /groups/:id/watched/:mid — 403 wrong user | Route | Permission |
| GET /groups/:id/watched — 200 combined | Route | Merged list |
| Suggestion exclusion uses combined IDs | Integration | Watched movies excluded from algo |
| CDK: watchedMoviesTable IAM grant | CDK | Policy assertion |

### Definition of Done

- [ ] WatchedMovies DynamoDB table created in CDK
- [ ] Direct mark-watched endpoint functional
- [ ] 24-hour undo window enforced
- [ ] Combined watched list merges picks + direct
- [ ] Auto-remove from watchlist on mark-watched
- [ ] Suggestion algorithm uses combined watched IDs
- [ ] All tests pass
- [ ] Code merged to main

---

## PR A3: Movie Detail Endpoint with Group Context

**Branch:** `feat/slice-a3-movie-detail`

**Depends on:** A1, A2 (needs watchlist + watched services)

### Scope

Implement `GET /movies/:tmdb_movie_id` with optional group context overlay. Returns TMDB metadata plus the group's relationship with the movie (watchlist status, watched status, vote history, current round state).

### Files Created

| File | Purpose |
|---|---|
| `backend/src/routes/movies.ts` | Movie detail route |
| `backend/test/routes/movies.test.ts` | Route tests |

### Files Modified

| File | Change |
|---|---|
| `backend/src/index.ts` | Mount movies routes |
| `backend/cdk/lib/api-stack.ts` | IAM grants for roundsTable, suggestionsTable, votesTable (needed for vote history) |
| `backend/test/cdk/api-stack.test.ts` | IAM assertions for new grants |

### API Endpoint

#### `GET /movies/:tmdb_movie_id?group_id=:group_id`
Get full movie details with group context. (US-12, US-32)

**Auth:** JWT (group_id param requires membership)

**Response 200:**
```json
{
  "tmdb_movie_id": 550,
  "title": "Fight Club",
  "year": 1999,
  "poster_path": "/...",
  "overview": "A ticking-time-bomb...",
  "runtime": 139,
  "genres": ["Drama", "Thriller"],
  "content_rating": "R",
  "cast": [
    { "name": "Brad Pitt", "character": "Tyler Durden" }
  ],
  "popularity": 61.4,
  "vote_average": 8.4,
  "streaming": [
    { "provider": "Hulu", "logo_path": "/...", "link": "https://..." }
  ],
  "trailer_url": "https://youtube.com/...",
  "group_context": {
    "watchlist_status": {
      "on_watchlist": true,
      "added_by": { "user_id": "uuid", "display_name": "Tim" },
      "added_at": "2026-02-18T10:00:00Z"
    },
    "watched_status": {
      "watched": false
    },
    "vote_history": [
      {
        "round_id": "uuid",
        "created_at": "2026-02-14T20:00:00Z",
        "votes_up": 3,
        "votes_down": 1
      }
    ],
    "active_round": null
  }
}
```

### Tests

| Test | Type | What it verifies |
|---|---|---|
| GET /movies/:id — 200 TMDB metadata | Route | Basic movie data returned |
| GET /movies/:id?group_id — watchlist status shown | Route | On-watchlist detection |
| GET /movies/:id?group_id — watched status shown | Route | Watched detection |
| GET /movies/:id?group_id — vote history included | Route | Previous round votes |
| GET /movies/:id?group_id — active round state | Route | Current round vote tally |
| GET /movies/:id?group_id — 403 non-member | Route | Auth for group context |
| GET /movies/:id — 404 unknown movie | Route | TMDB miss |
| CDK: rounds/suggestions/votes table grants | CDK | IAM assertions |

### Definition of Done

- [ ] Movie detail endpoint returns TMDB metadata
- [ ] Group context overlay includes watchlist, watched, vote history, active round
- [ ] Auth enforced for group context
- [ ] IAM grants for rounds/suggestions/votes tables
- [ ] All tests pass
- [ ] Code merged to main

---

## PR A4: iOS — Watchlist + Movie Detail + Mark Watched UI

**Branch:** `feat/slice-a4-ios-watchlist`

**Depends on:** A1, A2, A3 (all backend PRs)

### Scope

iOS screens for browsing the watchlist, viewing movie detail with group context and collaboration actions, and marking movies as watched.

### Files Created

| File | Purpose |
|---|---|
| `ios/FamilyMovieNight/Features/Watchlist/WatchlistView.swift` | Watchlist list screen |
| `ios/FamilyMovieNight/Features/Watchlist/WatchlistViewModel.swift` | Watchlist data + actions |
| `ios/FamilyMovieNight/Features/Movies/MovieDetailView.swift` | Movie detail with group context |
| `ios/FamilyMovieNight/Features/Movies/MovieDetailViewModel.swift` | Movie detail data + actions |
| `ios/FamilyMovieNight/Models/WatchlistItem.swift` | Watchlist item model |
| `ios/FamilyMovieNight/Models/WatchedMovie.swift` | Watched movie model |
| `ios/FamilyMovieNight/Models/MovieDetail.swift` | Full movie detail model |

### Files Modified

| File | Change |
|---|---|
| `ios/FamilyMovieNight/Services/APIClient.swift` | Add watchlist, watched, movie detail API methods |
| `ios/FamilyMovieNight/Features/Home/HomeView.swift` | Add Watchlist tab/section navigation |
| `ios/FamilyMovieNight/Features/Suggestions/SuggestionsView.swift` | Add "Save for Later" action on suggestion cards |
| `ios/FamilyMovieNight/ContentView.swift` | Navigation updates if needed |

### Screens

1. **WatchlistView:** Grid/list of watchlist movies, swipe-to-delete, empty state, count badge
2. **MovieDetailView:** Full detail screen with poster, metadata, streaming links, trailer link, and group context section (watchlist badge, watched badge, vote history, action buttons)
3. **Mark Watched flow:** Confirmation dialog → optional rating prompt → success toast

### Actions from Movie Detail

| Action | Condition | Button |
|---|---|---|
| "Add to Watchlist" | Not on watchlist, not watched | Primary |
| "On Watchlist" (disabled) | Already on watchlist | Disabled |
| "Remove from Watchlist" | On watchlist, user is adder or creator | Destructive |
| "Already Watched" | Not watched | Secondary |
| "Watched on [Date]" | Already watched | Badge |
| "Undo Watched" | Direct-watched within 24h, by marker or creator | Tertiary |

### Definition of Done

- [ ] Watchlist screen shows group's movies with add/remove
- [ ] Movie detail shows TMDB metadata + group context
- [ ] Mark-as-watched flow with confirmation + optional rating
- [ ] "Save for Later" on suggestion cards
- [ ] Navigation wired from Home screen
- [ ] All screens handle empty/loading/error states
- [ ] Code merged to main

---

## Slice A Dependency Graph

```
A1 (Watchlist backend)
  │
  ├──► A2 (Direct watched + combined list)
  │      │
  │      ├──► A3 (Movie detail endpoint)
  │      │      │
  └──────┴──────┴──► A4 (iOS UI)
```

**A1** and **A2** can be started in sequence (A2 depends on A1 for watchlist auto-remove). **A3** depends on A1+A2. **A4** depends on all backend PRs.
