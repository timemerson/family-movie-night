# Test Matrix — Slice B: Tonight Queue + Voting + Select Winner

---

## Legend

| Column | Meaning |
|---|---|
| **ID** | Unique test identifier (SB = Slice B) |
| **Layer** | `service` = unit, `route` = integration, `cdk` = infra, `concurrency` = race condition |
| **Category** | `happy`, `auth`, `permission`, `edge`, `cross-feature`, `concurrency` |
| **PR** | Which PR introduces this test |

---

## PR B1: Round Service + Create Round Endpoint

### Service Tests (`round-service.test.ts`)

| ID | Test | Category | Expected | Notes |
|---|---|---|---|---|
| SB-001 | `createRound` — success with algorithm suggestions | happy | Round + suggestion items written | Verify Rounds + Suggestions tables |
| SB-002 | `createRound` — active round exists | edge | `ConflictError` (409) with `active_round_id` | GSI query `status=voting` |
| SB-003 | `createRound` — < 2 members with prefs | edge | `ValidationError` (422) | Preference count check |
| SB-004 | `createRound` — with watchlist integration (true) | cross-feature | Watchlist movies included with source=`"watchlist"` | Up to 4 movies |
| SB-005 | `createRound` — watchlist integration cap (max 4) | edge | Only 4 watchlist movies added | Even if watchlist has more |
| SB-006 | `createRound` — watchlist movie already watched → excluded | cross-feature | Watched watchlist movies skipped | Cross-list check |
| SB-007 | `createRound` — watchlist integration (false) | happy | Only algorithm suggestions | No watchlist movies |
| SB-008 | `createRound` — empty watchlist with include_watchlist=true | edge | Only algorithm suggestions, no error | Graceful handling |
| SB-009 | `createRound` — exclude_movie_ids filters results | happy | Excluded movies not in suggestions | "Show Me More" support |
| SB-010 | `createRound` — persists suggestions to DynamoDB | happy | Suggestions table has items | PK=round_id, SK=tmdb_movie_id |
| SB-011 | `getRound` — returns suggestions + vote counts | happy | Aggregated vote data per movie | Joins Suggestions + Votes |
| SB-012 | `getRound` — returns vote progress | happy | `{ voted: N, total: M }` | Members who voted vs total |
| SB-013 | `getRound` — round not found | edge | `NotFoundError` (404) | Invalid round_id |
| SB-014 | `closeRound` — by creator | permission | Status → `closed`, `closed_at` set | |
| SB-015 | `closeRound` — by non-creator | permission | `ForbiddenError` (403) | |
| SB-016 | `closeRound` — already closed | edge | `ConflictError` (409) | Idempotency / status check |
| SB-017 | `closeRound` — already picked | edge | `ConflictError` (409) | Can't close a picked round |
| SB-018 | `getActiveRound` — returns active round | happy | Round with status=`voting` | GSI query |
| SB-019 | `getActiveRound` — no active round | edge | `null` | Empty result |
| SB-020 | `getActiveRound` — only most recent active round | edge | Latest by created_at | Shouldn't happen but defensive |

### Route Tests (`rounds.test.ts`)

| ID | Test | Category | Expected | Notes |
|---|---|---|---|---|
| SB-021 | `POST /groups/:id/rounds` — 201 success | happy | Round with suggestions | |
| SB-022 | `POST /groups/:id/rounds` — 201 with watchlist | cross-feature | Suggestions include watchlist movies | `include_watchlist=true` |
| SB-023 | `POST /groups/:id/rounds` — 409 active round | edge | Error with active_round_id | |
| SB-024 | `POST /groups/:id/rounds` — 422 insufficient prefs | edge | Validation error | |
| SB-025 | `POST /groups/:id/rounds` — 403 non-member | auth | Not a member | |
| SB-026 | `POST /groups/:id/rounds` — 401 no JWT | auth | Unauthorized | |
| SB-027 | `GET /rounds/:id` — 200 with details | happy | Full round data | |
| SB-028 | `GET /rounds/:id` — 403 non-member of round's group | auth | Forbidden | Cross-group check |
| SB-029 | `GET /rounds/:id` — 404 not found | edge | Not found | |
| SB-030 | `PATCH /rounds/:id` — 200 close round | happy | Status = `closed` | |
| SB-031 | `PATCH /rounds/:id` — 403 non-creator | permission | Forbidden | |
| SB-032 | `PATCH /rounds/:id` — 409 not in voting status | edge | Conflict | |

