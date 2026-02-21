# Slice B: Tonight Queue + Voting + Select Winner

> **Scope:** Create voting rounds from suggestions, optional watchlist integration, submit/change votes, view ranked results, lock in the pick, and round lifecycle management.
>
> **User stories covered:** US-11, US-13, US-14, US-15, US-16, US-18, US-31, US-41
>
> **Depends on:** Slice A (watchlist integration at round start requires watchlist service)

---

## Data Model Notes

All tables for Slice B already exist in CDK (`data-stack.ts`): **Rounds**, **Suggestions**, **Votes**, **Picks**. No new tables needed. However, IAM grants for Rounds, Suggestions, and Votes tables are missing from `api-stack.ts` and must be added.

### Suggestions Table Extension

The existing Suggestions table schema (PK=round_id, SK=tmdb_movie_id) gains new attributes when persisted as part of a round:

| New Attribute | Type | Notes |
|---|---|---|
| `source` | S | `"algorithm"` or `"watchlist"` (v1). `"proposed"` reserved for future US-30. |
| `overview` | S | Denormalized synopsis for display |
| `popularity` | N | For tie-breaking |
| `vote_average` | N | TMDB community rating |
| `streaming` | L | Denormalized streaming providers |
| `score` | N | Algorithm score for sorting |
| `reason` | S | Why this movie was suggested |

These fields are already present in the `Suggestion` type from `models/suggestion.ts` — they just need to be persisted to DynamoDB when a round is created.

### Votes Table Recap

Existing schema: `PK=round_id, SK=vote_key` where `vote_key = {tmdb_movie_id}#{user_id}`. This composite SK ensures one vote per user per movie per round. Re-voting is a `PutItem` overwrite.

---

## PR B1: Round Service + Create Round Endpoint

**Branch:** `feat/slice-b1-rounds`

### Scope

Implement round creation (generates suggestions + persists to Rounds and Suggestions tables), round retrieval with vote state, round closing, active-round enforcement, and optional watchlist integration at round start.

### Files Created

| File | Purpose |
|---|---|
| `backend/src/models/round.ts` | Zod schemas: `RoundSchema`, `CreateRoundSchema`, `CloseRoundSchema`, `RoundSuggestionSchema` |
| `backend/src/services/round-service.ts` | `RoundService` class |
| `backend/src/routes/rounds.ts` | Hono routes for rounds |
| `backend/test/services/round-service.test.ts` | Service unit tests |
| `backend/test/routes/rounds.test.ts` | Route integration tests |

### Files Modified

| File | Change |
|---|---|
| `backend/cdk/lib/api-stack.ts` | IAM grants for `roundsTable`, `suggestionsTable` + env vars `ROUNDS_TABLE`, `SUGGESTIONS_TABLE` |
| `backend/src/index.ts` | Mount rounds routes |
| `backend/src/routes/suggestions.ts` | Update to use round creation instead of standalone suggestions (or keep both) |
| `backend/test/cdk/api-stack.test.ts` | IAM assertions |

### API Endpoints

#### `POST /groups/:group_id/rounds`
Start a new voting round. Generates suggestions and persists them. (US-11, US-31)

**Request (optional):**
```json
{
  "exclude_movie_ids": [550, 680],
  "include_watchlist": true
}
```

- `exclude_movie_ids`: For "Show Me More" (US-13) — pass IDs from the previous batch.
- `include_watchlist`: If true, include up to 4 eligible watchlist movies tagged as `"watchlist"` source (US-31). Defaults to false.

**Auth:** JWT + group member

**Preconditions:**
- No active round for this group → 409 with `active_round_id`
- At least 2 members with preferences set → 422

**Response 201:**
```json
{
  "round_id": "uuid",
  "group_id": "uuid",
  "status": "voting",
  "started_by": "uuid",
  "created_at": "2026-02-21T20:00:00Z",
  "suggestions": [
    {
      "tmdb_movie_id": 550,
      "title": "Fight Club",
      "year": 1999,
      "poster_path": "/...",
      "genres": ["Drama", "Thriller"],
      "content_rating": "R",
      "source": "algorithm",
      "streaming": [...],
      "score": 0.85,
      "reason": "Matches your group's taste..."
    }
  ],
  "watchlist_eligible_count": 3,
  "relaxed_constraints": []
}
```

#### `GET /rounds/:round_id`
Get round details with suggestions, vote counts per movie, and vote progress. (US-14, US-15)

**Auth:** JWT + member of round's group

