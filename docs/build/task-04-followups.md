# Task 04 Follow-ups

Task 04 (Preferences + Watched History) was partially delivered in PR #8 (commit 3e69401d). This doc lists the remaining work, split into PR-sized follow-up tasks.

## What Was Delivered

| Checklist Item | Status |
|---|---|
| A1. `preference.ts` model (Zod schemas) | Done (no TMDB genre ID validation — deferred) |
| B1. `preference-service.ts` — `getPreferences`, `putPreferences` | Done |
| D1. Preference routes — `GET /groups/:id/preferences`, `PUT /groups/:id/preferences` | Done |
| D3. Wired preferences into `index.ts` | Done |
| E1. IAM grant for `preferencesTable` | Done |
| G1. Preference service unit tests (get + put) | Done |
| G3. Preference route tests (GET/PUT + validation + auth) | Done |
| iOS Preferences UI (PreferencesView, ViewModel, Model) | Done (bonus — was originally scoped for Task 05) |

## What Remains

### Follow-up 04-A: Group preference summary endpoint (P0)

**Why P0:** Task 05 (suggestions) depends on `GET /groups/:id/preferences/summary` to compute the suggestion filter. This is a critical-path blocker.

**Scope:**
- Add `getGroupPreferences(groupId)` to `preference-service.ts` — Query all preferences for a group (PK = group_id)
- Add `getGroupPreferenceSummary(groupId)` to `preference-service.ts` — Computes: union of liked genres, unanimously-disliked genres, effective content-rating ceiling (min across members)
- Add route `GET /groups/:group_id/preferences/summary` in `preferences.ts` — membership required
- Add route `GET /groups/:group_id/preferences/all` in `preferences.ts` — returns all members' preferences (array); membership required (optional, lower priority but easy to add alongside)

**Affected files:**
- `backend/src/services/preference-service.ts` (add Query + aggregation methods)
- `backend/src/routes/preferences.ts` (add 1–2 routes)
- `backend/test/services/preference-service.test.ts` (add summary tests)
- `backend/test/routes/preferences.test.ts` (add summary route tests)

**Tests needed:**
- `getGroupPreferences` — returns array of all member preferences
- `getGroupPreferenceSummary` — union of likes, intersection of dislikes, min ceiling
- `getGroupPreferenceSummary` — handles single member (passthrough)
- `getGroupPreferenceSummary` — handles members with no preferences set (skips them)
- Route `GET .../preferences/summary` — 200 with computed summary; 403 for non-member

**Definition of Done:**
- `GET /groups/:id/preferences/summary` returns `{ liked_genres, disliked_genres, max_content_rating }` computed across all members
- All new tests pass
- Code merged to main

**Estimated PRs:** 1

---

### Follow-up 04-B: Pick model + watched history endpoints (P0)

**Why P0:** Task 05 needs `getWatchedMovieIds(groupId)` to exclude watched movies from suggestions. Also needed for the "mark as watched" flow after a movie night.

**Scope:**
- Create `backend/src/models/pick.ts` — Zod schemas for `PickSchema`, `MarkWatchedSchema`
- Create `backend/src/services/pick-service.ts` with methods:
  - `createPick(groupId, roundId, tmdbMovieId, pickedBy)` — PutItem (Task 05 calls this)
  - `markWatched(pickId, userId, groupId)` — UpdateItem setting `watched=true`, `watched_at=now()`; validates membership + pick belongs to group
  - `getGroupPicks(groupId)` — Query via `group-picks-index`
  - `getWatchedMovieIds(groupId)` — Returns `Set<number>` of tmdb_movie_ids where `watched=true`
- Create `backend/src/routes/picks.ts`:
  - `POST /groups/:group_id/picks/:pick_id/watched` — marks pick as watched; membership required
  - `GET /groups/:group_id/watched` — returns list of watched movie IDs
- Wire picks routes into `backend/src/index.ts`
- Add IAM grant for `picksTable` in `backend/cdk/lib/api-stack.ts`

**Affected files:**
- `backend/src/models/pick.ts` (new)
- `backend/src/services/pick-service.ts` (new)
- `backend/src/routes/picks.ts` (new)
- `backend/src/index.ts` (add route mount)
- `backend/cdk/lib/api-stack.ts` (add IAM grant)
- `backend/test/services/pick-service.test.ts` (new)
- `backend/test/routes/picks.test.ts` (new)
- `backend/test/cdk/api-stack.test.ts` (add IAM assertion)

