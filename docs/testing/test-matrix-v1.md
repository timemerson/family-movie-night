# Test Matrix — V1 Vertical Slice

## Testing Strategy

| Layer | Tool | Runs in CI | Purpose |
|-------|------|-----------|---------|
| **Unit tests** (backend) | Vitest + aws-sdk-client-mock | Yes | Route handlers, services, middleware in isolation |
| **CDK snapshot tests** | Jest (CDK built-in) | Yes | Catch unintended infra changes |
| **Unit tests** (iOS) | XCTest | Yes (if Mac runner) | ViewModels, services, models |
| **Integration tests** (backend) | Vitest + real DynamoDB Local | Yes | Multi-table operations, transactions |
| **Manual smoke tests** | curl / Postman | No | End-to-end against deployed dev stack |
| **Manual iOS tests** | Simulator | No | Full user flows on-device |

---

## Top Risks & Test Focus

| # | Risk | Likelihood | Impact | Test Coverage |
|---|------|-----------|--------|--------------|
| R1 | JIT provisioning creates duplicate users on concurrent first requests | Medium | High — data corruption | Unit test: concurrent calls return same user. Integration test: DynamoDB conditional put prevents duplicates. |
| R2 | Invite accept race condition — two users accept the last slot simultaneously | Medium | Medium — group exceeds 8-member cap | Unit test: accept checks member count. Integration test: conditional write on GroupMemberships with count check. |
| R3 | Preference aggregation produces empty genre set (all genres disliked by someone) | Low | High — no suggestions possible | Unit test: unanimous-dislike rule only excludes if ALL members dislike. Edge case: 1 member with all-dislike still leaves other members' likes. |
| R4 | TMDB API returns fewer than 5 results after filtering | Medium | Medium — poor UX | Unit test: constraint relaxation triggers at < 5 results. Each relaxation stage tested independently. |
| R5 | Scoring formula produces ties, breaking determinism | Low | Low — non-deterministic ordering | Unit test: tie-breaking by vote_average then tmdb_movie_id produces stable sort. |
| R6 | JWT authorizer misconfigured — accepts expired or wrong-issuer tokens | Low | Critical — security hole | CDK assertion test: authorizer references correct User Pool. Manual smoke test: expired token → 401. |
| R7 | DynamoDB table/GSI names drift between CDK and Lambda env vars | Medium | High — 500 errors at runtime | CDK assertion test: Lambda env vars match table names. Integration test: helpers resolve all tables. |
| R8 | TMDB cache returns stale data indefinitely (TTL not working) | Low | Medium — outdated suggestions | Unit test: cache entry created with correct TTL. Manual verification: DynamoDB TTL enabled on TmdbCache table. |
| R9 | iOS Keychain token storage fails silently — user stuck in sign-out loop | Medium | High — app unusable | Unit test: KeychainHelper save/load/delete round-trip. Edge case: Keychain unavailable → graceful error. |
| R10 | Group-member middleware has false positives (non-member passes) | Low | Critical — data leakage | Unit test: non-member blocked for every guarded route. Test with valid JWT but wrong group. |

---

## Test Coverage Per Task

### M0 — Scaffold + CI

| Task | Test Type | What's Tested | Min Tests |
|------|-----------|---------------|-----------|
| T01 | Unit | GET /health → 200 | 1 |
| T02 | Snapshot | DataStack CloudFormation matches snapshot | 1 |
| T03 | Snapshot | AuthStack CloudFormation matches snapshot | 1 |
| T04 | Snapshot + Assertion | ApiStack snapshot; Lambda env vars include all table names; JWT authorizer configured | 3 |
| T05 | — | CI pipeline is itself the test | 0 |

### M1 — Auth

| Task | Test Type | What's Tested | Min Tests | Risks Covered |
|------|-----------|---------------|-----------|---------------|
| T06 | Unit | DynamoDB helpers: getItem, putItem, query, update; error handling; table name resolution | 5 | R7 |
| T07 | Unit | JIT provisioning: new user created, existing user returned, missing auth → 401, concurrent-safe conditional write | 4 | R1, R6 |
| T08 | Unit | PATCH /users/me: update display_name, invalid avatar → 400, partial update | 3 | — |

### M2 — Groups + Invites

| Task | Test Type | What's Tested | Min Tests | Risks Covered |
|------|-----------|---------------|-----------|---------------|
| T09 | Unit | Create group: happy path (group + membership created), missing name → 400, name too long → 400 | 3 | — |
| T10 | Unit | GET group: member allowed, non-member → 403, not found → 404; middleware isolation tests | 4 | R10 |
| T11 | Unit | PATCH group: creator allowed, member → 403, streaming services update | 3 | R10 |
| T12 | Unit | Invite lifecycle: create, accept (user added), expired → 410, revoked → 410, group full → 409, list pending, non-creator → 403 | 7 | R2 |