**Response 200:**
```json
{
  "round_id": "uuid",
  "group_id": "uuid",
  "status": "voting",
  "started_by": "uuid",
  "created_at": "2026-02-21T20:00:00Z",
  "suggestions": [
    {
      "tmdb_movie_id": 550,
      "title": "Fight Club",
      "source": "algorithm",
      "votes": { "up": 2, "down": 1 },
      "voters": [
        { "user_id": "uuid", "display_name": "Tim", "vote": "up" }
      ]
    }
  ],
  "vote_progress": { "voted": 3, "total": 4 },
  "pick": null
}
```

#### `PATCH /rounds/:round_id`
Close a voting round. Creator only. (US-14)

**Request:**
```json
{ "status": "closed" }
```

**Auth:** JWT + group creator

**Validation:**
- Round must be in `voting` status → 409
- Only creator can close → 403

**Response 200:** Updated round object.

### Service Methods

```typescript
class RoundService {
  constructor(
    docClient,
    roundsTable,
    suggestionsTable,
    votesTable,
    groupService,
    suggestionService,
    watchlistService
  )

  createRound(groupId, startedBy, options?): Promise<Round>
  getRound(roundId): Promise<RoundWithDetails>
  closeRound(roundId, userId): Promise<Round>
  getActiveRound(groupId): Promise<Round | null>
  getRoundsForGroup(groupId): Promise<Round[]>
  persistSuggestions(roundId, suggestions[]): Promise<void>
}
```

### Tests

| Test | Type | What it verifies |
|---|---|---|
| createRound — success with algorithm suggestions | Service | Round + suggestion items written |
| createRound — active round exists → ConflictError | Service | One-active-round constraint |
| createRound — < 2 members with prefs → ValidationError | Service | Preference check |
| createRound — with watchlist integration (include_watchlist=true) | Service | Watchlist movies tagged + included |
| createRound — watchlist cap (max 4 from watchlist) | Service | Cap enforcement |
| createRound — watchlist movies excluded if already watched | Service | Cross-list check |
| getRound — returns suggestions + vote counts | Service | Aggregated vote data |
| getRound — returns vote progress | Service | Voted/total counts |
| closeRound — by creator → success | Service | Status transition |
| closeRound — by non-creator → ForbiddenError | Service | Permission check |
| closeRound — already closed → ConflictError | Service | Idempotency |
| getActiveRound — returns active round | Service | GSI query with filter |
| getActiveRound — no active → null | Service | Empty result |
| POST /groups/:id/rounds — 201 | Route | End-to-end round creation |
| POST /groups/:id/rounds — 409 active exists | Route | Conflict response |
| POST /groups/:id/rounds — 422 insufficient prefs | Route | Validation |
| POST /groups/:id/rounds — 403 non-member | Route | Auth |
| GET /rounds/:id — 200 with details | Route | Full round data |
| GET /rounds/:id — 403 non-member | Route | Auth for round's group |
| PATCH /rounds/:id — 200 close | Route | Status update |
| PATCH /rounds/:id — 403 non-creator | Route | Permission |
| CDK: roundsTable + suggestionsTable grants | CDK | IAM assertions |

### Definition of Done

- [ ] Round creation persists round + suggestions to DynamoDB
- [ ] One-active-round-per-group constraint enforced
- [ ] Watchlist integration adds up to 4 movies with `"watchlist"` source tag
- [ ] Round retrieval includes vote state
- [ ] Close round (creator only) transitions status
- [ ] IAM grants for roundsTable + suggestionsTable
- [ ] All tests pass
- [ ] Code merged to main

---

## PR B2: Voting Service + Endpoints

**Branch:** `feat/slice-b2-voting`

**Depends on:** B1 (needs rounds + suggestions)

### Scope

Submit votes on movies in a round, change votes, and view ranked results with scoring logic (net score, tie-breaking by TMDB popularity).

### Files Created

| File | Purpose |
|---|---|
| `backend/src/models/vote.ts` | Zod schemas: `VoteSchema`, `SubmitVoteSchema` |
| `backend/src/services/vote-service.ts` | `VoteService` class |
| `backend/src/routes/votes.ts` | Hono routes for votes |
| `backend/test/services/vote-service.test.ts` | Service unit tests |
| `backend/test/routes/votes.test.ts` | Route integration tests |

### Files Modified

