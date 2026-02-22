# Slice C: Multi-User Household / Member Model Migration

> **Scope:** Migrate from single-user-per-device identity to a household model with Independent and Managed members, profile switching, attendee-scoped sessions, post-watch ratings, and full session lifecycle.
>
> **Depends on:** Slice B (round/voting infrastructure)

---

## Executive Summary

The existing codebase cleanly implements single-user-per-device authentication, a group/membership model, a full voting round lifecycle, and a suggestion engine. This migration extends it in three ways:

1. **Identity bifurcation**: Members are either Independent (own Cognito account) or Managed (no login; controlled from any household device).
2. **Profile switching**: Any device logged into the household can switch active profile between the authenticated user and managed members, without a full app reload.
3. **Attendee selection and async voting scoping**: Sessions are scoped to a selected subset of household members (defaulting to all), and vote progress tracking accounts for only selected attendees.

The DynamoDB `Users` table already has a `parent-index` GSI on `parent_user_id`, and the `Ratings` table already exists in CDK. These are scaffolding bones that were never fully wired.

---

## Resolved Decisions

The following open questions have been resolved:

1. **Anyone can start a session**: Yes — remove the `requireCreator` check on round creation. The "Start Voting Round" button is shown to all members. Pick-confirmation remains creator-only.
2. **Rating scale**: 3-point scale (`Loved / Liked / Did Not Like`) per the updated brief. This supersedes the older `stars: int(1-5)` in data.md.
3. **Expired state**: Deferred to post-v1. The `expired` status value will exist in the enum but no automated expiration logic will be implemented.

---

## Current State Snapshot

### Identity Model
- One Cognito identity per physical device session.
- `User` record keyed on Cognito `sub` (`user_id`).
- `AuthService` holds `isAuthenticated`, `accessToken`, `userId`. No concept of "active profile" distinct from the authenticated user.
- `GroupMember` has `userId`, `role` (`creator`/`member`), but no `member_type` (Independent vs Managed) field.
- `UserService.getOrCreateUser` JIT-provisions a user on first authenticated API call; no path to create a user without Cognito credentials.

### Session Model
- `Round` has `status`: `voting | closed | picked | discarded`.
- No `attendees` scoping — vote progress `total` is computed as `members.length` (all group members).
- No `draft` state: round creation immediately runs the suggestion algorithm and sets status to `voting`.
- `Pick` has a `watched` boolean and `watched_at`. `Rating` table exists in DynamoDB CDK stack but has no corresponding service, route, or iOS model.

### Voting
- Async `POST /rounds/:id/votes` — fire-and-forget, upsert semantics.
- Vote is tied to `user_id` from JWT. No mechanism to vote on behalf of a managed member.
- `VoteProgress` counts unique voters against all group members (not a selected attendee set).
- Creator-only restriction on `closeRound` and `pickMovie`.

### Profile Switching
- Not implemented. `HomeView` toolbar has "Sign Out" only.

### Ratings
- `Ratings` DynamoDB table and `RATINGS_TABLE` env var exist in CDK.
- No `RatingService`, no route, no iOS model, no UI. Completely absent from the working app.

---

## Target State Snapshot

### Identity Model
- Two member types:
  - **Independent**: Has a Cognito account. Signs in on their own device. Cannot be impersonated on other devices.
  - **Managed**: No Cognito account. Created and controlled by a household admin. Accessible from any household-authenticated device.
- A single device session authenticates as one Cognito user but can switch the "active profile" to any managed member without signing out.

### Session Lifecycle
```
draft -> voting -> selected -> watched -> rated -> expired (post-v1)
```

### Attendees
- Each session has an explicit `attendees` list (member IDs, defaulting to all household members).
- Vote progress denominator is `attendees.count`, not `members.count`.
- Suggestion algorithm aggregates preferences from attendees only.

### Ratings
- Post-watch: `Loved / Liked / Did Not Like` per attendee member.
- Rating state transitions round to `rated` when all attending members have rated, or when the creator manually closes ratings.