**Tests needed:**
- `createPick` — writes pick item to DynamoDB
- `markWatched` — sets watched=true and watched_at
- `markWatched` — rejects non-member (ForbiddenError)
- `markWatched` — rejects pick not in group (NotFoundError)
- `getWatchedMovieIds` — returns set of tmdb IDs where watched=true
- Route `POST .../picks/:pick_id/watched` — 200 on success; 403 for non-member; 404 for bad pick
- Route `GET .../watched` — 200 with array of tmdb_movie_ids
- CDK test: IAM policy assertions for picksTable

**Definition of Done:**
- Pick can be created and marked as watched via API
- `GET .../watched` returns tmdb IDs of watched movies
- IAM grant for picksTable in CDK with assertion test
- All new tests pass
- Code merged to main

**Estimated PRs:** 1

---

### Follow-up 04-C: Preference cleanup on group leave (P1)

**Why P1:** Prevents orphaned preferences from polluting group summaries. Not a blocker for Task 05 (summary endpoint can tolerate stale prefs from ex-members since they won't appear in membership checks), but should be done soon.

**Scope:**
- Add `deletePreference(groupId, userId)` to `preference-service.ts` — DeleteItem
- In `group-service.ts` `leaveGroup()`, call `PreferenceService.deletePreference(groupId, userId)` after removing membership
- Handle: if preference doesn't exist, no-op (don't throw)

**Affected files:**
- `backend/src/services/preference-service.ts` (add deletePreference)
- `backend/src/services/group-service.ts` (call deletePreference in leaveGroup)
- `backend/test/services/preference-service.test.ts` (add delete test)
- `backend/test/services/group-service.test.ts` (verify preference cleanup on leave)

**Tests needed:**
- `deletePreference` — removes preference record
- `deletePreference` — no-ops when preference doesn't exist
- `leaveGroup` — also deletes the member's preferences

**Definition of Done:**
- Leaving a group cleans up the member's preferences
- All new tests pass
- Code merged to main

**Estimated PRs:** 1

---

### Follow-up 04-D: TMDB genre ID validation (P2)

**Why P2:** Currently genre_likes/dislikes accept any string. Validating against TMDB's genre ID list prevents garbage data. Not blocking for Task 05 — the suggestion algorithm will just ignore unknown genre IDs when querying TMDB. Can be added whenever convenient.

**Scope:**
- Add `TMDB_GENRE_IDS` constant map to `preference.ts` (28=Action, 35=Comedy, etc.)
- Add `.refine()` to `PutPreferenceSchema` that validates all genre IDs exist in the map
- Update iOS PreferencesView to show genre names from the same map

**Affected files:**
- `backend/src/models/preference.ts` (add genre map + validation)
- `backend/test/routes/preferences.test.ts` (add test for invalid genre ID → 400)
- `ios/FamilyMovieNight/Models/Preference.swift` (optional: genre name mapping)

**Tests needed:**
- `PUT /groups/:id/preferences` — 400 when genre_likes contains invalid genre ID
- `PUT /groups/:id/preferences` — 200 with valid TMDB genre IDs

**Definition of Done:**
- Invalid TMDB genre IDs are rejected with 400
- All tests pass
- Code merged to main

**Estimated PRs:** 1

---

## Summary

| Follow-up | Priority | Blocks Task 05? | Est. PRs |
|---|---|---|---|
| 04-A: Group preference summary | P0 | Yes — suggestion algorithm needs it | 1 |
| 04-B: Pick model + watched history | P0 | Yes — suggestion exclusion needs it | 1 |
| 04-C: Preference cleanup on leave | P1 | No | 1 |
| 04-D: TMDB genre ID validation | P2 | No | 1 |

**Total estimated PRs: 4**

## Recommended Build Order

1. **04-A** (preference summary) — unblocks Task 05 suggestion algorithm
2. **04-B** (picks + watched) — unblocks Task 05 watched-movie exclusion
3. Task 05 can start after 04-A + 04-B merge
4. **04-C** (cleanup on leave) — can be done in parallel with Task 05
5. **04-D** (genre validation) — can be done anytime

## Next PR to Build

**Follow-up 04-A: Group preference summary endpoint** — it is the smallest P0 item (adds ~50 lines of service code + 1 route + tests) and directly unblocks the Task 05 suggestion algorithm.
