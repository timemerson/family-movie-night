# V1 Vertical Slice Plan

**Slice:** Auth → Create/Join Family Group → Preferences → Suggestions

**Goal:** A single user can sign up, create a group, invite one other person, both set preferences, and tap "Suggest Movies" to see a ranked shortlist. This is the minimal path that proves the core loop works end-to-end.

**What's out of scope for this slice:** Voting, Picks, Ratings, Watch History, Notifications (SNS), Child Profiles, Account Deletion, Onboarding Carousel. These come in the next slice.

---

## Milestones

| # | Milestone | Done when… |
|---|-----------|------------|
| M0 | Backend scaffold + CI | `cdk synth` succeeds, `npm test` runs, CI green |
| M1 | Auth end-to-end | curl can get a Cognito token and hit `GET /users/me` successfully |
| M2 | Groups + Invites | curl can create a group, generate an invite, and accept it as a second user |
| M3 | Preferences | curl can save and retrieve preferences; Zod rejects invalid payloads |
| M4 | Suggestions | `POST /groups/{id}/rounds` returns 5–8 ranked movies from TMDB |
| M5 | iOS thin slice | iOS app can sign in, create group, set prefs, and view suggestions on-device |

---

## Definition of Done (all tasks)

- Code merged to `main` via PR with at least a self-review
- Unit/integration tests added or updated (see test column per task)
- No secrets committed (TMDB key, Cognito secrets in SSM only)
- Linter passes (`eslint` for TS, `swiftlint` for iOS)
- `cdk diff` shows only expected changes (for infra PRs)

---

## Task Breakdown

### M0 — Backend Scaffold + CI

#### T01: Initialize backend project

**What:** Set up `backend/` with package.json, TypeScript config, esbuild bundling, and a Hono hello-world Lambda handler.

**Files created:**
- `backend/package.json`
- `backend/tsconfig.json`
- `backend/esbuild.config.ts`
- `backend/src/index.ts` (Hono app with `GET /health` → 200)
- `backend/src/lib/errors.ts` (HTTP error classes)
- `backend/.eslintrc.json`

**Definition of Done:** `npm run build` produces a bundled Lambda artifact. `npm run lint` passes.

**Tests:** Hono app unit test — `GET /health` returns 200.

---

#### T02: CDK app + DataStack (tables for the slice)

**What:** Initialize CDK app. Create `DataStack` with the DynamoDB tables needed for this slice: Users, Groups, GroupMemberships, Preferences, Invites, Rounds, Suggestions, TmdbCache. Include all GSIs per the data model doc. On-demand billing.

**Files created:**
- `backend/cdk/bin/app.ts`
- `backend/cdk/lib/data-stack.ts`
- `backend/cdk/cdk.json`
- `backend/cdk/tsconfig.json`
- `backend/test/cdk/data-stack.test.ts`

**Definition of Done:** `cdk synth` produces valid CloudFormation. Snapshot test passes.

**Tests:** CDK snapshot test for DataStack.

---

#### T03: AuthStack — Cognito User Pool

**What:** Create `AuthStack` with Cognito User Pool, email/password sign-up enabled, password policy (≥8 chars, 1 number). Apple Sign-In federation config placeholder (requires Apple Developer credentials — use env-gated config). App client with explicit auth flows.

**Files created:**
- `backend/cdk/lib/auth-stack.ts`
- `backend/test/cdk/auth-stack.test.ts`

**Definition of Done:** `cdk synth` succeeds. Snapshot test passes. User Pool exports its ID and app client ID for ApiStack.

**Tests:** CDK snapshot test for AuthStack.

---

#### T04: ApiStack — Lambda + API Gateway + JWT authorizer

**What:** Create `ApiStack` that depends on DataStack and AuthStack. Single Lambda function (Node.js 20, arm64) with Hono. API Gateway HTTP API with Cognito JWT authorizer. Lambda gets table names and Cognito config as environment variables. Grant DynamoDB read/write per-table.