### Starting Sessions
- Any household member can create a movie night session (not just the creator).

---

## Gap Analysis

### Identity / Account Assumptions

| Dimension | Current | Target | Gap |
|---|---|---|---|
| Member type | All Independent | Independent + Managed | Add `member_type` field; new managed member creation flow |
| Profile switching | Single user only | Switch to any managed member | New `ProfileSessionManager`; profile picker UI |
| Cognito identity | 1 sub = 1 user = 1 member | 1 sub = 1 auth user who can act as managed members | Auth middleware must accept `X-Acting-As-Member` header |

### Data Scoping

| Dimension | Current | Target | Gap |
|---|---|---|---|
| Preference key | `(group_id, user_id)` | `(group_id, member_id)` | Preference API must accept member_id for managed members |
| Vote attribution | `user_id` from JWT | `member_id` (acting member) | Vote key must use acting member ID |

### Session Representation

| Dimension | Current | Target | Gap |
|---|---|---|---|
| States | `voting, closed, picked, discarded` | `draft, voting, selected, watched, rated, expired` | State enum extended; `normalizeStatus` adapter for existing data |
| Attendees | Implicit (all members) | Explicit list on round | New `attendees: string[]` field |
| Round creation permission | Creator-only | Any member | Remove `requireCreator` check on round creation |
| Ratings | Table exists, no service | Full service + UI | New `RatingService`, routes, iOS flow |

---

## Impact Map

### Backend

| Subsystem | Files | Severity | Risk |
|---|---|---|---|
| User/Member model | `models/user.ts`, `services/user-service.ts`, CDK `data-stack.ts` | Major | New user types introduce auth delegation |
| Group/Membership model | `models/group.ts`, `services/group-service.ts`, `routes/groups.ts` | Major | Managed member CRUD |
| Round lifecycle | `models/round.ts`, `services/round-service.ts`, `routes/rounds.ts` | Major | New states, attendees field, draft→voting split |
| Vote service | `models/vote.ts`, `services/vote-service.ts`, `routes/votes.ts` | Moderate | Progress denominator change; member_id context |
| Preference service | `models/preference.ts`, `services/preference-service.ts`, `routes/preferences.ts` | Moderate | Must work for managed members |
| Rating service | No file exists yet | Major | Net-new |
| Auth middleware | `middleware/auth.ts` | Moderate | `X-Acting-As-Member` header handling |

### iOS

| Subsystem | Files | Severity | Risk |
|---|---|---|---|
| Auth/session context | `AuthService.swift`, `FamilyMovieNightApp.swift`, `ContentView.swift` | Major | New `ProfileSessionManager` environment object |
| Identity model | `Models/User.swift`, `Models/Group.swift` | Major | `memberType`, `isManaged` fields |
| Home / group detail | `Features/Home/HomeView.swift`, `Features/Group/GroupDetailView.swift` | Major | Profile switching; anyone-can-start-round |
| Round creation | `Features/Rounds/StartRoundView.swift`, `VotingViewModel.swift` | Moderate | Attendee selection; draft state |
| Voting | `Features/Rounds/VotingView.swift`, `VotingViewModel.swift` | Moderate | Progress against attendees; acting-as context |
| Rating flow | No file exists yet | Major | Net-new |

### Riskiest Areas

1. **Managed member identity and acting-as delegation** — touches auth middleware, every service that reads `userId`, and every vote/rating attribution point.
2. **Round state machine extension** — existing states overlap imperfectly with target states.
3. **Vote progress denominator change** — requires attendees list on round.
4. **Profile switching without full app reload** — requires `activeProfile` concept alongside existing auth gate.

---

## Proposed Target Architecture

### Core Domain Models