### M3 — Preferences

| Task | Test Type | What's Tested | Min Tests | Risks Covered |
|------|-----------|---------------|-----------|---------------|
| T13 | Unit | Save prefs, retrieve prefs, < 2 likes → 400, overlapping likes/dislikes → 400, invalid rating → 400, non-member → 403 | 6 | R3 (indirectly — validates input quality) |

### M4 — Suggestions

| Task | Test Type | What's Tested | Min Tests | Risks Covered |
|------|-----------|---------------|-----------|---------------|
| T14 | Unit | Cache miss → fetch + store, cache hit → return stored, TMDB error → graceful failure, TTL values correct | 4 | R8 |
| T15 | Unit | Happy path (8 results), exclusions applied, constraint relaxation at < 5, scoring order correct, tie-breaking deterministic, empty genre edge case | 6 | R3, R4, R5 |
| T16 | Unit | Round created with suggestions, < 2 prefs → 422, active round → 409, GET returns round, non-member → 403 | 5 | R10 |

### M5 — iOS

| Task | Test Type | What's Tested | Min Tests | Risks Covered |
|------|-----------|---------------|-----------|---------------|
| T17 | Build | Project compiles with zero warnings | 1 | — |
| T18 | Unit | AuthManager state transitions (signedOut → signingIn → signedIn → signedOut), KeychainHelper round-trip, Keychain unavailable → error | 3 | R9 |
| T19 | Unit | Successful request decodes, 401 triggers re-auth, 400 returns field errors | 3 | — |
| T20 | Unit | GroupViewModel: create group updates state, fetch group populates members | 2 | — |
| T21 | Unit | Deep link URL parsing extracts invite token correctly, malformed URL → nil | 2 | — |
| T22 | Unit | Genre toggle cycles states, min 2 likes enforced, save triggers API | 3 | — |
| T23 | Unit | Loading state transitions, suggestions populate from response, error state on failure | 3 | — |

---

## Test Summary

| Category | Tests |
|----------|-------|
| Backend unit tests | 50+ |
| CDK snapshot/assertion tests | 6 |
| iOS unit tests | 17+ |
| **Total automated** | **73+** |
| Manual smoke tests | ~10 curl scenarios per milestone |

---

## Manual Smoke Test Checklist (per milestone deploy)

### After M1 deploy
- [ ] Get Cognito token via email/password (AWS CLI or Postman)
- [ ] `GET /users/me` → 200, user created
- [ ] `GET /users/me` again → same user returned (no duplicate)
- [ ] Request with expired/invalid token → 401
- [ ] `PATCH /users/me` → display name updated

### After M2 deploy
- [ ] `POST /groups` → group created, creator is member
- [ ] `GET /groups/{id}` as creator → 200
- [ ] `GET /groups/{id}` as non-member → 403
- [ ] `POST /groups/{id}/invites` → invite generated with token
- [ ] `POST /invites/{token}/accept` as second user → joined group
- [ ] Accept same invite again → appropriate error
- [ ] `PATCH /groups/{id}` as member (not creator) → 403

### After M3 deploy
- [ ] `PUT /groups/{id}/preferences` → preferences saved
- [ ] `GET /groups/{id}/preferences` → preferences returned
- [ ] PUT with < 2 genre_likes → 400
- [ ] PUT with overlapping likes/dislikes → 400

### After M4 deploy
- [ ] Set preferences for 2 users in same group
- [ ] `POST /groups/{id}/rounds` → 5–8 suggestions returned
- [ ] Verify suggestions respect content rating ceiling
- [ ] `POST /groups/{id}/rounds` again → 409 (active round exists)
- [ ] `GET /rounds/{id}` → round with suggestions
- [ ] With only 1 user having prefs → 422

### After M5 (iOS)
- [ ] Fresh install → Welcome screen
- [ ] Sign in with Apple → lands on create group
- [ ] Create group → group home with 1 member
- [ ] Share invite link → share sheet opens
- [ ] Set preferences → genres + rating saved
- [ ] Tap "Suggest Movies" → loading → movie cards appear
- [ ] Tap movie card → detail sheet with poster, synopsis, streaming

---

## Testing Conventions

**File naming:**
- Backend: `backend/test/<path>/<module>.test.ts` mirroring `backend/src/<path>/<module>.ts`
- iOS: `ios/FamilyMovieNightTests/<Module>Tests.swift`

**Mocking:**
- DynamoDB: `aws-sdk-client-mock` — mock at the SDK command level
- TMDB HTTP: `msw` (Mock Service Worker) or manual fetch mock
- iOS network: `URLProtocol` subclass for request interception

**Test data:**
- Use factory functions (e.g., `makeUser()`, `makeGroup()`) to generate test fixtures
- TMDB response fixtures saved as JSON in `backend/test/fixtures/`
- Keep fixtures minimal — only the fields the code actually reads
