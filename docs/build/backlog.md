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

- [x] (done) **A1: Watchlist backend** — CDK table, model, service, routes, tests
- [x] (done) **A2: Direct mark-watched + combined watched list** — CDK table, service, routes, tests
- [x] (done) **A3: Movie detail endpoint with group context** — route, tests
- [x] (done) **A4: iOS Watchlist + Movie Detail + Mark Watched UI** — SwiftUI views

---

### Slice B — Tonight Queue + Voting + Select Winner

**Plan:** [plan-slice-b.md](plan-slice-b.md) | **Test matrix:** [../testing/test-matrix-slice-b.md](../testing/test-matrix-slice-b.md)

**Depends on:** Slice A (watchlist integration at round start)

- [x] (done — PR #17) **B1: Round service + create round endpoint** — model, service, routes, tests
- [x] (done — PR #17) **B2: Voting service + endpoints** — model, service, routes, tests
- [x] (done — PR #17) **B3: Pick lock-in + round lifecycle** — service extension, routes, tests
- [x] (done — PR #18) **B4: iOS voting flow UI** — SwiftUI views

---

### Slice C — Multi-User Household / Member Model Migration

**Plan:** [plan-slice-c-multi-user.md](plan-slice-c-multi-user.md)

**Depends on:** Slice B (round/voting infrastructure)

- [ ] (blocked on Slice B) **C0: Baseline schema alignment** — add member_type, attendees, normalizeStatus adapter
  - Backend: `models/user.ts`, `models/group.ts`, `models/round.ts`, `services/round-service.ts`
  - iOS: `Models/Group.swift`, `Models/Round.swift`, `Models/Rating.swift` (new)
  - All additive optional fields; no behavior change

- [ ] (blocked on C0) **C1: Ratings service** — backend + iOS, entirely additive
  - Backend: `models/rating.ts` (new), `services/rating-service.ts` (new), `routes/ratings.ts` (new)
  - iOS: `RatingView.swift` (new), `RatingViewModel.swift` (new)
  - CDK: grant `ratingsTable` access (table already exists)
  - 3-point scale: Loved / Liked / Did Not Like

- [ ] (blocked on C0) **C2: Attendee selection backend + anyone-can-start** — model extension, service changes
  - Backend: `CreateRoundSchema` gains optional `attendees: string[]`
  - `VoteService.getVoteProgress` uses attendees as denominator
  - `SuggestionService` scopes preferences to attendees
  - Remove `requireCreator` check on round creation
  - iOS: `Models/Round.swift` gains `attendees` field

- [ ] (blocked on C2) **C3: Managed member infrastructure** — backend, largest slice
  - Backend: `X-Acting-As-Member` header support in auth middleware
  - `POST /groups/:id/members/managed` — create managed member (synthetic `managed_<uuid>` user_id)
  - Vote/preference attribution uses `actingMemberId ?? userId`
  - COPPA disclosure in API response

- [ ] (blocked on C3) **C4: Profile switching UI** — iOS
  - `ProfileSessionManager` (new) — holds active profile, switching logic
  - `ProfileSwitcherView` (new) — sheet from top-right avatar
  - `APIClient` — attach `X-Acting-As-Member` header when acting as managed member
  - "Voting as [name]" caption in VotingView

- [ ] (blocked on C3, C4) **C5: Managed member creation UI** — iOS
  - `AddManagedMemberView` + `AddManagedMemberViewModel` (new)
  - COPPA disclosure text; content rating ceiling forced PG
  - Accessible from GroupDetailView "Add Family Member"

- [ ] (blocked on C2, C4, C5) **C6: Attendee selection UI** — iOS
  - `AttendeeSelectionView` (new) — checkmark picker before round start
  - Min 2 attendees; default all checked
  - "Start Voting Round" visible to all members (not just creator)

- [ ] (blocked on C1, C6) **C7: Round lifecycle completion + session history** — backend + iOS
  - Backend: `transitionToWatched`, auto-transition to `rated`, `GET /groups/:id/sessions`
  - iOS: `SessionHistoryView` + `SessionHistoryViewModel` (new)
  - `discarded` displayed as "Expired"; `expired` automation deferred post-v1

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
                           │
                           ▼
                          C0
                         / \
                       C1   C2
                       |     |
                       |    C3
                       |   / \
                       | C4   |
                       | | \  |
                       | C5 \ |
                       |  \  \|
                       |   C6
                        \ /
                         C7

Follow-ups (04-C, 05-A/B, etc.) ──► independent, slot anytime
```