```
Household (renamed from Group)
  id, name, adminUserId, streamingServices, createdAt

Member
  memberId         // Independent: same as user_id. Managed: "managed_<uuid>"
  householdId
  displayName, avatarKey
  memberType       // independent | managed
  parentUserId     // Only for managed members
  contentRatingCeiling
  joinedAt

Session (extended from Round)
  sessionId, householdId
  createdBy         // memberId
  status            // draft | voting | selected | watched | rated | expired
  attendees         // [memberId], defaults to all
  timestamps (created, votingStarted, selected, watched, rated, expires)

Vote
  sessionId, tmdbMovieId
  memberId          // acting member
  vote              // up | down
  votedAt

Rating (new)
  sessionId, memberId
  rating            // loved | liked | did_not_like
  ratedAt
```

### Service Layer Boundaries

| Service | Responsibility | Status |
|---|---|---|
| `AuthService` (iOS) | Cognito session management | Add `activeProfile` property |
| `ProfileSessionManager` (iOS, new) | Active profile state; switching logic | New |
| `HouseholdService` (iOS, new) | Household + member fetch, managed member CRUD | New |
| `VoteService` (backend) | Accept `memberId` context; attendee-scoped progress | Extend |
| `RatingService` (backend, new) | Post-watch ratings; trigger `rated` state | New |
| `MemberService` (backend, new) | CRUD for managed members | New |

### Migration Adapters

1. **`RoundStatusAdapter`** (backend): Maps old Round status strings to new Session status strings at read-time. No data migration needed.
2. **`MemberIdentityAdapter`** (iOS): Translates between current `GroupMember` and new `Member` model during incremental migration.

---

## Migration Plan

### Slice C0 — Baseline Hardening and Schema Alignment

**Goal**: Align data contracts with new model. No user-visible changes.

**Scope**:
- Backend: Add `is_managed` (bool, default false) and `parent_user_id` (nullable string) to `User` schema and `UserService`.
- Backend: Add `member_type` to `GroupMember` schema (`independent` | `managed`; default `independent`).
- Backend: Rename Round status `picked` to `selected`. Add `watched` and `rated` as valid status values. Write `normalizeStatus` adapter for read-time mapping.
- Backend: Add `attendees` field (optional `string[]`, default null = all members) to Round model.
- iOS: Add `memberType: String` and `isManaged: Bool` to `GroupMember` Swift struct.
- iOS: Add `RatingValue` enum (`loved`, `liked`, `didNotLike`) to new `Rating.swift` model file.

**Files**:
- `backend/src/models/user.ts`, `services/user-service.ts`
- `backend/src/models/group.ts`, `services/group-service.ts`
- `backend/src/models/round.ts`, `services/round-service.ts`
- `ios/FamilyMovieNight/Models/Group.swift`, `Models/Round.swift`, `Models/Rating.swift` (new)

**Success criteria**: All existing tests pass. New unit tests for `normalizeStatus`. iOS compiles with new optional fields.

**Rollback**: All changes are additive optional fields. Remove with no data migration.

**Complexity**: S

---

### Slice C1 — Ratings Service (Backend + iOS)

**Goal**: Implement post-watch ratings end-to-end. Entirely additive.

**Scope**:
- Backend: `models/rating.ts` — `RatingSchema` with `session_id`, `member_id`, `rating` (enum: `loved`, `liked`, `did_not_like`), `rated_at`.
- Backend: `services/rating-service.ts` — `submitRating`, `getRatingsForSession`.
- Backend: `routes/ratings.ts` — `POST /rounds/:id/ratings`, `GET /rounds/:id/ratings`. Validate round is in `watched` or `selected` status.
- Backend: CDK `api-stack.ts` — grant `ratingsTable` access (table already exists).
- iOS: `Models/Rating.swift` — add `RatingResponse`, `SubmitRatingRequest`.
- iOS: `Features/Rounds/RatingViewModel.swift` (new), `RatingView.swift` (new) — `Loved / Liked / Did Not Like` selector using `RatingSelectorView`.
- iOS: `PickConfirmationView.swift` — present `RatingView` sheet after "We Watched It".