| File | Change |
|---|---|
| `backend/cdk/lib/api-stack.ts` | IAM grant for `votesTable` + env var `VOTES_TABLE` |
| `backend/src/index.ts` | Mount votes routes |
| `backend/test/cdk/api-stack.test.ts` | IAM assertion |

### API Endpoints

#### `POST /rounds/:round_id/votes`
Submit or change a vote on a movie. (US-14)

**Request:**
```json
{
  "tmdb_movie_id": 550,
  "vote": "up"
}
```

**Auth:** JWT + member of round's group

**Validation:**
- `vote` must be `"up"` or `"down"` → 400
- Round must be in `voting` status → 400 "Round is not accepting votes"
- `tmdb_movie_id` must be in the round's suggestions → 400 "Movie not in this round"

**Behavior:**
- Uses `PutItem` with composite SK `{tmdb_movie_id}#{user_id}` — idempotent upsert
- Changing a vote overwrites the previous one (no history)

**Response 200:**
```json
{
  "round_id": "uuid",
  "tmdb_movie_id": 550,
  "user_id": "uuid",
  "vote": "up",
  "voted_at": "2026-02-21T20:15:00Z"
}
```

#### `GET /rounds/:round_id/results`
Get voting results ranked by net score. (US-15)

**Auth:** JWT + member of round's group

**Response 200:**
```json
{
  "round_id": "uuid",
  "status": "voting",
  "results": [
    {
      "tmdb_movie_id": 550,
      "title": "Fight Club",
      "poster_path": "/...",
      "source": "algorithm",
      "net_score": 2,
      "votes_up": 3,
      "votes_down": 1,
      "voters": [
        { "user_id": "uuid", "display_name": "Tim", "vote": "up" }
      ],
      "rank": 1,
      "tied": false
    }
  ],
  "vote_progress": { "voted": 4, "total": 4 }
}
```

**Ranking logic:**
1. Net score (up - down) descending
2. Ties broken by TMDB popularity descending
3. If still tied, `tied: true` flag set — creator chooses manually

### Service Methods

```typescript
class VoteService {
  constructor(
    docClient,
    votesTable,
    roundsTable,
    suggestionsTable,
    membershipsTable
  )

  submitVote(roundId, tmdbMovieId, userId, vote): Promise<Vote>
  getVotesForRound(roundId): Promise<Vote[]>
  getRoundResults(roundId): Promise<RoundResult[]>
  getUserVotesForRound(roundId, userId): Promise<Vote[]>
  getVoteProgress(roundId, groupId): Promise<{ voted: number, total: number }>
}
```

### Tests

| Test | Type | What it verifies |
|---|---|---|
| submitVote — thumbs up | Service | Vote written with correct key |
| submitVote — thumbs down | Service | Down vote recorded |
| submitVote — change vote → overwrites | Service | PutItem idempotent upsert |
| submitVote — round not voting → ValidationError | Service | Status check |
| submitVote — movie not in round → ValidationError | Service | Suggestion validation |
| submitVote — non-member → ForbiddenError | Service | Auth check |
| getRoundResults — ranked by net score | Service | Scoring logic |
| getRoundResults — tie broken by popularity | Service | Tie-break |
| getRoundResults — tied flag set on exact ties | Service | Tie detection |
| getRoundResults — zero votes → all at 0 | Service | Empty votes edge case |
| getRoundResults — single voter determines ranking | Service | US-41 partial |
| getVoteProgress — correct voted/total | Service | Member count vs voted count |
| **Concurrent: two users vote on same movie** | Service | Both writes succeed, no conflict |
| **Concurrent: same user rapid-fire votes** | Service | Last write wins |
| POST /rounds/:id/votes — 200 success | Route | End-to-end vote |
| POST /rounds/:id/votes — 400 invalid vote value | Route | Zod validation |
| POST /rounds/:id/votes — 400 round not voting | Route | Status check |
| POST /rounds/:id/votes — 400 movie not in round | Route | Suggestion check |
| POST /rounds/:id/votes — 403 non-member | Route | Auth |
| GET /rounds/:id/results — 200 ranked | Route | Full results |
| GET /rounds/:id/results — 403 non-member | Route | Auth |
| CDK: votesTable IAM grant | CDK | Policy assertion |

### Concurrency Testing Detail

**Two users vote simultaneously on the same movie:**
- User A votes `up` on movie 550, User B votes `down` on movie 550
- Both write to different DynamoDB items (different SK: `550#userA` vs `550#userB`)
- Both succeed — no conflict possible
- Test verifies both votes are present when reading