**Files created:**
- `backend/cdk/lib/api-stack.ts`
- `backend/test/cdk/api-stack.test.ts`

**Definition of Done:** `cdk synth` succeeds. The JWT authorizer references the Cognito User Pool. Lambda has env vars for all table names.

**Tests:** CDK snapshot test for ApiStack. Assertion test: Lambda env vars include all table names.

---

#### T05: CI pipeline for backend

**What:** GitHub Actions workflow: install → lint → test → `cdk synth`. Triggered on push/PR to `main` and `feature/**` branches. Cache node_modules.

**Files touched:**
- `.github/workflows/ci.yml` (update existing or create `backend-ci.yml`)

**Definition of Done:** CI runs on PR, all steps pass.

**Tests:** N/A (CI is the test).

---

### M1 — Auth End-to-End

#### T06: DynamoDB client + table helpers

**What:** Create a typed DynamoDB document client wrapper. Helper functions for common operations (getItem, putItem, query, update) with proper error handling. Table name lookup from env vars.

**Files created:**
- `backend/src/lib/dynamo.ts`
- `backend/test/lib/dynamo.test.ts`

**Definition of Done:** Helpers are importable and typed. Tests pass using mocked DynamoDB client.

**Tests:** Unit tests with `aws-sdk-client-mock` for get/put/query operations.

---

#### T07: GET /users/me with JIT provisioning

**What:** Implement the users route. Extract Cognito `sub` from the API Gateway request context (JWT authorizer injects it). Check if a User record exists in DynamoDB; if not, create one with defaults (display name from Cognito claims, default avatar, default notification prefs). Return user JSON.

**Files created:**
- `backend/src/routes/users.ts`
- `backend/src/services/auth.ts` (extractUserId helper, JIT provisioning logic)
- `backend/src/schemas/users.ts` (Zod response schema)
- `backend/test/routes/users.test.ts`

**Definition of Done:** `GET /users/me` returns 200 with user object. JIT creates user on first call. Second call returns existing user.

**Tests:** Unit tests: (1) new user JIT provisioned, (2) existing user returned, (3) missing auth context → 401.

---

#### T08: PATCH /users/me

**What:** Update display_name and/or avatar_key. Zod validation: display_name max 30 chars, avatar_key from allowed set.

**Files touched:**
- `backend/src/routes/users.ts`
- `backend/src/schemas/users.ts`
- `backend/test/routes/users.test.ts`

**Definition of Done:** Partial updates work. Invalid input returns 400 with field errors.

**Tests:** Unit tests: (1) update display_name, (2) invalid avatar_key → 400, (3) partial update only changes specified fields.

---

### M2 — Groups + Invites

#### T09: POST /groups — Create group

**What:** Create a new group. Creator becomes first member (write to Groups + GroupMemberships in a transaction). Validate group name (required, max 40 chars).

**Files created:**
- `backend/src/routes/groups.ts`
- `backend/src/schemas/groups.ts`
- `backend/test/routes/groups.test.ts`

**Definition of Done:** Group created with creator as first member. Response includes member list.

**Tests:** Unit tests: (1) happy path — group + membership created, (2) missing name → 400, (3) name too long → 400.

---

#### T10: GET /groups/{group_id} + group-member middleware

**What:** Return group details with member list. Implement `group-member` middleware that checks GroupMemberships table and rejects non-members with 403.

**Files created:**
- `backend/src/middleware/group-member.ts`
- `backend/test/middleware/group-member.test.ts`

**Files touched:**
- `backend/src/routes/groups.ts`
- `backend/test/routes/groups.test.ts`

**Definition of Done:** Non-members get 403. Members get full group object with member array.

**Tests:** Unit tests: (1) member sees group, (2) non-member gets 403, (3) group not found → 404.

---

#### T11: PATCH /groups/{group_id} + group-creator middleware