**Files**:
- `backend/src/models/rating.ts` (new), `services/rating-service.ts` (new), `routes/ratings.ts` (new)
- `backend/src/index.ts`, `backend/cdk/lib/api-stack.ts`
- `ios/FamilyMovieNight/Models/Rating.swift`
- `ios/FamilyMovieNight/Features/Rounds/RatingViewModel.swift` (new), `RatingView.swift` (new)
- `ios/FamilyMovieNight/Features/Rounds/PickConfirmationView.swift`

**Success criteria**: Ratings stored and retrieved. Rating flow reachable from PickConfirmationView. Unit tests. UI Preview with all three options.

**Rollback**: Feature-flaggable with `showRatingFlow` bool.

**Complexity**: M

---

### Slice C2 — Attendee Selection + Anyone-Can-Start (Backend)

**Goal**: Rounds support explicit attendee lists and any member can create a round. No iOS UI change yet.

**Scope**:
- Backend: `CreateRoundSchema` — add optional `attendees: string[]` (validated as subset of group members). Default: all members.
- Backend: `RoundService.createRound` — persist `attendees`. Remove `requireCreator` check on round creation (anyone can start).
- Backend: `VoteService.getVoteProgress` — use `attendees` as denominator when present.
- Backend: `SuggestionService.getSuggestions` — add optional `attendeeIds` parameter to filter preferences to attending members only.
- iOS: `Models/Round.swift` — add `attendees: [String]?` to `RoundDetails` and `CreateRoundRequest`.

**Files**:
- `backend/src/models/round.ts`, `services/round-service.ts`
- `backend/src/services/vote-service.ts`, `services/suggestion-service.ts`
- `backend/src/routes/rounds.ts`
- `ios/FamilyMovieNight/Models/Round.swift`
- Tests for attendee-scoped progress and anyone-can-start

**Success criteria**: Round with `attendees: ["user1", "user2"]` stores the list. Vote progress returns `total: 2` in a 4-member group. Non-creator can create a round. Existing rounds without attendees continue to work.

**Rollback**: `attendees` field is additive. Removing it reverts to all-members default.

**Complexity**: S

---

### Slice C3 — Managed Member Infrastructure (Backend)

**Goal**: Enable creation and management of managed member profiles. The largest backend slice.

**Scope**:
- Backend: Extend `UserSchema` with `is_managed: boolean`, `parent_user_id: string | null`. `parent-index` GSI already exists.
- Backend: `POST /groups/:group_id/members/managed` — creates a managed member with synthetic `user_id` (`managed_<uuid>`), `is_managed: true`, `parent_user_id: callerId`. No Cognito user created.
- Backend: `DELETE /groups/:group_id/members/:member_id` — creator can remove managed members; independent members can only remove themselves.
- Backend: Auth middleware — support optional `X-Acting-As-Member` header. Validate that the member is managed with `parent_user_id` matching JWT `sub`. Set `actingMemberId` in context.
- Backend: `VoteService.submitVote` — use `actingMemberId ?? userId`.
- Backend: `PreferenceService` — accept `memberId` param. Routes take optional `?member_id=` query param with ownership validation.

**Files**:
- `backend/src/models/user.ts`, `services/user-service.ts`
- `backend/src/models/group.ts`, `services/group-service.ts`, `routes/groups.ts`
- `backend/src/middleware/auth.ts`
- `backend/src/services/vote-service.ts`, `services/preference-service.ts`, `routes/preferences.ts`

**Success criteria**: Creator can POST a managed member. Managed member appears in group member list. Vote with `X-Acting-As-Member` stores under managed member ID. Preferences settable for managed members. Cross-household leakage prevented.

**Rollback**: Managed members have synthetic IDs and don't affect Cognito. Remove routes; ignore header.

**Complexity**: L

---

### Slice C4 — Profile Switching UI (iOS)

**Goal**: Switch between authenticated user and managed member profiles without signing out.

