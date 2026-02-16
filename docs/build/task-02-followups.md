# Task 02 Follow-ups (iOS Auth)

Items identified during PR #13 code review. None are blockers.

---

### Follow-up 02-A: Handle Amplify configuration failure gracefully (P1)

**Problem:** In `FamilyMovieNightApp.swift`, if `Amplify.configure()` throws, the error is printed to console but the app continues. Every subsequent auth call fails with confusing errors.

**Fix:** Store the error in a published property so the UI can show a meaningful message, or use `fatalError()` in debug builds to catch misconfigurations during development.

**File:** `ios/FamilyMovieNight/FamilyMovieNightApp.swift` (init)

---

### Follow-up 02-B: Handle confirmSignUp success + signIn failure (P1)

**Problem:** In `AuthViewModel.confirmSignUp()`, if `confirmSignUp` succeeds but the auto-`signIn` call fails (network error, account locked), the user is stuck on the verification screen. Re-submitting the code will also fail since confirmation already succeeded.

**Fix:** If `confirmSignUp` succeeds but `signIn` throws, transition view state back to `.signIn` so the user can retry sign-in manually.

**File:** `ios/FamilyMovieNight/Features/Auth/AuthViewModel.swift` (confirmSignUp method)

---

### Follow-up 02-C: Handle MFA / new-password-required challenges (P2)

**Problem:** `AuthService.signIn()` throws `AuthError.signInIncomplete` if `result.isSignedIn` is false. If Cognito is configured with MFA or force-change-password, the `result.nextStep` field indicates what's needed, but this is ignored.

**Fix:** Inspect `result.nextStep` and either surface the required action to the UI or add a comment documenting the assumption that MFA is not enabled in v1.

**File:** `ios/FamilyMovieNight/Services/AuthService.swift` (signIn method)

---

### Follow-up 02-D: Atomic state update in fetchTokensAndUser (P2)

**Problem:** If `fetchAuthSession()` succeeds but `getCurrentUser()` throws, `accessToken` is set but `userId` and `isAuthenticated` are not, leaving the service in a partial state.

**Fix:** Collect values into locals first, then set all three published properties at the end after both calls succeed. Reset all on failure.

**File:** `ios/FamilyMovieNight/Services/AuthService.swift` (fetchTokensAndUser method)

---

### Follow-up 02-E: Environment-specific Amplify config (P2)

**Problem:** `amplifyconfiguration.json` contains hardcoded Cognito Pool/Client IDs for a single environment. Multiple environments (dev/staging/prod) will need separate config files.

**Fix:** Use build configurations or scheme-based config selection to load the appropriate `amplifyconfiguration.json` per environment.

**File:** `ios/FamilyMovieNight/amplifyconfiguration.json`

---

## Summary

| Follow-up | Priority | Description |
|---|---|---|
| 02-A: Amplify config failure | P1 | Silent failure on misconfiguration |
| 02-B: confirmSignUp + signIn failure | P1 | User stuck on verification screen |
| 02-C: MFA / challenge handling | P2 | signIn doesn't handle non-password challenges |
| 02-D: Atomic state update | P2 | Partial state on fetchTokensAndUser failure |
| 02-E: Environment-specific config | P2 | Hardcoded Pool IDs for single environment |

**Estimated PRs:** 1
