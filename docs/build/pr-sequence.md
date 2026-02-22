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

## Slice A: Watchlists + Movie Details + Mark Watched — Done

Slice A was committed directly to main (no individual PRs per task).

| Order | Task | Summary | Status |
|---|---|---|---|
| 1 | **A1** | Watchlist DynamoDB table, model, service, routes, IAM grant, tests | **done** |
| 2 | **A2** | WatchedMovies table, direct mark-watched service, 24h undo, combined watched list, auto-remove from watchlist, suggestion exclusion, tests | **done** |
| 3 | **A3** | `GET /movies/:tmdb_movie_id?group_id=X` with TMDB metadata + group context, IAM grants, tests | **done** |
| 4 | **A4** | iOS: WatchlistView, MovieDetailView, mark-watched flow, "Save for Later" on suggestion cards | **done** |

## Slice B: Tonight Queue + Voting + Select Winner — Done

| PR | Branch | Task | Summary | Merged |
|---|---|---|---|---|
| #17 | `feat/slice-b-rounds-voting-pick` | B1–B3 | Round service, voting service, pick lock-in, round lifecycle | 2026-02-21 |
| #18 | `feat/slice-b-rounds-voting-pick` | B4 | iOS: StartRoundView, VotingView, ResultsView, PickConfirmationView | 2026-02-21 |

## Up Next — Slice C: Multi-User Household / Member Model Migration

**Plan:** [plan-slice-c-multi-user.md](plan-slice-c-multi-user.md)

**Depends on:** Slice B (round/voting infrastructure)

| Order | Task | Summary | Status | Depends On |
|---|---|---|---|---|
| 1 | **C0** | Baseline schema alignment — add member_type, attendees, normalizeStatus adapter | blocked | Slice B |
| 2 | **C1** | Ratings service — 3-point scale (Loved/Liked/Did Not Like), backend + iOS | blocked | C0 |
| 3 | **C2** | Attendee selection backend + anyone-can-start | blocked | C0 |
| 4 | **C3** | Managed member infrastructure — X-Acting-As-Member header, managed member CRUD | blocked | C2 |
| 5 | **C4** | Profile switching UI — ProfileSessionManager, ProfileSwitcherView | blocked | C3 |
| 6 | **C5** | Managed member creation UI — AddManagedMemberView, COPPA disclosure | blocked | C3, C4 |
| 7 | **C6** | Attendee selection UI — AttendeeSelectionView, min 2, default all checked | blocked | C2, C4, C5 |
| 8 | **C7** | Round lifecycle completion + session history + close-ratings | blocked | C1, C6 |

## Follow-Ups (Can Slot In Anytime)

| Order | Task | Branch (proposed) | Summary | Status | Depends On |
|---|---|---|---|---|---|
| — | 04-C | `feat/task-04c-pref-cleanup` | `deletePreference` + call from `leaveGroup` + tests | ready | — |
| — | 05-A+B | `fix/task-05-cleanup` | Cache null-handling + TMDB API key validation | ready | — |
| — | 05-C+D+E+F | `chore/task-05-polish` | Empty with_genres, ADR-0003, iOS cap, content_rating | ready | 05-A |

## Notes

- **Slices A and B are complete.** Slice C (multi-user household model) is the next body of work.
- C0 is the entry point — additive schema changes with no behavior change.
- C1 and C2 can proceed in parallel after C0.
- All backend PRs include CDK IAM grants and CDK assertion tests.
- Follow-up tasks (04-C, 05-*) can be done in parallel with any slice PR.