**Scope**:
- iOS: `ProfileSessionManager` (`ObservableObject`) — holds `activeProfile: GroupMember`, switchable profiles list, `switchProfile(to:)`, `resetToAuthenticatedUser()`.
- iOS: Inject as `@EnvironmentObject` in `FamilyMovieNightApp`.
- iOS: `APIClient` — attach `X-Acting-As-Member` header when `activeProfile.isManaged`.
- iOS: `HomeView` — replace "Sign Out" toolbar item with `ProfileAvatarView` opening `ProfileSwitcherView`.
- iOS: `ProfileSwitcherView` (new) — sheet showing authenticated user + managed members. Spring animation, VoiceOver announcement on switch.
- iOS: `VotingView` — "Voting as [name]" caption.
- iOS: `PreferencesViewModel` — accept `memberId` parameter.

**Files**:
- `ios/FamilyMovieNight/Services/ProfileSessionManager.swift` (new)
- `ios/FamilyMovieNight/Services/APIClient.swift`
- `ios/FamilyMovieNight/FamilyMovieNightApp.swift`, `ContentView.swift`
- `ios/FamilyMovieNight/Features/Home/HomeView.swift`
- `ios/FamilyMovieNight/Features/Auth/ProfileSwitcherView.swift` (new)
- `ios/FamilyMovieNight/Features/Rounds/VotingView.swift`
- `ios/FamilyMovieNight/Features/Preferences/PreferencesViewModel.swift`

**Success criteria**: Device with one authenticated user and one managed member can switch between them. Profile switch animates smoothly. Voting submits under managed member ID. No full app reload.

**Rollback**: `ProfileSessionManager.activeProfile` defaults to authenticated user. Removing switcher UI reverts to current behavior.

**Complexity**: M

---

### Slice C5 — Managed Member Creation UI (iOS)

**Goal**: Household admin can add managed member profiles in the app.

**Scope**:
- iOS: `AddManagedMemberView` — form with display name (max 30 chars), avatar picker, content rating ceiling (forced PG for managed members).
- iOS: `AddManagedMemberViewModel` — calls `POST /groups/:id/members/managed`.
- iOS: `GroupDetailView` — "Add Family Member" option in Members section.
- iOS: COPPA disclosure text displayed during creation.

**Files**:
- `ios/FamilyMovieNight/Features/Group/AddManagedMemberView.swift` (new)
- `ios/FamilyMovieNight/Features/Group/AddManagedMemberViewModel.swift` (new)
- `ios/FamilyMovieNight/Features/Group/GroupDetailView.swift`

**Success criteria**: Creator adds managed member from household screen. Member appears in list and profile switcher. COPPA disclosure visible. Previews for light/dark/large type.

**Rollback**: Feature-flaggable. Remove UI; backend endpoint remains.

**Complexity**: S

---

### Slice C6 — Attendee Selection UI (iOS)

**Goal**: Explicit attendee selection before suggestion generation.

**Scope**:
- iOS: `AttendeeSelectionView` (new) — first step in `StartRoundView`. All members with checkmarks. Min 2 selected. Default: all checked. Uses `MemberChip`.
- iOS: `VotingViewModel.createRound` — include `attendees` in `CreateRoundRequest`.
- iOS: `VotingView` — "N of M attending members voted" label.
- iOS: `StartRoundView` — show "Start Voting Round" to all members (not just creator).

**Files**:
- `ios/FamilyMovieNight/Features/Rounds/AttendeeSelectionView.swift` (new)
- `ios/FamilyMovieNight/Features/Rounds/StartRoundView.swift`
- `ios/FamilyMovieNight/Features/Rounds/VotingViewModel.swift`
- `ios/FamilyMovieNight/Features/Rounds/VotingView.swift`

**Success criteria**: Attendee picker shown before round start. Fewer-than-all selection creates scoped round. Vote progress reflects attendee count. Any member can start a round.

**Rollback**: Remove `AttendeeSelectionView`; `createRound` defaults to all members.

**Complexity**: S

---

### Slice C7 — Round Lifecycle Completion + Session History

**Goal**: Full lifecycle in UI. Session history screen.

