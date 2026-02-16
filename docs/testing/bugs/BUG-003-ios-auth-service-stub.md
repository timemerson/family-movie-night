# BUG-003: iOS AuthService methods are stubs (all TODO)

**Severity:** Known limitation (not a blocker for backend auth PR)
**Component:** ios/FamilyMovieNight/Services/AuthService.swift
**Status:** Open / Expected for this milestone
**Found by:** Tester — PR review for feat/task-02-auth

## Description

All methods in `AuthService.swift` are empty stubs with TODO comments:
- `signIn()` — no-op
- `signUp()` — no-op
- `confirmSignUp()` — no-op
- `signInWithApple()` — no-op
- `refreshTokenIfNeeded()` — no-op
- `signOut()` — clears local state only

The iOS app cannot actually authenticate against Cognito yet. The `amplifyconfiguration.json` has placeholder values (`TODO_REPLACE_WITH_*`).

## Impact

End-to-end auth flow cannot be tested on-device until these stubs are implemented. The iOS ViewModel validation tests (16 tests in `AuthViewModelTests.swift`) pass because they test only local input validation, not actual auth calls.

## Recommendation

Track this as a follow-up task. The backend auth is the deliverable for this milestone; iOS integration is expected to follow.