### CDK Tests

| ID | Test | Category | Expected | Notes |
|---|---|---|---|---|
| SB-033 | roundsTable IAM grant | cdk | Lambda has read/write | |
| SB-034 | suggestionsTable IAM grant | cdk | Lambda has read/write | |
| SB-035 | ROUNDS_TABLE env var set | cdk | In Lambda config | |
| SB-036 | SUGGESTIONS_TABLE env var set | cdk | In Lambda config | |

---

## PR B2: Voting Service + Endpoints

### Service Tests (`vote-service.test.ts`)

| ID | Test | Category | Expected | Notes |
|---|---|---|---|---|
| SB-037 | `submitVote` — thumbs up | happy | Vote written: `vote_key = {mid}#{uid}` | PutItem |
| SB-038 | `submitVote` — thumbs down | happy | Vote written with `vote: "down"` | |
| SB-039 | `submitVote` — change vote (up → down) | happy | Previous vote overwritten | PutItem idempotent |
| SB-040 | `submitVote` — change vote (down → up) | happy | Previous vote overwritten | |
| SB-041 | `submitVote` — round not in voting status | edge | `ValidationError` (400) | Round closed/picked |
| SB-042 | `submitVote` — movie not in round suggestions | edge | `ValidationError` (400) | Suggestion check |
| SB-043 | `submitVote` — non-member of round's group | auth | `ForbiddenError` (403) | Membership check |
| SB-044 | `submitVote` — round not found | edge | `NotFoundError` (404) | |
| SB-045 | `getRoundResults` — ranked by net score desc | happy | Correct ordering | up - down |
| SB-046 | `getRoundResults` — tie broken by TMDB popularity | edge | Higher popularity ranked first | Sub-sort |
| SB-047 | `getRoundResults` — tied movies flagged | edge | `tied: true` on equal-score movies | UI highlighting |
| SB-048 | `getRoundResults` — zero votes (all 0-0) | edge | All movies at rank 1, score 0 | US-41 |
| SB-049 | `getRoundResults` — single voter | edge | That voter's votes determine ranking | |
| SB-050 | `getRoundResults` — all members voted same way | edge | Unanimous result | |
| SB-051 | `getVoteProgress` — 0 of 4 voted | happy | `{ voted: 0, total: 4 }` | |
| SB-052 | `getVoteProgress` — 3 of 4 voted | happy | `{ voted: 3, total: 4 }` | |
| SB-053 | `getVoteProgress` — all voted | happy | `{ voted: 4, total: 4 }` | |
| SB-054 | `getUserVotesForRound` — returns user's votes | happy | Array of user's votes | For display |

### Concurrency Tests (`vote-service.test.ts`)

| ID | Test | Category | Expected | Notes |
|---|---|---|---|---|
| SB-055 | **Two users vote on same movie simultaneously** | concurrency | Both succeed | Different DynamoDB items (different SK) |
| SB-056 | **Same user rapid-fire votes (up then down)** | concurrency | Last write wins (down) | Same item, PutItem overwrite |
| SB-057 | **User votes while creator closes round** | concurrency | Vote rejected if close committed first | Race: status check |
| SB-058 | **Three users vote on three different movies at once** | concurrency | All succeed independently | No contention |

#### Concurrency Test Implementation Notes

