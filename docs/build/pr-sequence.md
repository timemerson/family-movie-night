# PR Sequence

Tracks the ordered sequence of PRs for the v1 vertical slice.

## Merged

| PR | Branch | Task | Summary | Merged |
|---|---|---|---|---|
| #1 | `chore/ci-smoke` | 01 | CI workflow + Makefile scaffold | 2026-02-15 |
| #2 | `chore/trigger-ci` | 01 | CI trigger fix | 2026-02-15 |
| #5 | `feat/task-02-auth` | 02 | iOS scaffold, Cognito + JWT auth, `/auth/me` JIT provisioning | 2026-02-15 |
| #6 | `feat/task-03-group` | 03 | Group CRUD, invite flow, membership management, atomic transactions | 2026-02-16 |
| #8 | `feat/task-04-preferences` | 04 | Preference model/service/routes, IAM grant, iOS preferences UI | 2026-02-16 |
| #9 | `feat/task-04a-pref-summary` | 04-A | `getGroupPreferenceSummary`, summary route + tests | 2026-02-16 |
| #10 | `feat/task-04b-picks-watched` | 04-B | Pick model, pick-service, picks routes, IAM grant, tests | 2026-02-16 |
| #11 | `feat/task-05-suggestions` | 05 | TMDB client, suggestion algorithm, iOS suggestions UI | 2026-02-17 |

## Up Next — Slice A: Watchlists + Movie Details + Mark Watched

| Order | Task | Branch (proposed) | Summary | Status | Depends On |
|---|---|---|---|---|---|
| 1 | **A1** | `feat/slice-a1-watchlist` | Watchlist DynamoDB table, model, service (add/remove/list), routes (`POST/GET/DELETE /groups/:id/watchlist`), IAM grant, 31 tests | **ready** | — |
| 2 | **A2** | `feat/slice-a2-watched-movies` | WatchedMovies DynamoDB table, direct mark-watched service, 24h undo, combined watched list (picks + direct), auto-remove from watchlist, update suggestion exclusion, 34 tests | ready | A1 |
| 3 | **A3** | `feat/slice-a3-movie-detail` | `GET /movies/:tmdb_movie_id?group_id=X` with TMDB metadata + group context (watchlist/watched/vote history/active round), IAM grants for rounds/suggestions/votes tables, 15 tests | ready | A1, A2 |
| 4 | **A4** | `feat/slice-a4-ios-watchlist` | iOS: WatchlistView, MovieDetailView with group context, mark-watched flow, "Save for Later" on suggestion cards | ready | A1, A2, A3 |

## Then — Slice B: Tonight Queue + Voting + Select Winner

| Order | Task | Branch (proposed) | Summary | Status | Depends On |
|---|---|---|---|---|---|
| 5 | **B1** | `feat/slice-b1-rounds` | Round model, round-service (create/get/close), persist suggestions, one-active-round constraint, watchlist integration at round start, routes (`POST /groups/:id/rounds`, `GET/PATCH /rounds/:id`), IAM grants for rounds + suggestions tables, 36 tests | blocked | Slice A |
| 6 | **B2** | `feat/slice-b2-voting` | Vote model, vote-service (submit/change/results), ranking by net score + tie-breaking, routes (`POST /rounds/:id/votes`, `GET /rounds/:id/results`), IAM grant for votes table, concurrency tests, 36 tests | blocked | B1 |
| 7 | **B3** | `feat/slice-b3-pick` | `POST /rounds/:id/pick` with conditional write (exactly-one per round), round lifecycle (voting→closed→picked), double-tap concurrency test, 24 tests | blocked | B1, B2 |
| 8 | **B4** | `feat/slice-b4-ios-voting` | iOS: StartRoundView, VotingView, ResultsView, PickConfirmationView, "Pick Tonight's Movie" from Home | blocked | B1, B2, B3 |

## Follow-Ups (Can Slot In Anytime)

| Order | Task | Branch (proposed) | Summary | Status | Depends On |
|---|---|---|---|---|---|
| — | 04-C | `feat/task-04c-pref-cleanup` | `deletePreference` + call from `leaveGroup` + tests | ready | — |
| — | 05-A+B | `fix/task-05-cleanup` | Cache null-handling + TMDB API key validation | ready | — |
| — | 05-C+D+E+F | `chore/task-05-polish` | Empty with_genres, ADR-0003, iOS cap, content_rating | ready | 05-A |

## Notes

- **A1 is the next PR to build.** It is the only ready task with no blockers.
- A1 and A2 must be sequential (A2 depends on WatchlistService for auto-remove).
- B1 can technically start in parallel with A3/A4 by stubbing watchlist integration, but it's cleaner to wait for Slice A to complete.
- All backend PRs include CDK IAM grants and CDK assertion tests.
- iOS PRs (A4, B4) depend on all their respective backend PRs.
- Follow-up tasks (04-C, 05-*) can be done in parallel with any slice PR. Consider batching P1 items (05-A, 05-B) into a single cleanup PR before starting Slice A.
