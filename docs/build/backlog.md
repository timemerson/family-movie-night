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
- [ ] (ready) **02-A: Handle Amplify config failure gracefully** — P1
- [ ] (ready) **02-B: Handle confirmSignUp success + signIn failure** — P1
- [ ] (ready) **02-C: Handle MFA / challenge flows** — P2
- [ ] (ready) **02-D: Atomic state update in fetchTokensAndUser** — P2
- [ ] (ready) **02-E: Environment-specific Amplify config** — P2

See [task-02-followups.md](task-02-followups.md) for full details on each follow-up.

---

### Task 03 — Create/join family group
- [x] (done) Create/join family group
  - Merged 2026-02-16 (PR #6). Delivered: group CRUD (`POST /groups`, `GET /groups/:id`, `PATCH /groups/:id`), membership management (`GET /groups/me`, `DELETE /groups/:id/members/me` with creator promotion), invite flow (`POST /groups/:id/invites`, `GET /groups/:id/invites`, `DELETE /groups/:id/invites/:invite_id`, `POST /invites/:token/accept`), multi-use invites with 7-day TTL, atomic DynamoDB transactions, group-service + invite-service, comprehensive route + service tests.

---

### Task 04 — Preferences + watched history (minimal)
- [x] (done — partial) Preferences CRUD + iOS UI
  - Merged 2026-02-16 (PR #8). Delivered: preference model (Zod), preference-service (get/put), preference routes (GET/PUT `/groups/:id/preferences`), IAM grant for preferencesTable, preference service + route tests, iOS preferences UI (PreferencesView, ViewModel, Model).
- [x] (done) **04-A: Group preference summary endpoint** — Merged (PR #9)
- [x] (done) **04-B: Pick model + watched history endpoints** — Merged (PR #10)
- [ ] (ready) **04-C: Preference cleanup on group leave** — P1
- [ ] (ready) **04-D: TMDB genre ID validation** — P2

See [task-04-followups.md](task-04-followups.md) for full details on each follow-up.

---

### Task 05 — Suggestions endpoint + UI
- [x] (done) Suggestions endpoint + iOS "Tonight's Suggestions" UI
  - Delivered: TMDB client with DynamoDB caching, five-stage filter-and-rank suggestion algorithm (ADR-0003), `GET /groups/:id/suggestions` endpoint with exclude_movie_ids support, "reason" fields explaining why each movie was suggested, constraint relaxation with banner, CDK IAM grants for tmdbCacheTable, TMDB_API_KEY via SSM Parameter Store, algorithm unit tests (10 cases), route auth/permission tests, iOS SuggestionsView with poster cards + "Show Me More" refresh, runbook with exact curl steps.
- [ ] (ready) **05-A: Cache null-handling bug in getContentRating** — P1
- [ ] (ready) **05-B: Validate TMDB API key at startup** — P1
- [ ] (ready) **05-C: Clean up empty with_genres param** — P2
- [ ] (ready) **05-D: Missing ADR-0003** — P2
- [ ] (ready) **05-E: Cap exclude_movie_ids growth in iOS** — P2
- [ ] (ready) **05-F: Wire up content_rating field** — P2

See [task-05-followups.md](task-05-followups.md) for full details on each follow-up.

---

### Slice A — Watchlists + Movie Details + Mark Watched

**Plan:** [plan-slice-a.md](plan-slice-a.md) | **Test matrix:** [../testing/test-matrix-slice-a.md](../testing/test-matrix-slice-a.md)

- [ ] (ready) **A1: Watchlist backend** — CDK table, model, service, routes, tests
  - User stories: US-26, US-27, US-28, US-34, US-40 (partial)
  - New files: `models/watchlist.ts`, `services/watchlist-service.ts`, `routes/watchlist.ts`
  - CDK: watchlistTable + IAM grant
  - 31 tests (see test matrix SA-001 through SA-031)

- [ ] (blocked on A1) **A2: Direct mark-watched + combined watched list** — CDK table, service, routes, tests
  - User stories: US-33, US-35, US-36, US-40 (complete)
  - New files: `models/watched-movie.ts`, `services/watched-service.ts`
  - CDK: watchedMoviesTable + IAM grant
  - Cross-list: auto-remove from watchlist when marking watched
  - Updates `suggestion-service.ts` to use combined watched IDs
  - 34 tests (see test matrix SA-032 through SA-065)

- [ ] (blocked on A1, A2) **A3: Movie detail endpoint with group context** — route, tests
  - User stories: US-12, US-32
  - New files: `routes/movies.ts`
  - CDK: IAM grants for roundsTable, suggestionsTable, votesTable
  - 15 tests (see test matrix SA-066 through SA-080)

- [ ] (blocked on A1, A2, A3) **A4: iOS Watchlist + Movie Detail + Mark Watched UI** — SwiftUI views
  - User stories: US-26, US-27, US-28, US-32, US-33, US-34
  - New files: WatchlistView, MovieDetailView, viewmodels, models
  - Updates: APIClient.swift, HomeView, SuggestionsView

---

### Slice B — Tonight Queue + Voting + Select Winner

**Plan:** [plan-slice-b.md](plan-slice-b.md) | **Test matrix:** [../testing/test-matrix-slice-b.md](../testing/test-matrix-slice-b.md)

**Depends on:** Slice A (watchlist integration at round start)

- [ ] (blocked on Slice A) **B1: Round service + create round endpoint** — model, service, routes, tests
  - User stories: US-11, US-13, US-31, US-41 (partial)
  - New files: `models/round.ts`, `services/round-service.ts`, `routes/rounds.ts`
  - CDK: IAM grants for roundsTable, suggestionsTable
  - Watchlist integration at round start
  - One-active-round constraint
  - 36 tests (see test matrix SB-001 through SB-036)

- [ ] (blocked on B1) **B2: Voting service + endpoints** — model, service, routes, tests
  - User stories: US-14, US-15, US-41
  - New files: `models/vote.ts`, `services/vote-service.ts`, `routes/votes.ts`
  - CDK: IAM grant for votesTable
  - Concurrent vote tests (simultaneous votes)
  - 36 tests (see test matrix SB-037 through SB-072)

- [ ] (blocked on B1, B2) **B3: Pick lock-in + round lifecycle** — service extension, routes, tests
  - User stories: US-16, US-18
  - `POST /rounds/:round_id/pick` with conditional write
  - Round status lifecycle (voting → closed → picked)
  - Concurrent double-tap tests
  - 24 tests (see test matrix SB-073 through SB-096)

- [ ] (blocked on B1, B2, B3) **B4: iOS voting flow UI** — SwiftUI views
  - User stories: US-14, US-15, US-16
  - New files: VotingView, ResultsView, PickConfirmationView, viewmodels
  - Updates: APIClient.swift, HomeView, SuggestionsView

---

## Follow-Up Backlog (Can Slot In Anytime)

| Task | Priority | Depends On | Status |
|---|---|---|---|
| 02-A: Amplify config failure | P1 | — | ready |
| 02-B: confirmSignUp + signIn failure | P1 | — | ready |
| 04-C: Preference cleanup on leave | P1 | — | ready |
| 05-A: Cache null-handling bug | P1 | — | ready |
| 05-B: Validate TMDB API key | P1 | — | ready |
| 02-C: MFA / challenge flows | P2 | — | ready |
| 02-D: Atomic state update | P2 | — | ready |
| 02-E: Env-specific Amplify config | P2 | — | ready |
| 04-D: TMDB genre ID validation | P2 | — | ready |
| 05-C: Empty with_genres param | P2 | — | ready |
| 05-D: Missing ADR-0003 | P2 | — | ready |
| 05-E: Cap exclude_movie_ids | P2 | — | ready |
| 05-F: Wire up content_rating | P2 | 05-A | ready |

---

## Dependency Graph

```
                    ┌──► A2 ──► A3 ──┐
Task 05 (done) ──► A1                ├──► A4 (iOS)
                    └────────────────┘
                                       │
                                       ▼
                    ┌──► B2 ──► B3 ──┐
                 B1                   ├──► B4 (iOS)
                    └────────────────┘

Follow-ups (04-C, 05-A/B, etc.) ──► independent, slot anytime
```