**Same user rapid-fire votes (double-tap):**
- User A votes `up`, then immediately `down` on movie 550
- Both write to the same DynamoDB item (same SK: `550#userA`)
- Last write wins (DynamoDB PutItem is not conditional here)
- Test verifies final state is `down`

### Definition of Done

- [ ] Vote submission with idempotent upsert
- [ ] Vote change (overwrite) working
- [ ] Results ranked by net score with tie-breaking
- [ ] Concurrent vote scenarios verified
- [ ] IAM grant for votesTable
- [ ] All tests pass
- [ ] Code merged to main

---

## PR B3: Pick Lock-In + Round Lifecycle

**Branch:** `feat/slice-b3-pick`

**Depends on:** B1, B2 (needs rounds + votes)

### Scope

Lock in the movie pick for a round (creator only), enforce exactly-one pick per round via conditional write, transition round status through its lifecycle, and extend pick-service for the round-based flow.

### Files Modified

| File | Change |
|---|---|
| `backend/src/services/pick-service.ts` | Add `createPickForRound(roundId, tmdbMovieId, userId)` with conditional write |
| `backend/src/services/round-service.ts` | Add `pickMovie(roundId, tmdbMovieId, userId)` that orchestrates pick + status transition |
| `backend/src/routes/rounds.ts` | Add `POST /rounds/:round_id/pick` endpoint |
| `backend/test/services/pick-service.test.ts` | Add conditional write tests |
| `backend/test/services/round-service.test.ts` | Add pick + lifecycle tests |
| `backend/test/routes/rounds.test.ts` | Add pick route tests |

### API Endpoint

#### `POST /rounds/:round_id/pick`
Lock in the movie pick for this round. Creator only. (US-16)

**Request:**
```json
{
  "tmdb_movie_id": 550
}
```

**Auth:** JWT + group creator

**Validation:**
- `tmdb_movie_id` must be in the round's suggestions → 400
- Round must be in `voting` or `closed` status → 409
- Round must not already have a pick → 409 (conditional write)

**Side effects:**
- Round status transitions to `picked`
- Pick created with `watched: false`
- (Future: push notification to all members)

**Response 201:**
```json
{
  "pick_id": "uuid",
  "round_id": "uuid",
  "group_id": "uuid",
  "tmdb_movie_id": 550,
  "title": "Fight Club",
  "picked_by": "uuid",
  "picked_at": "2026-02-21T21:00:00Z",
  "watched": false
}
```

**Error 409:** A pick already exists for this round.

### Round Status Lifecycle

```
voting ──► closed ──► picked
  │                     ▲
  └─────────────────────┘
        (direct pick without closing)

voting ──► discarded (if round is abandoned)
```

### Pick Conditional Write

```typescript
// In pick-service.ts
await docClient.send(new PutCommand({
  TableName: picksTable,
  Item: pick,
  ConditionExpression: "attribute_not_exists(pick_id)",
}));

// Also check round-pick-index for existing pick:
const existing = await docClient.send(new QueryCommand({
  TableName: picksTable,
  IndexName: "round-pick-index",
  KeyConditionExpression: "round_id = :rid",
  ExpressionAttributeValues: { ":rid": roundId },
}));
if (existing.Items?.length > 0) throw new ConflictError("Pick already exists");
```

### Tests

| Test | Type | What it verifies |
|---|---|---|
| pickMovie — creator → success | Service | Pick created, round status → picked |
| pickMovie — non-creator → ForbiddenError | Service | Permission check |
| pickMovie — movie not in round → ValidationError | Service | Suggestion check |
| pickMovie — round already picked → ConflictError | Service | Conditional write |
| pickMovie — round discarded → ConflictError | Service | Status check |
| **Concurrent: double-tap pick** | Service | Only first succeeds, second gets 409 |
| **Concurrent: two creators race** | Service | Only first succeeds (conditional write) |
| Round lifecycle: voting → picked (direct) | Service | Valid transition |
| Round lifecycle: voting → closed → picked | Service | Valid transition chain |
| Round lifecycle: voting → discarded | Service | Abandon round |
| POST /rounds/:id/pick — 201 | Route | End-to-end |
| POST /rounds/:id/pick — 403 non-creator | Route | Permission |
| POST /rounds/:id/pick — 409 already picked | Route | Conflict |
| POST /rounds/:id/pick — 400 movie not in round | Route | Validation |
| markWatched — from pick confirmation | Integration | Existing flow still works |