**What:** Update group name or streaming_services. Implement `group-creator` middleware (extends group-member check, verifies role=creator).

**Files created:**
- `backend/src/middleware/group-creator.ts`
- `backend/test/middleware/group-creator.test.ts`

**Files touched:**
- `backend/src/routes/groups.ts`
- `backend/src/schemas/groups.ts`
- `backend/test/routes/groups.test.ts`

**Definition of Done:** Only creator can update. Members get 403. Streaming services array saved.

**Tests:** Unit tests: (1) creator updates name, (2) member tries → 403, (3) update streaming services.

---

#### T12: Invite flow — create, accept, list, revoke

**What:** Implement all four invite endpoints:
- `POST /groups/{group_id}/invites` — generate invite (creator only)
- `GET /groups/{group_id}/invites` — list pending (creator only)
- `DELETE /groups/{group_id}/invites/{invite_id}` — revoke (creator only)
- `POST /invites/{invite_token}/accept` — accept and join group

Invite tokens are crypto-random strings. Expiry = 7 days. Accept checks: token valid, not expired, not revoked, group not full (8 members). Accepting creates a GroupMembership record.

**Files created:**
- `backend/src/routes/invites.ts`
- `backend/src/schemas/invites.ts`
- `backend/test/routes/invites.test.ts`

**Definition of Done:** Full invite lifecycle works. Edge cases handled (expired, revoked, full group, already a member).

**Tests:** Unit tests: (1) create invite, (2) accept invite — user added to group, (3) expired token → 410, (4) revoked token → 410, (5) group full → 409, (6) list returns only pending, (7) non-creator → 403.

---

### M3 — Preferences

#### T13: PUT & GET /groups/{group_id}/preferences

**What:** Save and retrieve per-user, per-group preferences. Zod validation: genre_likes ≥ 2, no overlap between likes/dislikes, max_content_rating in [G, PG, PG-13, R].

**Files created:**
- `backend/src/routes/preferences.ts`
- `backend/src/schemas/preferences.ts`
- `backend/test/routes/preferences.test.ts`

**Definition of Done:** Preferences save and retrieve correctly. All validation rules enforced.

**Tests:** Unit tests: (1) save preferences, (2) retrieve preferences, (3) < 2 likes → 400, (4) overlapping likes/dislikes → 400, (5) invalid rating → 400, (6) non-member → 403.

---

### M4 — Suggestions

#### T14: TMDB API client with DynamoDB caching

**What:** Create a TMDB client service. Methods: `discoverMovies(params)`, `getMovieDetails(id)`, `getWatchProviders(id)`. All responses cached in TmdbCache table with appropriate TTLs (24h for discover/details, 12h for providers). TMDB API key read from SSM Parameter Store at cold start.

**Files created:**
- `backend/src/services/tmdb.ts`
- `backend/test/services/tmdb.test.ts`

**Definition of Done:** TMDB calls work with real API key (integration test). Cache hits return stored data. Cache misses fetch from TMDB and store.

**Tests:** Unit tests with mocked HTTP + DynamoDB: (1) cache miss → fetch + store, (2) cache hit → return stored, (3) API error handling. Manual integration test script (not in CI) for real TMDB calls.

---

#### T15: Recommendation algorithm (ADR-0003 pipeline)

**What:** Implement the 5-stage filter-and-rank pipeline:
1. Aggregate group preferences (union likes, unanimous dislikes, min rating)
2. Query TMDB Discover API
3. Local exclusions (watched picks, previous round movies)
4. Score: `0.5×popularity + 0.3×streaming + 0.2×genre_match`
5. Return top 5–8

Include constraint relaxation if < 5 results survive filtering.

**Files created:**
- `backend/src/services/recommendations.ts`
- `backend/test/services/recommendations.test.ts`

**Definition of Done:** Pipeline produces 5–8 ranked movies. Constraint relaxation kicks in when needed. `relaxed_constraints` array populated correctly.

