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
  - Merged 2026-02-15. Delivered: 5 CDK stacks (Data, Auth, Api, Notifications, Monitoring), DynamoDB tables with GSIs, Hono Lambda skeleton (`/health`), error class hierarchy, CDK snapshot + assertion tests, CI workflow.

---

### Task 02 — iOS app skeleton + auth wiring
- [ ] (ready) iOS app skeleton + auth wiring
  - See detailed checklist below.

---

### Task 03 — Create/join family group
- [ ] (ready) Create/join family group

### Task 04 — Preferences + watched history (minimal)
- [ ] (ready) Preferences + watched history (minimal)

### Task 05 — Suggestions endpoint + UI
- [ ] (ready) Suggestions endpoint + UI

---

## Task 02 — Detailed Breakdown

### Scope
Covers US-01 (Sign in with Apple) and US-02 (Email/password sign-up) end-to-end, plus the iOS project scaffold. By the end, a user can sign up, sign in, and hit an authenticated `/me` endpoint that returns their profile via JIT provisioning.

### Dependencies & Decisions

| # | Decision needed | Proposed default | Status |
|---|---|---|---|
| D1 | iOS minimum deployment target | iOS 17.0 (covers ~95% of active devices; enables modern SwiftUI APIs) | **Propose** |
| D2 | iOS architecture pattern | MVVM with SwiftUI + async/await; no third-party reactive framework | **Propose** |
| D3 | Networking layer | URLSession with async/await; thin `APIClient` wrapper; no Alamofire | **Propose** |
| D4 | Auth SDK | AWS Amplify Auth v6 (Swift) — thin wrapper over Cognito; handles token refresh, Keychain storage, Apple Sign-In federation | **Propose** |
| D5 | Keychain storage | Amplify handles token persistence in Keychain automatically; no manual Keychain code needed | **Propose** |
| D6 | Apple Developer account | Required for Sign in with Apple capability + Service ID for Cognito federation. Must be configured before E2E auth works. | **Prerequisite** |

### Checklist

#### A. iOS project scaffold
- [ ] A1. Create Xcode project (`ios/FamilyMovieNight/`) — SwiftUI App lifecycle, iOS 17+
- [ ] A2. Add `amplifyconfiguration.json` placeholder with Cognito User Pool ID, App Client ID, region
- [ ] A3. Set up project structure: `App/`, `Features/Auth/`, `Features/Home/`, `Services/`, `Models/`
- [ ] A4. Add Amplify Auth package dependency (Swift Package Manager)
- [ ] A5. Configure Amplify in `@main App.init()` — call `Amplify.configure()`

#### B. CDK — Cognito User Pool (Auth stack)
- [ ] B1. Add Cognito User Pool to `auth-stack` with: email as sign-in alias, password policy (8+ chars, 1 number), auto-verify email
- [ ] B2. Add User Pool App Client (no secret — public client for mobile)
- [ ] B3. Add Apple Sign-In as federated identity provider (Service ID + Team ID + Key ID as CDK context/env vars — not hardcoded)
- [ ] B4. Export User Pool ID, App Client ID, and region as CDK outputs (consumed by iOS `amplifyconfiguration.json` and API stack)
- [ ] B5. CDK test: assert User Pool, App Client, and Apple IdP exist in synth output

#### C. CDK — API Gateway JWT Authorizer (Api stack)
- [ ] C1. Add HTTP API (API Gateway v2) to `api-stack`
- [ ] C2. Add JWT Authorizer referencing Cognito User Pool issuer URL and audience (App Client ID)
- [ ] C3. Wire Lambda integration to HTTP API with default JWT auth on all routes except `/health`
- [ ] C4. Export API endpoint URL as CDK output
- [ ] C5. CDK test: assert HTTP API, JWT Authorizer, and Lambda integration exist

#### D. Backend — Auth routes + JIT provisioning
- [ ] D1. Add `POST /auth/me` route (Hono) — reads `sub` from API Gateway JWT context, creates User in DynamoDB if not exists, returns user profile
- [ ] D2. Add `src/services/user-service.ts` — `getOrCreateUser(sub, email, displayName)` with DynamoDB `PutItem` (conditional on `attribute_not_exists`)
- [ ] D3. Add `src/middleware/auth.ts` — extracts `sub` and `email` from API Gateway request context (JWT already validated by API Gateway; this just maps claims to Hono context)
- [ ] D4. Add `DELETE /auth/account` route — deletes User record from DynamoDB (Cognito user deletion is a separate admin action, logged for now)
- [ ] D5. Unit tests for user-service (mock DynamoDB client)
- [ ] D6. Integration-style test: Hono `app.request()` to `/auth/me` with mocked JWT context