**Scope**:
- Backend: `RoundService.transitionToWatched` — sets status to `watched` from `selected`.
- Backend: `RatingService` — auto-transition to `rated` when all attendees have rated. Creator can also close ratings manually via `PATCH /rounds/:id` with `{"status": "rated"}`.
- Backend: `GET /groups/:id/sessions` — paginated list of all rounds with summary.
- iOS: `SessionHistoryView` + `SessionHistoryViewModel` (new) — accessible from `GroupDetailView`. Shows past sessions with state badges.
- iOS: `PickConfirmationView` — after "We Watched It", transition to `RatingView` then confirmation linking to history.
- iOS: `RoundDetails` status enum handles all new states. `discarded` displayed as `Expired`.

**Files**:
- `backend/src/services/round-service.ts`, `services/pick-service.ts`, `services/rating-service.ts`
- `backend/src/routes/groups.ts`, `routes/rounds.ts`
- `ios/FamilyMovieNight/Features/Sessions/SessionHistoryView.swift` (new)
- `ios/FamilyMovieNight/Features/Sessions/SessionHistoryViewModel.swift` (new)
- `ios/FamilyMovieNight/Features/Group/GroupDetailView.swift`
- `ios/FamilyMovieNight/Features/Rounds/PickConfirmationView.swift`
- `ios/FamilyMovieNight/Models/Round.swift`

**Success criteria**: Watched transition works. All-attendee rating transitions to `rated`. History screen lists past sessions with correct badges.

**Rollback**: History screen is a new nav destination. Lifecycle transitions are additive.

**Complexity**: M

---

## Slice Ordering

```
C0 (baseline)
 |
 +-- C1 (ratings)
 |    |
 +-- C2 (attendees backend + anyone-can-start)
      |
      +-- C3 (managed member backend)
            |
            +-- C4 (profile switching UI)
            |    |
            |    +-- C5 (managed member creation UI)
            |    |
            +-- C6 (attendee selection UI)
                  |
                  +-- C7 (lifecycle + history)
```

C1 and C2 can be developed concurrently. C4 and C5 can be developed concurrently once C3 is done.

---

## Test Plan / Verification Checklist

### Per-Slice Tests

See each slice section above for success criteria. Key cross-cutting checks:

### Data Safety Checks

1. **Household isolation**: Every API endpoint returning household data must call `requireMember(groupId, userId)`. Verify after each slice.
2. **Managed member leakage**: `X-Acting-As-Member` from Household A cannot be used against Household B. Validate `parentUserId == callerUserId` AND `group_id` matches.
3. **Cross-session vote attribution**: Votes from Session A cannot appear in Session B (enforced by `round_id` partition key).
4. **Rating before watched**: Reject ratings if round is not in `watched` or `selected` status.

### Manual Test Cases

| Test | Slice |
|---|---|
| Managed member appears in member list and profile switcher | C3, C4 |
| Profile switch animates without app reload | C4 |
| Vote submitted as managed member attributed correctly | C3, C4 |
| Attendee selection with 2 of 4 members scopes vote progress | C2, C6 |
| Non-creator can start a round | C2, C6 |
| Post-watch rating flow completes and transitions round | C1, C7 |
| Session history shows all lifecycle states with correct badges | C7 |
| COPPA disclosure visible when adding managed member | C5 |
| `discarded` round shows as "Expired" in history | C7 |

---

## Assumptions

- Managed member `user_id` uses `managed_<uuid>` prefix — no collision with Cognito UUIDs.
- `parent-index` GSI on Users table is already deployed (exists in CDK stack).
- `Ratings` DynamoDB table is already deployed (exists in CDK stack).
- iOS does not cache group membership data offline between launches.
- 3-point rating scale (`loved | liked | did_not_like`) per updated brief — not 1-5 stars.
- `started_by` on rounds uses `memberId` (acting member) after managed member support.
- `expired` state value exists in enum but automated expiration is deferred to post-v1.
