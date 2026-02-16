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

## Up Next

| Order | Task | Branch (proposed) | Summary | Status | Depends On |
|---|---|---|---|---|---|
| 1 | 04-A | `feat/task-04a-pref-summary` | `getGroupPreferences`, `getGroupPreferenceSummary`, `GET .../preferences/summary` route + tests | ready | — |
| 2 | 04-B | `feat/task-04b-picks-watched` | Pick model, pick-service, picks routes, IAM grant for picksTable, CDK + service + route tests | ready | — |
| 3 | 04-C | `feat/task-04c-pref-cleanup` | `deletePreference` + call from `leaveGroup` + tests | ready | — |
| 4 | 05 | `feat/task-05-suggestions` | TMDB integration, suggestion algorithm, voting flow, iOS suggestion + voting UI | blocked | 04-A, 04-B |
| 5 | 04-D | `feat/task-04d-genre-validation` | TMDB genre ID map + validation refinement in Zod schema | ready | — |

**Notes:**
- 04-A and 04-B can be built in parallel (no dependency between them)
- 04-C can be built in parallel with 04-A/04-B or after
- Task 05 starts once 04-A + 04-B are both merged
- 04-D is low priority and can slot in anywhere