**Tests:** Unit tests with mocked TMDB + DynamoDB: (1) happy path — 8 results, (2) some exclusions — still ≥ 5, (3) constraint relaxation triggered, (4) scoring order is correct (popularity + streaming + genre), (5) tie-breaking by vote_average.

---

#### T16: POST /groups/{group_id}/rounds + GET /rounds/{round_id}

**What:** Wire up the rounds endpoints. `POST` runs the recommendation pipeline and persists the round + suggestions. `GET` returns round with suggestions. Enforce: ≥ 2 members have preferences (422), no active round already exists (409).

**Files created:**
- `backend/src/routes/rounds.ts`
- `backend/src/schemas/rounds.ts`
- `backend/test/routes/rounds.test.ts`

**Definition of Done:** Creating a round triggers suggestions. Suggestions are persisted and retrievable. Guard rails work.

**Tests:** Unit tests: (1) happy path — round created with suggestions, (2) < 2 members with prefs → 422, (3) active round exists → 409, (4) GET returns round + suggestions, (5) non-member → 403.

---

### M5 — iOS Thin Slice

#### T17: iOS project skeleton

**What:** Create Xcode project with SwiftUI app. Set up project structure: Views/, Models/, Services/, Utilities/. Add a root navigation stack. Configure the bundle ID and entitlements for Sign in with Apple.

**Files created:**
- `ios/FamilyMovieNight.xcodeproj/` (Xcode project)
- `ios/FamilyMovieNight/App.swift`
- `ios/FamilyMovieNight/ContentView.swift`
- `ios/FamilyMovieNight/Services/APIClient.swift` (stub)
- `ios/FamilyMovieNight/Models/` (stub directory)

**Definition of Done:** App builds and launches in simulator. Shows a placeholder screen.

**Tests:** Project compiles with zero warnings.

---

#### T18: iOS auth — Sign in with Apple + Cognito

**What:** Implement Sign in with Apple flow using `ASAuthorizationAppleIDProvider`. Exchange Apple credential for Cognito tokens via AWS SDK. Store tokens in Keychain. Implement token refresh. Create `AuthManager` observable that exposes sign-in state.

**Files created:**
- `ios/FamilyMovieNight/Services/AuthManager.swift`
- `ios/FamilyMovieNight/Services/KeychainHelper.swift`
- `ios/FamilyMovieNight/Views/Auth/WelcomeView.swift`
- `ios/FamilyMovieNight/Views/Auth/EmailSignUpView.swift`

**Definition of Done:** User can sign in with Apple or email, token persisted, app navigates to group home on success.

**Tests:** Unit test: AuthManager state transitions (signedOut → signingIn → signedIn). KeychainHelper round-trip test.

---

#### T19: iOS API client

**What:** Build a typed API client using URLSession. Base URL configurable. Automatic Bearer token injection from AuthManager. JSON decoding into Codable models. Error handling (401 → trigger re-auth, 4xx/5xx → typed errors).

**Files created:**
- `ios/FamilyMovieNight/Services/APIClient.swift` (replace stub)
- `ios/FamilyMovieNight/Models/User.swift`
- `ios/FamilyMovieNight/Models/Group.swift`
- `ios/FamilyMovieNight/Models/Preferences.swift`
- `ios/FamilyMovieNight/Models/Round.swift`
- `ios/FamilyMovieNight/Models/Suggestion.swift`
- `ios/FamilyMovieNight/Models/Invite.swift`
- `ios/FamilyMovieNight/Models/APIError.swift`

**Definition of Done:** API client can make authenticated requests. Codable models match API response schemas.

**Tests:** Unit tests with URLProtocol mock: (1) successful request decodes, (2) 401 triggers re-auth, (3) 400 returns field errors.

---

#### T20: iOS — Create Group + Group Home

