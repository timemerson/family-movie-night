# Test Report — Task 04: Preferences + Watched History (minimal)

**PR:** #7 (feat/task-04-preferences-watched)
**Date:** 2026-02-16
**Tester:** Claude (automated)
**Verdict:** PASS

---

## Test Suite Results

| Suite | Tests | Status |
|-------|-------|--------|
| test/routes/preferences.test.ts | 15 | PASS |
| test/services/preference-service.test.ts | 4 | PASS (new) |
| test/integration/app.test.ts | 15 | PASS (+2 new) |
| test/routes/groups.test.ts | 26 | PASS |
| test/services/group-service.test.ts | 18 | PASS |
| test/services/user-service.test.ts | 5 | PASS |
| test/services/invite-service.test.ts | 10 | PASS |
| test/routes/users.test.ts | 3 | PASS |
| test/middleware/auth.test.ts | 4 | PASS |
| test/lib/errors.test.ts | 4 | PASS |
| test/cdk/api-stack.test.ts | 6 | PASS |
| test/cdk/data-stack-gsis.test.ts | 5 | PASS |
| test/cdk/data-stack-prod.test.ts | 2 | PASS |
| test/cdk/auth-stack.test.ts | 5 | PASS |
| test/cdk/all-stacks-synth.test.ts | 1 | PASS |
| **Total** | **123** | **All pass** |

---

## Acceptance Criteria Validation

### US-08: Set genre likes and dislikes (P0)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Full TMDB genre list presented | PASS | `Preference.swift:TMDBGenre.all` has 18 genres matching TMDB movie genre IDs |
| Each genre can be Like, Dislike, or Neutral | PASS | `PreferencesView.swift:GenreRow` with thumbs-up/down buttons; toggle logic in ViewModel |
| Changes save ~~automatically~~ via Save button | PASS (deviation) | Manual save; auto-save deferred per design review |
| Backend validates >= 2 genre_likes | PASS | Zod `.min(2)` + tests for 0, 1 entries |
| Backend validates no overlap | PASS | Zod `.refine()` + overlap test |
| Backend deduplicates genre arrays | PASS | `.transform([...new Set()])` + 2 dedup tests |

### US-09: Set content-rating ceiling (P0)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Options: G, PG, PG-13, R | PASS | `ContentRating` enum in Swift + Zod `.enum()` in backend |
| Default: PG-13 | PASS | `PreferencesViewModel.maxContentRating = .pg13` |
| All four ratings accepted | PASS | Parametric test iterates all four |
| Invalid ratings rejected | PASS | "NC-17" test → 400 |

### Authorization (group-scoped)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| JWT required | PASS | Integration tests: GET/PUT → 401 without auth |
| Member-only access | PASS | Route tests: non-member → 403 for both GET and PUT |
| Both member and creator can set | PASS | Explicit test for creator role |
| Auth checked before validation (PUT) | PASS | `requireMember()` runs before `req.json()` parsing |

### Infrastructure

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Preferences table IAM grant | PASS | `api-stack.ts:52` grants readWriteData |
| CDK synth succeeds | PASS | `all-stacks-synth.test.ts` passes |
| No secrets in diff | PASS | Grep scan: only placeholder `<token>` in runbook |

### iOS

| Criterion | Status | Evidence |
|-----------|--------|----------|
| APIClient encodes snake_case | PASS | `.convertToSnakeCase` on encoder (BUG-005 fixed) |
| APIClient decodes snake_case | PASS | `.convertFromSnakeCase` on decoder (pre-existing) |
| Navigation wired from GroupDetailView | PASS | NavigationLink + `.onAppear` configures VM |
| No dead code | PASS | `hasOverlap` removed (NIT-001 fixed) |

---

## Tests Added by Tester

1. `test/services/preference-service.test.ts` — 4 unit tests for `getPreferences` and `putPreferences` service methods
2. `test/integration/app.test.ts` — 2 tests: GET/PUT preferences return 401 without auth

---

## Bugs Found

| Bug | Severity | Status |
|-----|----------|--------|
| BUG-005: APIClient camelCase encoder | Blocking | **Fixed** in commit 2 |
| BUG-006: Duplicate genre bypass | Blocking | **Fixed** in commit 2 |

No new open bugs.

---

## Regression Check

- All 102 pre-existing tests continue to pass
- No changes to existing route/service behavior
- `GroupViewModel.apiClient` visibility widened from `private` to `private(set)` — safe, read-only external access

---

## Notes

- TypeScript `tsc --noEmit` reports errors — these are **pre-existing** on `main` (Hono context type issues, test mock typing). Not a regression.
- TMDB genre list omits "TV Movie" (10770) — intentional, not useful for family movie night filtering.
- Two known design deviations (manual save, separate like/dislike buttons vs 3-state cycle) were reviewed and deferred.

---

## Verdict

**PASS — recommend merge.**