### Concurrency Testing Detail

**Double-tap pick:**
- Creator taps "Pick This One" twice quickly
- First request creates the pick and transitions round to `picked`
- Second request finds existing pick via `round-pick-index` → returns 409
- Test runs two `pickMovie` calls concurrently and verifies exactly one succeeds

### Definition of Done

- [ ] Pick lock-in with conditional write (exactly-one per round)
- [ ] Round status transitions correctly
- [ ] Creator-only permission enforced
- [ ] Double-tap / concurrent pick scenarios verified
- [ ] All tests pass
- [ ] Code merged to main

---

## PR B4: iOS — Voting Flow + Tonight Queue UI

**Branch:** `feat/slice-b4-ios-voting`

**Depends on:** B1, B2, B3 (all backend PRs)

### Scope

iOS screens for starting a round, voting on movies, viewing results, and locking in the pick.

### Files Created

| File | Purpose |
|---|---|
| `ios/FamilyMovieNight/Features/Rounds/StartRoundView.swift` | Pre-round: suggestions + watchlist prompt |
| `ios/FamilyMovieNight/Features/Rounds/VotingView.swift` | Voting screen: thumbs up/down per movie |
| `ios/FamilyMovieNight/Features/Rounds/VotingViewModel.swift` | Voting data + actions |
| `ios/FamilyMovieNight/Features/Rounds/ResultsView.swift` | Ranked results screen |
| `ios/FamilyMovieNight/Features/Rounds/PickConfirmationView.swift` | "Tonight's movie!" confirmation |
| `ios/FamilyMovieNight/Models/Round.swift` | Round, Vote, RoundResult models |

### Files Modified

| File | Change |
|---|---|
| `ios/FamilyMovieNight/Services/APIClient.swift` | Add rounds, votes, pick API methods |
| `ios/FamilyMovieNight/Features/Home/HomeView.swift` | "Pick Tonight's Movie" CTA + active round state |
| `ios/FamilyMovieNight/Features/Suggestions/SuggestionsView.swift` | "Start Voting" button → creates round |
| `ios/FamilyMovieNight/ContentView.swift` | Navigation for round flow |

### Screens

1. **StartRoundView:** Shows suggestions, offers watchlist integration prompt ("Include watchlist movies?"), "Start Voting" button
2. **VotingView:** Vertical list of movies with thumbs up/down buttons, vote progress indicator, "Done Voting" button, source tags
3. **ResultsView:** Ranked movies with vote breakdown, who voted what, tie indicator, "Pick This One" button (creator only)
4. **PickConfirmationView:** "Tonight's movie: [Title]!", poster, "Where to Watch" link, "We Watched It" button

### UX Flows

```
Home → "Pick Tonight's Movie"
  [?] Active round?
  ├── Yes → VotingView (or ResultsView if closed)
  └── No → Generate suggestions → StartRoundView
           → [?] Include watchlist? → Create round
           → VotingView → "Done Voting"
           → ResultsView → "Pick This One" (creator)
           → PickConfirmationView → "We Watched It"
```

### Definition of Done

- [ ] Start round from suggestions with watchlist prompt
- [ ] Voting screen with thumbs up/down, progress indicator
- [ ] Results screen with rankings, tie detection, voter details
- [ ] Pick confirmation with "Where to Watch" + "We Watched It"
- [ ] Creator-only pick button; members see results read-only
- [ ] Active round detection on Home screen
- [ ] All screens handle empty/loading/error states
- [ ] Code merged to main

---

## Slice B Dependency Graph

```
B1 (Rounds service + create round)
  │
  ├──► B2 (Voting service + endpoints)
  │      │
  │      ├──► B3 (Pick lock-in + lifecycle)
  │      │      │
  └──────┴──────┴──► B4 (iOS voting flow UI)
```

**B1** is the foundation. **B2** depends on B1 (needs rounds to vote on). **B3** depends on B1+B2 (needs rounds + votes for the full lifecycle). **B4** depends on all backend PRs.

---

## Cross-Slice Dependencies

Slice B depends on Slice A for:
- **Watchlist integration at round start** (B1 calls `WatchlistService.getWatchlist()` from Slice A)
- **Watched movie exclusion** uses `WatchedService.getAllWatchedMovieIds()` from Slice A
- **Movie detail from voting screen** navigates to MovieDetailView from Slice A

If Slice B is started before Slice A completes, B1 can stub out watchlist integration (`include_watchlist` always false) and be updated when A1 merges.
