# Backlog

Use this as a lightweight issue tracker if not using GitHub Issues yet.

## States (labels)
- ready
- in-progress
- needs-review
- needs-test
- blocked
- done

## Tasks

### Task 01 — Setup AWS dev environment + IaC skeleton
- [x] (done) Setup AWS dev environment + IaC skeleton
  - Merged 2026-02-15 (PR #1/#2). Delivered: 5 CDK stacks (Data, Auth, Api, Notifications, Monitoring), DynamoDB tables with GSIs, Hono Lambda skeleton (`/health`), error class hierarchy, CDK snapshot + assertion tests, CI workflow.

---

### Task 02 — iOS app skeleton + auth wiring
- [x] (done) iOS app skeleton + auth wiring
  - Merged 2026-02-15 (PR #5). Delivered: Cognito User Pool + Apple IdP federation, HTTP API Gateway with JWT Authorizer, `POST /auth/me` (JIT provisioning) + `DELETE /auth/account`, iOS project scaffold with Amplify Auth, Sign in with Apple + email/password flows, auth state management.

---

### Task 03 — Create/join family group
- [x] (done) Create/join family group
  - Merged 2026-02-16 (PR #6). Delivered: group CRUD (`POST /groups`, `GET /groups/:id`, `PATCH /groups/:id`), membership management (`GET /groups/me`, `DELETE /groups/:id/members/me` with creator promotion), invite flow (`POST /groups/:id/invites`, `GET /groups/:id/invites`, `DELETE /groups/:id/invites/:invite_id`, `POST /invites/:token/accept`), multi-use invites with 7-day TTL, atomic DynamoDB transactions, group-service + invite-service, comprehensive route + service tests.

---

### Task 04 — Preferences + watched history (minimal)
- [ ] (ready) Preferences + watched history (minimal)
  - See detailed checklist below.

### Task 05 — Suggestions endpoint + UI
- [ ] (ready) Suggestions endpoint + UI

---

## Task 04 — Detailed Breakdown

### Scope

Covers US-08 (genre likes/dislikes), US-09 (content-rating ceiling), and US-18 (mark as watched) end-to-end on the backend, plus a `GET /groups/:id/preferences/summary` endpoint that Task 05 will consume for the suggestion algorithm. By the end, a member can set their genre preferences and content-rating ceiling, and any member can mark a picked movie as watched so it's excluded from future suggestions.

**Out of scope for Task 04:** Streaming services (US-10, already on Group via PATCH), ratings (US-19, comes with Task 05), iOS preference UI (comes with Task 05 to deliver the full loop).

### User Stories Covered

| Story | Coverage |
|---|---|
| US-08 (Genre likes/dislikes) | Full — backend CRUD |
| US-09 (Content-rating ceiling) | Backend CRUD; group-level effective ceiling via summary endpoint |
| US-18 (Mark as watched) | Backend — mark pick as watched, query watched movie IDs for exclusion |

### Dependencies

| # | Dependency | Status |
|---|---|---|
| D1 | Preferences DynamoDB table (PK=group_id, SK=user_id) | ✅ Exists in data-stack |
| D2 | Picks DynamoDB table (PK=pick_id, GSI=group-picks-index) | ✅ Exists in data-stack |
| D3 | IAM grant for preferencesTable + picksTable on Lambda | ❌ Must add in api-stack |
| D4 | TMDB genre ID list | Use static list from TMDB `/genre/movie/list`; hardcode in validation |

### Checklist

#### A. Models + validation schemas

- [ ] A1. Create `backend/src/models/preference.ts` — Zod schemas:
  - `PreferenceSchema`: `group_id`, `user_id`, `genre_likes` (string[]), `genre_dislikes` (string[]), `max_content_rating` (enum G/PG/PG-13/R, default PG-13), `updated_at`
  - `UpsertPreferenceSchema`: input validation — `genre_likes` (min 2, max 20), `genre_dislikes` (max 20), `max_content_rating`; no overlap between likes and dislikes
  - `TMDB_GENRE_IDS`: static map of valid TMDB genre IDs (28=Action, 35=Comedy, etc.) for validation
- [ ] A2. Create `backend/src/models/pick.ts` — Zod schemas:
  - `PickSchema`: `pick_id`, `round_id`, `group_id`, `tmdb_movie_id`, `picked_by`, `picked_at`, `watched` (bool), `watched_at` (nullable)
  - `MarkWatchedSchema`: empty body (action is implicit from the route)

#### B. Preference service

- [ ] B1. Create `backend/src/services/preference-service.ts` with methods:
  - `getPreference(groupId, userId)` — GetItem from Preferences table; returns null if not set
  - `upsertPreference(groupId, userId, input)` — PutItem with `updated_at = now()`; validates membership first via GroupService
  - `getGroupPreferences(groupId)` — Query all preferences for a group (PK = group_id); returns array
  - `getGroupPreferenceSummary(groupId)` — Computes: union of liked genres, unanimously-disliked genres, effective content-rating ceiling (min across members)
  - `deletePreference(groupId, userId)` — DeleteItem (used when a member leaves a group)

#### C. Pick / watched service

- [ ] C1. Create `backend/src/services/pick-service.ts` with methods:
  - `createPick(groupId, roundId, tmdbMovieId, pickedBy)` — PutItem; Task 05 will call this from voting flow
  - `markWatched(pickId, userId, groupId)` — UpdateItem setting `watched=true`, `watched_at=now()`; validates membership + pick belongs to group
  - `getGroupPicks(groupId)` — Query via `group-picks-index`; returns all picks for group
  - `getWatchedMovieIds(groupId)` — Returns `Set<number>` of tmdb_movie_ids where `watched=true` (used by Task 05 suggestion filter)

#### D. Routes

- [ ] D1. Create `backend/src/routes/preferences.ts`:
  - `GET /groups/:group_id/preferences/me` — returns current user's preferences for the group (200 or 200 with defaults if unset)
  - `PUT /groups/:group_id/preferences/me` — upsert preferences; validates body with `UpsertPreferenceSchema`; returns 200 with saved preferences
  - `GET /groups/:group_id/preferences` — returns all members' preferences (array); membership required
  - `GET /groups/:group_id/preferences/summary` — returns computed summary (liked genres, disliked genres, effective ceiling); membership required
- [ ] D2. Create `backend/src/routes/picks.ts`:
  - `POST /groups/:group_id/picks/:pick_id/watched` — marks pick as watched; membership required; returns 200
  - `GET /groups/:group_id/watched` — returns list of watched movie IDs for the group; membership required
- [ ] D3. Wire new routers into `backend/src/index.ts`

#### E. CDK — IAM grants

- [ ] E1. Add `grantReadWriteData` for `preferencesTable` and `picksTable` on Lambda handler in `backend/cdk/lib/api-stack.ts`
- [ ] E2. CDK test: assert IAM grants exist for new tables

#### F. Cleanup hook — delete preferences on group leave

- [ ] F1. In `group-service.ts` `leaveGroup()`, add call to `PreferenceService.deletePreference(groupId, userId)` so orphaned preferences don't pollute group summaries

#### G. Tests

- [ ] G1. Unit tests `backend/test/services/preference-service.test.ts`:
  - `getPreference` — returns preference or null
  - `upsertPreference` — creates new / updates existing
  - `upsertPreference` — rejects non-member (throws ForbiddenError)
  - `upsertPreference` — rejects overlapping likes/dislikes (throws ValidationError)
  - `getGroupPreferenceSummary` — computes union of likes, intersection of dislikes, min ceiling
  - `deletePreference` — removes preference record
- [ ] G2. Unit tests `backend/test/services/pick-service.test.ts`:
  - `markWatched` — sets watched=true and watched_at
  - `markWatched` — rejects non-member
  - `getWatchedMovieIds` — returns set of tmdb IDs
- [ ] G3. Route tests `backend/test/routes/preferences.test.ts`:
  - `GET /groups/:id/preferences/me` — 200 with preferences or defaults
  - `PUT /groups/:id/preferences/me` — 200 on valid input; 400 on bad input; 403 for non-member
  - `GET /groups/:id/preferences/summary` — 200 with computed summary
- [ ] G4. Route tests `backend/test/routes/picks.test.ts`:
  - `POST /groups/:id/picks/:pick_id/watched` — 200 on success; 403 for non-member; 404 for bad pick
  - `GET /groups/:id/watched` — 200 with array of tmdb_movie_ids
- [ ] G5. CDK test: `cdk synth` passes; IAM policy assertions for new tables

### Definition of Done

- [ ] User can set genre likes/dislikes and content-rating ceiling via API
- [ ] `GET .../preferences/summary` returns correct group-level aggregation (union of likes, unanimous dislikes, min ceiling)
- [ ] A picked movie can be marked as watched; `GET .../watched` returns its tmdb ID
- [ ] Leaving a group cleans up the member's preferences
- [ ] Validation rejects: overlapping likes/dislikes, invalid genre IDs, invalid ratings
- [ ] All new backend tests pass (`vitest`)
- [ ] CDK synth passes with updated IAM grants
- [ ] No secrets committed
- [ ] Code merged to main via PR

### File Touchpoints

| Area | Files (new or modified) |
|---|---|
| Models | `backend/src/models/preference.ts` ✱, `backend/src/models/pick.ts` ✱ |
| Services | `backend/src/services/preference-service.ts` ✱, `backend/src/services/pick-service.ts` ✱ |
| Routes | `backend/src/routes/preferences.ts` ✱, `backend/src/routes/picks.ts` ✱ |
| App wiring | `backend/src/index.ts` (add route mounts) |
| Group cleanup | `backend/src/services/group-service.ts` (leaveGroup → delete preference) |
| CDK | `backend/cdk/lib/api-stack.ts` (add IAM grants) |
| CDK tests | `backend/test/cdk/api-stack.test.ts` (assert new grants) |
| Service tests | `backend/test/services/preference-service.test.ts` ✱, `backend/test/services/pick-service.test.ts` ✱ |
| Route tests | `backend/test/routes/preferences.test.ts` ✱, `backend/test/routes/picks.test.ts` ✱ |

✱ = new file

### Test Requirements

| Layer | What to test | Approach |
|---|---|---|
| Service | Preference CRUD + summary aggregation | Mock DynamoDB `@aws-sdk/lib-dynamodb` |
| Service | Pick watched flow + watched ID retrieval | Mock DynamoDB |
| Routes | Preference GET/PUT + summary endpoint | `app.request()` with mocked JWT context |
| Routes | Pick watched + watched list endpoints | `app.request()` with mocked JWT context |
| CDK | IAM grants for preferencesTable + picksTable | `Template.fromStack()` assertions |