**SB-055 (two users, same movie):**
```
Parallel:
  User A: PutItem(round_id, "550#userA", vote="up")
  User B: PutItem(round_id, "550#userB", vote="down")
Assert: Both items exist, vote tally = 1 up, 1 down
```

**SB-056 (rapid-fire same user):**
```
Sequential (fast):
  User A: PutItem(round_id, "550#userA", vote="up")
  User A: PutItem(round_id, "550#userA", vote="down")
Assert: Item has vote="down", only one item exists
```

**SB-057 (vote vs close race):**
```
Parallel:
  Creator: UpdateItem(round_id, status="closed")
  Member: submitVote (reads status, checks "voting", writes vote)
Assert: If close committed first → vote rejected; if vote committed first → vote exists
Implementation: Service reads round status before writing vote; test verifies rejection
```

### Route Tests (`votes.test.ts`)

| ID | Test | Category | Expected | Notes |
|---|---|---|---|---|
| SB-059 | `POST /rounds/:id/votes` — 200 success | happy | Vote returned | |
| SB-060 | `POST /rounds/:id/votes` — 200 change vote | happy | Updated vote | |
| SB-061 | `POST /rounds/:id/votes` — 400 invalid vote value | edge | Zod error: must be "up" or "down" | |
| SB-062 | `POST /rounds/:id/votes` — 400 round not voting | edge | Round not accepting votes | |
| SB-063 | `POST /rounds/:id/votes` — 400 movie not in round | edge | Movie not in suggestions | |
| SB-064 | `POST /rounds/:id/votes` — 403 non-member | auth | Forbidden | |
| SB-065 | `POST /rounds/:id/votes` — 401 no JWT | auth | Unauthorized | |
| SB-066 | `GET /rounds/:id/results` — 200 ranked results | happy | Sorted by net score | |
| SB-067 | `GET /rounds/:id/results` — 200 with ties | edge | Tied movies flagged | |
| SB-068 | `GET /rounds/:id/results` — 200 zero votes | edge | All at 0, message | US-41 |
| SB-069 | `GET /rounds/:id/results` — 200 shows voters | happy | Voter details per movie | Transparent voting |
| SB-070 | `GET /rounds/:id/results` — 403 non-member | auth | Forbidden | |

### CDK Tests

| ID | Test | Category | Expected | Notes |
|---|---|---|---|---|
| SB-071 | votesTable IAM grant | cdk | Lambda has read/write | |
| SB-072 | VOTES_TABLE env var set | cdk | In Lambda config | |

---

## PR B3: Pick Lock-In + Round Lifecycle

### Service Tests (`pick-service.test.ts` + `round-service.test.ts`)

| ID | Test | Category | Expected | Notes |
|---|---|---|---|---|
| SB-073 | `pickMovie` — creator picks → success | happy | Pick created, round → `picked` | |
| SB-074 | `pickMovie` — non-creator | permission | `ForbiddenError` (403) | |
| SB-075 | `pickMovie` — movie not in round | edge | `ValidationError` (400) | Suggestion check |
| SB-076 | `pickMovie` — round already picked | edge | `ConflictError` (409) | Conditional write |
| SB-077 | `pickMovie` — round discarded | edge | `ConflictError` (409) | Invalid status |
| SB-078 | `pickMovie` — round in voting status (direct pick) | happy | Pick created, round → `picked` | Skip close step |
| SB-079 | `pickMovie` — round in closed status | happy | Pick created, round → `picked` | After explicit close |
| SB-080 | `pickMovie` — pick includes denormalized movie data | happy | title, poster_path in pick item | |
| SB-081 | Round lifecycle: voting → picked | happy | Valid transition | |
| SB-082 | Round lifecycle: voting → closed → picked | happy | Two-step transition | |
| SB-083 | Round lifecycle: voting → discarded | happy | Abandoned round | |
| SB-084 | Round lifecycle: picked → closed (invalid) | edge | Error | Can't go backwards |
| SB-085 | `markWatched` — from pick (existing flow) | happy | Pick `watched=true` | Regression: existing flow |