#### E. iOS — Sign in with Apple flow
- [ ] E1. Add "Sign in with Apple" capability to Xcode project
- [ ] E2. Create `AuthViewModel` — manages auth state (signed out / signing in / signed in / error)
- [ ] E3. Implement `ASAuthorizationAppleIDProvider` flow → pass authorization code to Amplify `signInWithWebUI(for: .apple)`
- [ ] E4. Create `SignInView` — "Continue with Apple" button + "Sign up with email" link
- [ ] E5. On successful auth, call `GET /auth/me` to trigger JIT provisioning and cache user profile locally

#### F. iOS — Email/password sign-up flow
- [ ] F1. Create `EmailSignUpView` — email + password + confirm password fields, validation (8+ chars, 1 number)
- [ ] F2. Wire to Amplify `signUp(username:password:)` → email verification step
- [ ] F3. Create `VerifyEmailView` — 6-digit code input, resend button
- [ ] F4. Wire to Amplify `confirmSignUp(for:confirmationCode:)` → auto sign-in on success
- [ ] F5. Create `EmailSignInView` — email + password, "Forgot password?" link (P2, placeholder for now)

#### G. iOS — Auth state management & navigation
- [ ] G1. Create `AuthService` (singleton / environment object) — wraps Amplify auth state listener, publishes `isSignedIn`
- [ ] G2. Root `ContentView` switches between `SignInView` and `HomeView` based on auth state
- [ ] G3. `HomeView` — placeholder screen showing user's display name + sign-out button
- [ ] G4. Sign-out calls `Amplify.Auth.signOut()`, clears local state, returns to `SignInView`

#### H. CI / quality
- [ ] H1. Add `xcodebuild build` step to GitHub Actions CI (build-only, no sim tests yet)
- [ ] H2. Ensure `cdk synth` still passes with new Auth/Api stack resources
- [ ] H3. `vitest` passes for new backend tests

### Definition of Done
- [ ] User can sign up with Apple ID and see the Home screen (E2E with deployed backend)
- [ ] User can sign up with email, verify, and see the Home screen
- [ ] `/auth/me` returns a User record from DynamoDB with JIT-provisioned defaults
- [ ] Tokens stored in Keychain (via Amplify), not UserDefaults
- [ ] CDK synth produces Auth stack with Cognito + Api stack with JWT Authorizer
- [ ] All new backend tests pass (`vitest`)
- [ ] iOS project builds in CI
- [ ] No secrets committed (Cognito config uses env vars / CDK context, not hardcoded keys)
- [ ] Code merged to main via PR

### File touchpoints

| Area | Files (new or modified) |
|---|---|
| CDK | `backend/cdk/lib/auth-stack.ts`, `backend/cdk/lib/api-stack.ts` |
| CDK tests | `backend/test/cdk/auth-stack.test.ts`, `backend/test/cdk/api-stack.test.ts` |
| Backend routes | `backend/src/routes/auth.ts`, `backend/src/index.ts` |
| Backend services | `backend/src/services/user-service.ts` |
| Backend middleware | `backend/src/middleware/auth.ts` |
| Backend tests | `backend/test/routes/auth.test.ts`, `backend/test/services/user-service.test.ts` |
| iOS project | `ios/FamilyMovieNight.xcodeproj`, `ios/FamilyMovieNight/` |
| iOS auth | `ios/FamilyMovieNight/Features/Auth/AuthViewModel.swift`, `SignInView.swift`, `EmailSignUpView.swift`, `VerifyEmailView.swift`, `EmailSignInView.swift` |
| iOS services | `ios/FamilyMovieNight/Services/AuthService.swift`, `Services/APIClient.swift` |
| iOS config | `ios/FamilyMovieNight/amplifyconfiguration.json` |
| CI | `.github/workflows/ci.yml` |

### Test requirements

| Layer | What to test | Approach |
|---|---|---|
| CDK | Auth stack has UserPool, AppClient, Apple IdP | `Template.fromStack()` assertions |
| CDK | Api stack has HttpApi, JwtAuthorizer, LambdaIntegration | `Template.fromStack()` assertions |
| Backend | `user-service.getOrCreateUser` — creates new user, returns existing | Mock DynamoDB `@aws-sdk/lib-dynamodb` |
| Backend | `POST /auth/me` — returns 200 with user JSON | `app.request()` with mocked request context |
| Backend | `DELETE /auth/account` — returns 204 | `app.request()` with mocked request context |
| iOS | Build succeeds | `xcodebuild build` in CI (no unit tests yet — added in Task 03) |