**What:** Create group screen (name input + create button). Group home screen showing members, preference status, and "Suggest Movies" CTA. Wire `POST /groups`, `GET /groups/{id}`, `GET /users/me`.

**Files created:**
- `ios/FamilyMovieNight/Views/Group/CreateGroupView.swift`
- `ios/FamilyMovieNight/Views/Group/GroupHomeView.swift`
- `ios/FamilyMovieNight/ViewModels/GroupViewModel.swift`

**Definition of Done:** User can create a group and land on group home. Group home shows member list.

**Tests:** ViewModel unit test: create group updates state correctly.

---

#### T21: iOS — Invite flow

**What:** Invite screen with "Share Invite Link" button that triggers iOS share sheet. Accept invite deep link handling (Universal Links). Wire `POST /groups/{id}/invites` and `POST /invites/{token}/accept`.

**Files created:**
- `ios/FamilyMovieNight/Views/Group/InviteView.swift`
- `ios/FamilyMovieNight/Utilities/DeepLinkHandler.swift`

**Definition of Done:** Creator can share an invite link. Tapping a link in another device joins the group.

**Tests:** Unit test: deep link URL parsing extracts token correctly.

---

#### T22: iOS — Preferences screen

**What:** Genre selection grid (like/dislike/neutral toggle chips). Content rating picker. Wire `PUT /groups/{id}/preferences` and `GET /groups/{id}/preferences`.

**Files created:**
- `ios/FamilyMovieNight/Views/Preferences/GenreSelectionView.swift`
- `ios/FamilyMovieNight/Views/Preferences/ContentRatingView.swift`
- `ios/FamilyMovieNight/ViewModels/PreferencesViewModel.swift`

**Definition of Done:** User can set genres and content rating. Preferences persist and reload on next visit.

**Tests:** ViewModel unit test: (1) toggling genres cycles through states, (2) min 2 likes enforced, (3) save triggers API call.

---

#### T23: iOS — Suggestions screen + Movie detail

**What:** Suggestion shortlist as a scrollable card list. Each card: poster (async image), title, year, genre tags, content rating, streaming badges. Tap → movie detail sheet. Wire `POST /groups/{id}/rounds` and `GET /rounds/{id}`.

**Files created:**
- `ios/FamilyMovieNight/Views/Suggestions/SuggestionListView.swift`
- `ios/FamilyMovieNight/Views/Suggestions/SuggestionCardView.swift`
- `ios/FamilyMovieNight/Views/Suggestions/MovieDetailView.swift`
- `ios/FamilyMovieNight/ViewModels/SuggestionsViewModel.swift`

**Definition of Done:** User taps "Suggest Movies" → sees loading → sees 5–8 movie cards. Tapping a card shows full details.

**Tests:** ViewModel unit test: (1) loading state transitions, (2) suggestions populate from API response, (3) error state on failure.

---

## Milestone Summary

| Milestone | Tasks | Estimated PRs |
|-----------|-------|---------------|
| M0 — Scaffold + CI | T01–T05 | 5 |
| M1 — Auth | T06–T08 | 3 |
| M2 — Groups + Invites | T09–T12 | 4 |
| M3 — Preferences | T13 | 1 |
| M4 — Suggestions | T14–T16 | 3 |
| M5 — iOS | T17–T23 | 7 |
| **Total** | **23 tasks** | **23 PRs** |

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Cognito Apple Sign-In federation is finicky to configure | Test with curl/Postman before touching iOS. Keep email/password as fallback. |
| TMDB API rate limits during development | Cache aggressively in TmdbCache table. Use saved fixture data in tests. |
| CDK learning curve slows infra PRs | Use `cdk diff` and snapshot tests to catch errors early. Keep stacks minimal. |
| iOS deep links require Apple Developer setup | Can test invite accept via API first; deep link wiring is a polish step. |
| DynamoDB transaction limits (T09 uses transact) | Group creation is 2 items — well within 100-item limit. |