### Concurrency Tests

| ID | Test | Category | Expected | Notes |
|---|---|---|---|---|
| SB-086 | **Double-tap pick** | concurrency | First succeeds, second → 409 | Same user, same round |
| SB-087 | **Two creators race to pick** (impossible in v1 but defensive) | concurrency | Only first succeeds | Conditional write |
| SB-088 | **Pick while vote in progress** | concurrency | Pick succeeds; vote may succeed if before status change | Race between pick and vote |

#### Concurrency Test Implementation Notes

**SB-086 (double-tap):**
```
Parallel:
  Creator: pickMovie(round_id, movie_550)
  Creator: pickMovie(round_id, movie_550)
Assert: Exactly one pick exists for round_id (query round-pick-index)
Assert: One call succeeded (201), one threw ConflictError (409)
```

**SB-087 (two creators — defensive):**
```
This can't happen in v1 (one creator per group), but the conditional write
handles it generically. Test with two different user IDs both having
creator role (mock).

Parallel:
  Creator A: pickMovie(round_id, movie_550)
  Creator B: pickMovie(round_id, movie_680)
Assert: Exactly one pick exists for round_id
```

**SB-088 (pick while vote):**
```
Parallel:
  Creator: pickMovie(round_id, movie_550) — transitions round to "picked"
  Member: submitVote(round_id, movie_550, "up") — checks round status = "voting"
Assert: If pick commits first → vote rejected (round no longer voting)
         If vote commits first → vote exists AND pick exists
```

### Route Tests (added to `rounds.test.ts`)

| ID | Test | Category | Expected | Notes |
|---|---|---|---|---|
| SB-089 | `POST /rounds/:id/pick` — 201 success | happy | Pick returned | |
| SB-090 | `POST /rounds/:id/pick` — 403 non-creator | permission | Forbidden | |
| SB-091 | `POST /rounds/:id/pick` — 409 already picked | edge | Conflict | |
| SB-092 | `POST /rounds/:id/pick` — 400 movie not in round | edge | Validation error | |
| SB-093 | `POST /rounds/:id/pick` — 409 round discarded | edge | Invalid status | |

### Integration Tests

| ID | Test | Category | Expected | Notes |
|---|---|---|---|---|
| SB-094 | Full flow: create round → vote → close → pick → mark watched | cross-feature | Complete lifecycle | End-to-end |
| SB-095 | Pick → mark watched → excluded from next round | cross-feature | Watched movie not in suggestions | Full loop |
| SB-096 | New member joins → can vote on active round | cross-feature | US-39: new member participation | |

---

## Coverage Summary

| Category | Count | % |
|---|---|---|
| Happy path | 30 | 31% |
| Auth / permission | 13 | 14% |
| Edge cases | 25 | 26% |
| Cross-feature | 10 | 10% |
| Concurrency | 7 | 7% |
| CDK | 6 | 6% |
| Integration (e2e) | 3 | 3% |
| **Total** | **96** | |

### Concurrency Scenarios Tested

| Scenario | Expected Behavior | Why It Matters |
|---|---|---|
| Two users vote on same movie at once | Both succeed (different items) | Families voting simultaneously |
| User rapid-fire votes | Last write wins | UI double-tap |
| Vote during round close | Vote rejected if close committed first | Race condition |
| Double-tap pick | Only first succeeds (409) | UI double-tap |
| Pick while vote in progress | Pick succeeds; late vote rejected | Timing edge case |

### Permission Checks Tested

| Action | Creator | Member | Non-member |
|---|---|---|---|
| Create round | Yes | Yes | 403 |
| View round | Yes | Yes | 403 |
| Close round | Yes | 403 | 403 |
| Submit vote | Yes | Yes | 403 |
| View results | Yes | Yes | 403 |
| Lock in pick | Yes | 403 | 403 |
