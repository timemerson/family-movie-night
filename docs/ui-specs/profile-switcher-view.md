# ProfileSwitcherView — UI Specification

**Version:** 1.0
**Status:** Ready for Implementation
**Slice:** C4 (Profile Switching UI)
**Depends On:** Slice C3 (Managed Member Infrastructure — Backend)
**Related Stories:** US-25, US-42
**Related Flows:** Flow 11 (Add a Managed Member), Flow 12 (Profile Switching)
**Related Architecture:** `docs/architecture/overview.md` (Identity Model), `docs/architecture/sync-and-offline.md` (Profile Switching), `docs/architecture/api.md` (X-Acting-As-Member header)
**Implements:**
- `ProfileSessionManager` (new `ObservableObject` service)
- `ProfileSwitcherView` (bottom sheet)
- `ProfileAvatarNavButton` (navigation bar tap target)
- `ActiveProfileBanner` (contextual identity indicator)

---

## Overview

Profile switching lets a single authenticated device act on behalf of managed members — children or family members who have no Cognito account of their own. The parent or household member taps the avatar in the top-right corner of the navigation bar, sees their own profile plus any managed members they control, and taps to switch. The switch is purely client-side: no re-authentication, no app reload. Subsequent API calls carry an `X-Acting-As-Member` header identifying the managed member until the user switches back.

This is not a login flow. It is an identity-context switcher. The design must feel lightweight, instant, and calm — more like switching a tab than signing in.

**Scope boundary:** The switcher shows only the authenticated user and managed members with `parent_user_id` equal to the authenticated user's ID. Independent members from other accounts are never shown and cannot be impersonated.

---

## UX Flows

### Flow 12 — Profile Switching

```
Entry: User taps ProfileAvatarNavButton in the top-right nav bar

1. ProfileSwitcherView sheet appears (spring, .medium detent for <= 3 profiles,
   [.medium, .large] for >= 4 profiles)

   Sheet contents:
   - Header: "Switch Profile" + household name
   - Authenticated user row (checkmark if active)
   - "FAMILY MEMBERS" section (only if >= 1 managed member exists)
       One ProfileSwitcherRow per managed member
   - "Add Family Member" SecondaryButton

2. User taps a managed member row
   - Spring checkmark animation fires
   - UIImpactFeedbackGenerator(.medium) fires
   - ProfileSessionManager.switchProfile(to: managedMember) called
   - activeProfile updates in-memory — no server call, no app reload
   - Sheet dismisses
   - VoiceOver announces (0.3s delay): "Now viewing as [Name]"
   - Nav bar avatar crossfades to managed member's avatar + PrimaryAccent badge appears
   - ActiveProfileBanner appears on VotingView / PreferencesView

3. User taps the authenticated user row while a managed member is active
   - Same spring animation + haptic
   - ProfileSessionManager.resetToAuthenticatedUser() called
   - Sheet dismisses
   - VoiceOver announces: "Now viewing as yourself"
   - X-Acting-As-Member header dropped from all subsequent API calls
   - Badge disappears from nav bar avatar

4. User taps "Add Family Member"
   - Sheet dismisses
   - AddManagedMemberView presented (Slice C5)

5. User swipes down or taps outside
   - Sheet dismisses with no profile change
```

**ProfileSessionManager state machine:**

```
authenticatedUser (default)
        |
        | switchProfile(to: managedMember)
        v
actingAsManagedMember
        |
        | resetToAuthenticatedUser()
        |   OR switchProfile(to: differentManagedMember)
        v
authenticatedUser (or different managed member)
```

---

## Screen Inventory

| Component | Purpose | Entry Points | Exit Points | Primary Action |
|---|---|---|---|---|
| `ProfileAvatarNavButton` | Nav bar tap target; visual identity indicator | Any screen with the nav bar in scope | Opens `ProfileSwitcherView` sheet | Open switcher |
| `ProfileSwitcherView` | Sheet listing all switchable profiles | Tap on `ProfileAvatarNavButton` | Dismiss (no change), switch profile, Add Member | Tap a profile row |
| `ProfileSwitcherRow` | Single profile row inside the sheet | Embedded in `ProfileSwitcherView` | N/A — embedded | Tap to switch |
| `ActiveProfileBanner` | Inline "acting as" indicator on action screens | Top of `VotingView`, `PreferencesView` | N/A — display only | None |

---

## Screen Specifications

### Component: ProfileAvatarNavButton

**Purpose:** Always-visible tap target in the navigation bar trailing position. Communicates current active identity at a glance.

**Placement:** `ToolbarItem(placement: .navigationBarTrailing)` in `HomeView`. Replaces the existing "Sign Out" button. Sign Out moves to Settings (see OQ-2 for Slice C4 interim approach).

**Visual Description:**

Authenticated-user active (default):
- `ProfileAvatarView(avatarKey: activeProfile.avatarKey, size: .small)` at 32pt diameter
- No badge
- 44pt tap target via `.contentShape(Rectangle())` padding

Acting-as-managed-member active:
- `ProfileAvatarView` at 32pt showing the managed member's avatar
- 10pt `PrimaryAccent` filled circle badge at bottom-right of the avatar
- 1.5pt `AppBackground`-colored ring separating the badge from the avatar image
- The badge communicates "this is not your own identity" without requiring nav bar text

**Interaction:** Tap opens `ProfileSwitcherView` as a `.sheet`. No long-press.

**Animation on profile switch (fires after sheet dismisses, delayed 0.2s):**
- Avatar crossfade: `.id(activeProfile.memberId)` + `.transition(.opacity)` + `.animation(.easeInOut(duration: 0.25), value: activeProfile.memberId)`
- Badge appear: scale `0 → 1.15 → 1.0` via `.spring(response: 0.3, dampingFraction: 0.6)`
- Badge disappear: `.opacity(0)` in 0.15s

---

### Screen: ProfileSwitcherView

**Purpose:** Bottom sheet listing the authenticated user's own profile and all managed member profiles they control.

**Presentation:**
- `.sheet` with `presentationDetents([.medium])` for ≤ 3 total profiles; `[.medium, .large]` for ≥ 4
- `.presentationDragIndicator(.visible)`
- `interactiveDismissDisabled(false)` — swiping down dismisses with no profile change
- Background: `AppBackground`

**Layout Structure:**

```
+----------------------------------------------------------+
|  ●  (drag indicator, centered)                           |
+----------------------------------------------------------+
|                                             20pt top     |
|  "Switch Profile"     (.title2 .bold)       16pt sides   |
|  "The Emersons"       (.subheadline .sec)                |
|                                             16pt gap     |
|  +----------------------------------------------------+  |
|  |  [ProfileSwitcherRow — authenticated user]         |  |  CardBackground, radius 16
|  |  ── divider ──────────────────────────────────     |  |
|  |  "FAMILY MEMBERS"  (.caption .uppercased .sec)     |  |  section header (omitted if count == 0)
|  |  ── divider ──────────────────────────────────     |  |
|  |  [ProfileSwitcherRow — managed member 1]           |  |
|  |  [ProfileSwitcherRow — managed member 2]           |  |
|  +----------------------------------------------------+  |
|                                             16pt gap     |
|  [Add Family Member — SecondaryButton, full width]       |
|                                                          |
|  (State 2 only:) 8pt gap                                 |
|  "Add a profile for a family member..."  (.caption .sec) |
|                                                          |
|  16pt + safe area bottom                                 |
+----------------------------------------------------------+
```

**Content hierarchy notes:**
- Authenticated user always first — they are the "owner" switching to managed profiles
- "FAMILY MEMBERS" section header is omitted entirely when `managedProfiles.count == 0` (no empty-section heading)
- Row dividers are 1pt at `.secondary.opacity(0.3)` — subtle separation without visual weight
- No navigation bar inside the sheet. Header is plain `Text` views.

---

### Component: ProfileSwitcherRow

**Purpose:** Single tappable row representing one switchable profile.

**Props:**
```swift
struct ProfileSwitcherRow: View {
    let profile:  SwitchableProfile
    let isActive: Bool
    let onSelect: () -> Void
}
```

**Visual Description:**

`HStack(spacing: 12)` with `.padding(.horizontal, 16).frame(minHeight: 44)`:

- Leading: `ProfileAvatarView(avatarKey: profile.avatarKey, size: .medium)` at 44pt diameter
- Center: `VStack(alignment: .leading, spacing: 2)`:
  - `Text(profile.displayName)` — `.body .semibold`
  - `Text(profile.typeLabel)` — `.caption .secondary` ("You" for authenticated user; "Family Member" for managed)
- Trailing: When `isActive` — `Image(systemName: "checkmark.circle.fill")` at 22pt in `PrimaryAccent`. When not active — nothing (absence communicates unselected state cleanly; no empty placeholder)

Background:
- Unselected: `Color("CardBackground")` (no overlay)
- Selected: `Color("PrimaryAccent").opacity(0.06)` overlay

The card container (not individual rows) carries `cornerRadius(16)`, `CardBackground` fill, and `.clipShape(RoundedRectangle(cornerRadius: 16))` to clip all rows together.

**Interaction:**
- Tap fires `onSelect()` then `UIImpactFeedbackGenerator(style: .medium).impactOccurred()`
- Row micro-scale on press: `.scaleEffect(isPressed ? 0.98 : 1.0)` via `.spring(response: 0.2, dampingFraction: 0.7)`
- Checkmark spring appear/disappear (see Interaction Details section)

**Variants:**

| Variant | Trailing element | Background |
|---|---|---|
| Authenticated user, active | `checkmark.circle.fill` in `PrimaryAccent` | `PrimaryAccent` 6% tint |
| Authenticated user, inactive | Nothing | `CardBackground` |
| Managed member, active | `checkmark.circle.fill` in `PrimaryAccent` | `PrimaryAccent` 6% tint |
| Managed member, inactive | Nothing | `CardBackground` |

---

### Component: ActiveProfileBanner

**Purpose:** Full-width, non-interactive banner at the top of screens that attribute actions to a specific member. Shown only when `profileSessionManager.isActingAsManaged == true`.

**When shown:** Only when acting as a managed member. Never shown when the authenticated user is active.

**Placement and label text by screen:**
- `VotingView` — above the movie list, below nav bar: `"Voting as [Name]"`
- `PreferencesView` — below nav bar: `"Setting preferences for [Name]"`
- `RatingView` — uses the smaller inline pill from `rating-selector-view.md`, NOT this component

**Visual Description:**

Full-width `HStack(spacing: 8)` with `.padding(.vertical, 8).padding(.horizontal, 12)`:
- `ProfileAvatarView(avatarKey: ..., size: .xsmall)` at 20pt
- `Text("Voting as \(name)")` — `.subheadline .medium`, `PrimaryAccent`
- `Spacer()`
- `Image(systemName: "arrow.left.arrow.right")` — 14pt, `PrimaryAccent.opacity(0.6)` (decorative; hidden from VoiceOver)

Container: `Color("PrimaryAccent").opacity(0.10)` background, `cornerRadius(8)`, 16pt outer horizontal margin, 12pt gap below before content.

**Non-interactive.** No tap action. The nav bar avatar is the single entry point for switching.

**Animation:** `.transition(.opacity.combined(with: .move(edge: .top)))` wrapped in `.spring(response: 0.35, dampingFraction: 0.75)`.

---

## Service: ProfileSessionManager

**File:** `ios/FamilyMovieNight/Services/ProfileSessionManager.swift`

**Role:** Central source of truth for the active acting-as profile. `@EnvironmentObject` injected in `FamilyMovieNightApp`. Read by `APIClient` to attach `X-Acting-As-Member`. Read by views to drive `ActiveProfileBanner` and nav bar avatar state.

`ProfileSessionManager` is intentionally **separate from `AuthService`**. `AuthService` manages Cognito identity (authentication). `ProfileSessionManager` manages the active member context (authorization delegation). These are distinct concerns and must not be conflated.

`ProfileSessionManager` makes no API calls. Its managed member list is derived from `GroupViewModel`'s already-loaded group data via `updateProfiles(...)`.

```swift
@MainActor
final class ProfileSessionManager: ObservableObject {

    // MARK: - Published State

    /// Currently active profile. Defaults to the authenticated user.
    @Published private(set) var activeProfile: SwitchableProfile

    /// All profiles available to switch to (authenticated user + managed members).
    /// Refreshed when group data loads or managed members change.
    @Published private(set) var availableProfiles: [SwitchableProfile] = []

    // MARK: - Derived

    /// True when acting as a managed member.
    var isActingAsManaged: Bool { activeProfile.isManaged }

    /// The member_id to attach to X-Acting-As-Member header.
    /// Returns nil when acting as the authenticated user (header omitted).
    var actingAsMemberId: String? {
        activeProfile.isManaged ? activeProfile.memberId : nil
    }

    /// All managed member profiles the authenticated user controls.
    var managedProfiles: [SwitchableProfile] {
        availableProfiles.filter { $0.isManaged }
    }

    // MARK: - Init

    init(authenticatedUser: SwitchableProfile) {
        self.activeProfile = authenticatedUser
        self.availableProfiles = [authenticatedUser]
    }

    // MARK: - Profile Management

    /// Called by GroupViewModel after loading/refreshing group data.
    /// Rebuilds availableProfiles. Resets to authenticated user if the
    /// active managed member was removed from the household.
    func updateProfiles(
        authenticatedUser: SwitchableProfile,
        managedMembers: [SwitchableProfile]
    ) {
        availableProfiles = [authenticatedUser] + managedMembers
        if !availableProfiles.contains(where: { $0.memberId == activeProfile.memberId }) {
            activeProfile = authenticatedUser
        }
    }

    /// Switch to a different profile. Animation and haptic are handled by the View layer.
    func switchProfile(to profile: SwitchableProfile) {
        activeProfile = profile
    }

    /// Return to the authenticated user's own context.
    func resetToAuthenticatedUser() {
        guard let ownProfile = availableProfiles.first(where: { !$0.isManaged }) else { return }
        activeProfile = ownProfile
    }
}
```

---

## SwitchableProfile Model

```swift
/// Unified representation for the profile switcher —
/// works for both the authenticated user and managed members.
struct SwitchableProfile: Identifiable, Equatable {
    let memberId:     String      // Cognito sub for authenticated; "managed_<uuid>" for managed
    let displayName:  String
    let avatarKey:    String
    let isManaged:    Bool
    let parentUserId: String?     // nil for the authenticated user

    var id: String { memberId }

    /// Subtitle shown in ProfileSwitcherRow.
    var typeLabel: String { isManaged ? "Family Member" : "You" }

    // MARK: - Factory

    static func from(_ member: GroupMember, isAuthenticatedUser: Bool) -> SwitchableProfile {
        SwitchableProfile(
            memberId:     member.userId,
            displayName:  member.displayName,
            avatarKey:    member.avatarKey,
            isManaged:    member.isManaged ?? false,
            parentUserId: member.parentUserId
        )
    }

    /// Placeholder used during app launch before group data loads.
    static var placeholder: SwitchableProfile {
        SwitchableProfile(memberId: "placeholder", displayName: "",
                          avatarKey: "", isManaged: false, parentUserId: nil)
    }
}
```

`GroupMember` in `Group.swift` requires two new fields per Slice C0:
```swift
struct GroupMember: Codable, Identifiable {
    // existing fields unchanged...
    let isManaged:    Bool?      // default false for existing records
    let parentUserId: String?    // nil for independent members
    let memberType:   String?    // "independent" | "managed"
}
```

---

## Component Library

### Existing Components Used

| Component | Usage |
|---|---|
| `ProfileAvatarView` | 20pt in `ActiveProfileBanner`; 32pt in `ProfileAvatarNavButton`; 44pt in `ProfileSwitcherRow` |
| `SecondaryButton` | "Add Family Member" at the bottom of `ProfileSwitcherView` |

### New Components Required

| Component | File | Notes |
|---|---|---|
| `ProfileSessionManager` | `Services/ProfileSessionManager.swift` | Core service. New `ObservableObject`. |
| `SwitchableProfile` | `Services/ProfileSessionManager.swift` | New model struct. |
| `ProfileSwitcherView` | `Features/Auth/ProfileSwitcherView.swift` | Sheet UI. |
| `ProfileSwitcherRow` | `Features/Auth/ProfileSwitcherView.swift` | Sub-component of sheet. |
| `ProfileAvatarNavButton` | `Features/Home/HomeView.swift` (toolbar item) | Can be extracted to `Features/Shared/` if reused elsewhere. |
| `ActiveProfileBanner` | `Features/Shared/ActiveProfileBanner.swift` | Reusable across `VotingView`, `PreferencesView`, and future action screens. |

### ProfileAvatarView Size Additions

`ProfileAvatarView` requires a new `.xsmall` size variant at 20pt diameter for `ActiveProfileBanner`. Existing usages at 32pt and 44pt should be formalized as `.small` and `.medium` respectively.

---

## State Definitions

### ProfileSwitcherView States

#### State 1: Loading

**Trigger:** Sheet opens before group data has loaded (edge case — group data is typically in-memory from `HomeView.task`).

**What the user sees:**
- Sheet header renders normally (household name always available)
- Two shimmer skeleton rows at 44pt height, `cornerRadius(16)`, opacity pulsing 0.4 → 0.7 over 1.2s
- "Add Family Member" button not rendered

**Available actions:** Swipe down to dismiss.

**Transition out:** Crossfade (0.25s) to State 2 or State 3 once group data loads.

**Reduce Motion:** Static `Color(.systemGray5)` fill; no shimmer animation.

---

#### State 2: Single Profile (No Managed Members)

**Trigger:** Group data loaded; `managedProfiles.count == 0`.

**What the user sees:**
- Sheet header
- One `ProfileSwitcherRow` for the authenticated user (checkmark always shown — they are always active here)
- No "FAMILY MEMBERS" section header — omitted entirely
- `SecondaryButton("Add Family Member")` with `Image(systemName: "person.badge.plus")`
- `Text("Add a profile for a family member who doesn't have their own device.")` — `.caption .secondary`, centered, 8pt below the button

**Available actions:** Dismiss, tap "Add Family Member".

**Design note:** This is the expected state for all new users. The explanatory caption is an invitation, not an error message.

---

#### State 3: Multiple Profiles (Primary Happy Path)

**Trigger:** Group data loaded; `managedProfiles.count >= 1`.

**What the user sees:**
- Sheet header
- Authenticated user `ProfileSwitcherRow`
- "FAMILY MEMBERS" section header
- One `ProfileSwitcherRow` per managed member (creation order)
- Checkmark on whichever profile matches `activeProfile`
- `SecondaryButton("Add Family Member")` at bottom

**Available actions:** Tap any profile row to switch; tap "Add Family Member"; dismiss.

---

#### State 4: Switching In Progress

**Trigger:** User taps a `ProfileSwitcherRow`. Switch is synchronous.

**What the user sees:**
- Tapped row's checkmark animates in (scale punch)
- Previously active row's checkmark fades out
- Sheet dismisses automatically 0.15s after tap

No spinner, no loading state. The switch is entirely client-side and immediate.

---

#### State 5: Managed Member Removed Mid-Session

**Trigger:** While the app is running with a managed member as `activeProfile`, another device removes that managed member. The next `GroupViewModel.loadMyGroup()` refresh detects the removal.

**What happens:**
- `ProfileSessionManager.updateProfiles(...)` is called
- Removed member is no longer in `availableProfiles`
- `activeProfile` auto-resets to the authenticated user (no alert shown — silent reset is preferable to an intrusive error)
- If switcher sheet is open: removed member's row disappears via `.transition(.opacity).animation(.easeInOut(duration: 0.2))`
- Nav bar avatar reverts to authenticated user, badge disappears
- `ActiveProfileBanner` disappears from `VotingView` / `PreferencesView`
- In-flight API calls carrying the removed member's header return `403`; these are handled as normal API errors by the calling screen

---

#### State 6: Error Loading Group Data

**Trigger:** `GroupViewModel.loadMyGroup()` fails.

**What the user sees:**
- Sheet header renders normally
- One `ProfileSwitcherRow` for the authenticated user only
- `Text("Couldn't load family members. Pull to refresh on the home screen.")` — `.caption .secondary`, below the row
- "Add Family Member" button not shown

**Available actions:** Dismiss.

---

### ProfileAvatarNavButton States

| State | Visual | Accessibility label |
|---|---|---|
| Authenticated user active | Avatar, no badge | `"Profile: [Name]. Double-tap to switch profiles."` |
| Managed member active | Avatar + `PrimaryAccent` badge | `"Viewing as [Name]. Double-tap to switch profiles."` |
| Loading (group data unavailable) | Avatar (placeholder/monogram), no badge | `"Profile. Double-tap to switch profiles."` |

---

### ActiveProfileBanner States

| State | Visible | Content |
|---|---|---|
| `isActingAsManaged == false` | No | Hidden; no space reserved in layout |
| `isActingAsManaged == true` | Yes | Context-specific label ("Voting as [Name]" etc.) |

The banner has no independent loading, empty, or error state — it derives entirely from `ProfileSessionManager.activeProfile`.

---

## Interaction Details

### Haptics

| Trigger | Generator | Style |
|---|---|---|
| Tap `ProfileSwitcherRow` to switch profiles | `UIImpactFeedbackGenerator` | `.medium` |
| Tap "Add Family Member" | `UIImpactFeedbackGenerator` | `.light` |

Initialize generators lazily. Fire only on `UIDevice.current.userInterfaceIdiom == .phone`. No haptic on sheet presentation — the system handles the sheet spring.

### Animations

#### Checkmark Appear (newly active row)

```swift
// Inside ProfileSwitcherRow — @State var checkmarkScale: CGFloat = 0

.onChange(of: isActive) { _, newValue in
    guard newValue else { return }
    withAnimation(.spring(response: 0.18, dampingFraction: 0.45)) {
        checkmarkScale = 1.15
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
        withAnimation(.spring(response: 0.22, dampingFraction: 0.65)) {
            checkmarkScale = 1.0
        }
    }
}
.scaleEffect(checkmarkScale)
```

#### Checkmark Disappear (previously active row)

```swift
.opacity(isActive ? 1.0 : 0.0)
.animation(.easeOut(duration: 0.15), value: isActive)
```

#### Row Micro-Scale on Press

Implement via a custom `ButtonStyle` that exposes an `isPressed` state:

```swift
.scaleEffect(isPressed ? 0.98 : 1.0)
.animation(.spring(response: 0.2, dampingFraction: 0.7), value: isPressed)
```

#### Nav Bar Avatar Crossfade (delayed 0.2s after sheet dismiss)

```swift
ProfileAvatarView(avatarKey: profileSessionManager.activeProfile.avatarKey, size: .small)
    .id(profileSessionManager.activeProfile.memberId)
    .transition(.opacity)
    .animation(.easeInOut(duration: 0.25), value: profileSessionManager.activeProfile.memberId)
```

The 0.2s delay prevents the avatar update from visually competing with the sheet spring dismiss.

#### Nav Bar Badge Appear

```swift
// @State var showBadge driven by profileSessionManager.isActingAsManaged
.scaleEffect(showBadge ? 1.0 : 0.0)
.animation(.spring(response: 0.3, dampingFraction: 0.6), value: showBadge)
```

#### Nav Bar Badge Disappear

```swift
.opacity(showBadge ? 1.0 : 0.0)
.animation(.easeOut(duration: 0.15), value: showBadge)
```

#### ActiveProfileBanner Appear/Disappear

```swift
if profileSessionManager.isActingAsManaged {
    ActiveProfileBanner(
        context: .voting,
        name: profileSessionManager.activeProfile.displayName,
        avatarKey: profileSessionManager.activeProfile.avatarKey
    )
    .transition(.opacity.combined(with: .move(edge: .top)))
}
// Outer conditional wrapped in:
withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) { /* trigger */ }
```

#### Managed Member Row Removal (State 5)

```swift
ForEach(profileSessionManager.managedProfiles) { profile in
    ProfileSwitcherRow(...)
}
.animation(.easeInOut(duration: 0.2), value: profileSessionManager.managedProfiles.map { $0.id })
```

#### Reduce Motion

Check `@Environment(\.accessibilityReduceMotion) var reduceMotion`. When `true`:
- Omit checkmark scale punch; use instant opacity transition only
- Omit row micro-scale on press
- Omit badge spring; use instant opacity toggle
- Omit `ActiveProfileBanner` slide; use opacity transition only
- Disable loading shimmer; use static `Color(.systemGray5)` fill

---

## Accessibility

### VoiceOver Labels

| Element | Label | Traits |
|---|---|---|
| `ProfileAvatarNavButton` — authenticated user active | `"Profile: [Name]. Double-tap to switch profiles."` | `.isButton` |
| `ProfileAvatarNavButton` — managed member active | `"Viewing as [Name]. Double-tap to switch profiles."` | `.isButton` |
| `ProfileSwitcherRow` — unselected | `"[DisplayName], [typeLabel]. Double-tap to switch to this profile."` | `.isButton` |
| `ProfileSwitcherRow` — selected/active | `"[DisplayName], [typeLabel]. Currently active."` | `.isButton, .isSelected` |
| Checkmark icon within row | `.accessibilityHidden(true)` — `.isSelected` trait carries the state | — |
| `ActiveProfileBanner` | `"Viewing as [Name]"` | `.isSummaryElement` |
| `ActiveProfileBanner` decorative arrow icon | `.accessibilityHidden(true)` | — |
| Nav bar badge | `.accessibilityHidden(true)` — nav button label carries full context | — |
| "Add Family Member" button | `"Add Family Member. Opens family member setup."` | `.isButton` |
| "FAMILY MEMBERS" section header | `.accessibilityHidden(true)` | — |
| State 6 error caption | `.accessibilityLabel("Couldn't load family members. Pull to refresh on the home screen.")` | — |

**VoiceOver announcement on profile switch:**

```swift
// Post after sheet dismisses — delay 0.3s to let dismiss animation complete
DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
    AccessibilityNotification.Announcement(
        profile.isManaged
            ? "Now viewing as \(profile.displayName)"
            : "Now viewing as yourself"
    ).post()
}
```

### Dynamic Type

- `ProfileSwitcherRow` uses `frame(minHeight: 44)` — rows grow with text at large type sizes; never `frame(height: 44)`
- `ActiveProfileBanner` uses `.lineLimit(1)` with `minimumScaleFactor(0.85)` at standard sizes; at XXXL Dynamic Type, switches to `.lineLimit(2)` using `ViewThatFits` or a `@ScaledMetric` conditional
- Profile name in `ProfileSwitcherRow` uses `.lineLimit(1)` with `.truncationMode(.tail)` as a safety net (names are capped at 30 chars by the data model)
- Sheet detent: at XXXL Dynamic Type with 3+ profiles, default to `.large` to prevent the bottom rows and "Add Family Member" button from being clipped
- `ProfileAvatarNavButton` at 32pt: avatar size does not scale with Dynamic Type (consistent with system nav bar item behavior)

### Contrast

- `PrimaryAccent` checkmark on `CardBackground`: must achieve 3:1 minimum (WCAG 1.4.11 non-text contrast)
- `PrimaryAccent` text in `ActiveProfileBanner` against `AppBackground` showing through the 10% opacity tinted banner: `PrimaryAccent` must achieve 4.5:1 against `AppBackground` for WCAG AA normal text
- Nav bar badge (`PrimaryAccent` fill): 3:1 against `AppBackground`. The `AppBackground`-colored ring around the badge ensures perceptibility regardless of the avatar color beneath it
- The 6% opacity selected row tint is purely decorative. The checkmark and `.isSelected` trait convey selection state independently of color (satisfying WCAG 1.4.1)

### Not Relying on Color Alone (WCAG 1.4.1)

Active profile row communicates selection via:
1. `checkmark.circle.fill` icon — shape and position
2. `.isSelected` accessibility trait — programmatic
3. 6% opacity tint — color (supplemental only, not sole indicator)

---

## Visual Specifications

### Spacing

| Element | Value |
|---|---|
| Sheet outer horizontal padding | 16pt |
| Sheet top padding (below drag indicator) | 20pt |
| Gap: header stack → card group | 16pt |
| Profile row internal vertical padding | 12pt top + 12pt bottom |
| Profile row minimum height | 44pt via `frame(minHeight: 44)` |
| Avatar → display name gap (in row) | 12pt |
| Row divider height | 1pt |
| "FAMILY MEMBERS" section header vertical padding | 12pt top, 4pt bottom, 16pt horizontal |
| Gap: card group → "Add Family Member" button | 16pt |
| "Add Family Member" button minimum height | 44pt |
| Gap: button → explanatory caption (State 2 only) | 8pt |
| Sheet bottom padding | 16pt + `.safeAreaInset(edge: .bottom)` |
| Nav bar avatar diameter | 32pt |
| Nav bar badge diameter | 10pt |
| Nav bar badge ring width | 1.5pt |
| `ActiveProfileBanner` internal vertical padding | 8pt |
| `ActiveProfileBanner` internal horizontal padding | 12pt |
| `ActiveProfileBanner` corner radius | 8pt |
| `ActiveProfileBanner` outer horizontal margin | 16pt |
| Gap: `ActiveProfileBanner` → content below | 12pt |

### Typography

| Element | Style | Weight | Color |
|---|---|---|---|
| Sheet title "Switch Profile" | `.title2` | `.bold` | `.primary` |
| Sheet subtitle (household name) | `.subheadline` | `.regular` | `.secondary` |
| "FAMILY MEMBERS" section header | `.caption`, `.uppercased()` | `.regular` | `.secondary` |
| Profile display name | `.body` | `.semibold` | `.primary` |
| Profile type label ("You" / "Family Member") | `.caption` | `.regular` | `.secondary` |
| State 2 explanatory caption | `.caption` | `.regular` | `.secondary` |
| State 6 error caption | `.caption` | `.regular` | `.secondary` |
| `ActiveProfileBanner` text | `.subheadline` | `.medium` | `PrimaryAccent` |
| `ActiveProfileBanner` decorative icon | 14pt system image | — | `PrimaryAccent` at 60% opacity |

### Colors

| Element | Token / Value | Notes |
|---|---|---|
| Sheet background | `AppBackground` | |
| Card group container | `CardBackground` | Wraps all rows in a section |
| Active row overlay | `PrimaryAccent` at 6% opacity | On top of `CardBackground` |
| Inactive row | No overlay | `CardBackground` only |
| Row divider | `.secondary` at 30% opacity | 1pt |
| Checkmark icon | `PrimaryAccent` full opacity | |
| "Add Family Member" button | `SecondaryButton` component styling | |
| `ActiveProfileBanner` background | `PrimaryAccent` at 10% opacity | |
| `ActiveProfileBanner` text | `PrimaryAccent` full opacity | |
| `ActiveProfileBanner` decorative icon | `PrimaryAccent` at 60% opacity | |
| Nav bar badge fill | `PrimaryAccent` full opacity | |
| Nav bar badge ring | `AppBackground` | Separates badge from avatar image |
| Loading shimmer base | `Color(.systemGray5)` | |
| Loading shimmer highlight | `Color(.systemGray4)` gradient | Slides leading → trailing |

**Dark mode:** All semantic tokens resolve automatically. In dark mode, increase the active row tint from 6% to 10% opacity for sufficient visual differentiation:

```swift
@Environment(\.colorScheme) var colorScheme

var activeRowTintOpacity: Double {
    colorScheme == .dark ? 0.10 : 0.06
}
```

---

## Integration Notes

### HomeView — Toolbar Replacement

Current state (lines 24–29 of `HomeView.swift`):
```swift
ToolbarItem(placement: .navigationBarTrailing) {
    Button("Sign Out") {
        Task { await authService.signOut() }
    }
}
```

Slice C4 replacement:
```swift
@EnvironmentObject var profileSessionManager: ProfileSessionManager
@State private var showProfileSwitcher = false

// In toolbar:
ToolbarItem(placement: .navigationBarTrailing) {
    Button {
        showProfileSwitcher = true
    } label: {
        ProfileAvatarNavButton(activeProfile: profileSessionManager.activeProfile)
    }
    .accessibilityLabel(
        profileSessionManager.isActingAsManaged
            ? "Viewing as \(profileSessionManager.activeProfile.displayName). Double-tap to switch profiles."
            : "Profile: \(profileSessionManager.activeProfile.displayName). Double-tap to switch profiles."
    )
}
.sheet(isPresented: $showProfileSwitcher) {
    ProfileSwitcherView()
        .environmentObject(profileSessionManager)
}
```

### FamilyMovieNightApp — Injection

```swift
@main
struct FamilyMovieNightApp: App {
    @StateObject private var authService = AuthService()
    @StateObject private var profileSessionManager = ProfileSessionManager(
        authenticatedUser: .placeholder
    )

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authService)
                .environmentObject(profileSessionManager)
        }
    }
}
```

`ProfileSessionManager` is initialized with `.placeholder` and updated once `GroupViewModel.loadMyGroup()` succeeds, via `profileSessionManager.updateProfiles(authenticatedUser:managedMembers:)`.

### APIClient — X-Acting-As-Member Header

Add `ProfileSessionManager` as a dependency:

```swift
class APIClient {
    private let baseURL: URL
    private let authService: AuthService
    private weak var profileSessionManager: ProfileSessionManager?

    init(
        baseURL: URL,
        authService: AuthService,
        profileSessionManager: ProfileSessionManager? = nil
    ) {
        self.baseURL = baseURL
        self.authService = authService
        self.profileSessionManager = profileSessionManager
    }

    func request<T: Decodable>(_ method: String, path: String, body: Encodable? = nil) async throws -> T {
        var urlRequest = URLRequest(url: baseURL.appendingPathComponent(path))
        urlRequest.httpMethod = method
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = authService.accessToken {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        // Attach managed member delegation header when active
        if let memberId = profileSessionManager?.actingAsMemberId {
            urlRequest.setValue(memberId, forHTTPHeaderField: "X-Acting-As-Member")
        }

        // ... rest of existing code unchanged ...
    }
}
```

Update the `HomeView.task` `APIClient` instantiation:
```swift
let client = APIClient(
    baseURL: URL(string: "https://ikg34rhjk0.execute-api.us-east-1.amazonaws.com")!,
    authService: authService,
    profileSessionManager: profileSessionManager
)
```

### GroupViewModel — updateProfiles Trigger

After `loadMyGroup()` returns successfully, call into `ProfileSessionManager`:

```swift
// In GroupViewModel.loadMyGroup(), after group data is loaded:
let authenticatedUser = SwitchableProfile.from(
    group.members.first(where: { $0.userId == currentUserId })!,
    isAuthenticatedUser: true
)
let managedMembers = group.members
    .filter { ($0.isManaged == true) && ($0.parentUserId == currentUserId) }
    .map { SwitchableProfile.from($0, isAuthenticatedUser: false) }

profileSessionManager.updateProfiles(
    authenticatedUser: authenticatedUser,
    managedMembers: managedMembers
)
```

`GroupViewModel` must hold a weak reference to `profileSessionManager`, passed in via `configure(...)` alongside `apiClient` and `currentUserId`.

### VotingView — "Voting as [Name]"

Per US-42: "A 'Voting as [Name]' caption is shown on the voting screen when acting as a managed member."

Integration in `VotingView`:

```swift
// Add to VotingView:
@EnvironmentObject var profileSessionManager: ProfileSessionManager

// In body, wrap the existing List in a VStack:
VStack(spacing: 0) {
    if profileSessionManager.isActingAsManaged {
        ActiveProfileBanner(
            context: .voting,
            name: profileSessionManager.activeProfile.displayName,
            avatarKey: profileSessionManager.activeProfile.avatarKey
        )
        .padding(.top, 8)
    }
    List {
        // existing List content unchanged
    }
}
```

Update the vote progress label to include context when acting as a managed member:
```swift
let progressText: String = {
    let base = "\(progress.voted) of \(progress.total) voted"
    if profileSessionManager.isActingAsManaged {
        return "Voting as \(profileSessionManager.activeProfile.displayName) — \(base)"
    }
    return base
}()
```

Also update `VotingCard`'s `currentVote` resolution to use `profileSessionManager.activeProfile.memberId` instead of `currentUserId` so the active member's existing votes are correctly highlighted when the profile switches mid-voting.

`VotingViewModel.submitVote(...)` itself requires no changes — `APIClient` attaches the header automatically.

### PreferencesView

When acting as a managed member:
1. `ActiveProfileBanner(context: .preferences, name: ...)` renders at top
2. `PreferencesViewModel` must pass `?member_id=<managed_id>` on `GET/PUT /groups/{group_id}/preferences` (requires Slice C3 backend)
3. For Slice C4 pre-C3 state: the `memberId` parameter can be wired into the ViewModel without the backend having it yet; existing behavior (preferences attributed to authenticated user) remains until C3 lands

### RatingView — Distinction from ActiveProfileBanner

`RatingView` (specified in `rating-selector-view.md`) uses the smaller "Rating as [Name]" pill — a compact, inline component below the rating cards. That is a different component from `ActiveProfileBanner`, which is the full-width variant used on persistent-context screens.

- `ActiveProfileBanner`: full-width, prominent, `ActiveProfileBanner.swift`
- "Rating as [Name]" pill: compact, inline, rendered directly in `RatingView`

Both use `PrimaryAccent` tinting at different sizes and emphasis levels. They are intentionally separate components.

`RatingViewModel.activeProfileName` (already specified) is populated from `profileSessionManager.activeProfile.displayName` when `isActingAsManaged == true`.

### Add Managed Member (Slice C5 Bridge)

"Add Family Member" button is present and styled in Slice C4. Before Slice C5 exists:
- Button is present and tappable
- Tapping it dismisses the switcher and presents a "Coming Soon" placeholder state or is temporarily disabled

After Slice C5:
- `AddManagedMemberView` presented on tap
- On successful creation: `GroupViewModel.loadMyGroup()` is called → `updateProfiles(...)` fires → new managed member appears in the switcher immediately on next open

### Offline Behavior

Profile switching is fully available offline — it is synchronous and in-memory. When the device is offline (per `sync-and-offline.md`):
- `ProfileSwitcherView` opens with cached profiles from the last successful `loadMyGroup()`
- Switching profiles succeeds locally
- Subsequent API calls fail for normal offline reasons, independently of the profile context
- When both the offline banner and `ActiveProfileBanner` are visible on the same screen, they stack vertically with 8pt gap between them
- `ProfileAvatarNavButton` remains tappable offline

---

## Preview Variants

### ProfileSwitcherView

| # | Variant | Notes |
|---|---|---|
| 1 | Light mode — State 2 (no managed members) | Explanatory caption visible; "Add Family Member" prominent |
| 2 | Dark mode — State 2 | Verify `CardBackground` and `AppBackground` token resolution |
| 3 | Light mode — State 3, authenticated user active (1 managed member) | Checkmark on "You" row |
| 4 | Light mode — State 3, managed member active (1 managed member) | Checkmark on managed member row; tinted background |
| 5 | Light mode — State 3, three managed members | Tests `.large` detent trigger |
| 6 | Light mode — State 1 (loading) | Shimmer skeleton rows |
| 7 | Light mode — State 6 (error) | Error caption, no managed rows, no "Add" button |
| 8 | XXXL Dynamic Type — State 3 (1 managed member) | Rows grow; names truncate cleanly |

### ProfileAvatarNavButton

| # | Variant | Notes |
|---|---|---|
| 1 | Light mode — authenticated user active | No badge |
| 2 | Light mode — managed member active | `PrimaryAccent` badge at bottom-right |
| 3 | Dark mode — managed member active | Badge ring against dark `AppBackground` |

### ProfileSwitcherRow

| # | Variant | Notes |
|---|---|---|
| 1 | Authenticated user, active | Checkmark, tint background |
| 2 | Authenticated user, inactive | No checkmark, plain background |
| 3 | Managed member, active | "Family Member" label, checkmark |
| 4 | Managed member, inactive | "Family Member" label, no checkmark |
| 5 | Long display name (30 chars) | Truncation test — should show `…` cleanly |

### ActiveProfileBanner

| # | Variant | Notes |
|---|---|---|
| 1 | Light mode — "Voting as Max" | Standard |
| 2 | Dark mode — "Voting as Max" | Verify `PrimaryAccent` on dark `AppBackground` |
| 3 | XXXL Dynamic Type | Banner may need to wrap to 2 lines |
| 4 | Light mode — "Setting preferences for Max" | Longer label; tests width |

---

## Open Questions and Recommendations

### OQ-1: Sheet Detent Breakpoint

**Question:** Should the `.medium` to `[.medium, .large]` transition be at exactly 3 profiles, or calculated dynamically from row heights?

**Recommendation:** Fixed breakpoint at 3 total profiles. Dynamic height calculation is fragile with `presentationDetents`. At 3 profiles, `.medium` comfortably shows the header, all three rows, and "Add Family Member". At 4+, `.medium` would require scrolling; offering `.large` as an option is the right affordance.

**Default:** `[.medium]` for ≤ 3 profiles; `[.medium, .large]` for ≥ 4 profiles.

### OQ-2: Sign Out Location (Slice C4 Interim)

**Question:** Removing the "Sign Out" button from the nav bar leaves no immediate way to sign out.

**Recommendation:** For Slice C4, add "Sign Out" as a de-emphasized text button at the very bottom of `ProfileSwitcherView`, below "Add Family Member". Style it as `.caption .foregroundStyle(.secondary)` with no button chrome — a footnote, not an action. This prevents accidental sign-outs while keeping the escape hatch accessible.

**Default for C4:** Sign Out in sheet footer, de-emphasized. Move to a proper Settings screen in a future slice.

### OQ-3: Maximum Managed Members in the Switcher

**Question:** In an 8-member household where one user controls 7 managed members, how does the switcher handle 8 rows?

**Recommendation:** No UI cap. With 8 profiles, the sheet scrolls naturally at `.large` detent. The household member cap (8 total) prevents runaway growth.

**Default:** No arbitrary UI cap; rely on the household member cap.

### OQ-4: Switching Profiles While VotingView Is Pushed

**Question:** If `VotingView` is pushed into the navigation stack (not a sheet), the nav bar is visible and the user can switch profiles mid-vote. Is this intentional?

**Recommendation:** Yes — mid-vote profile switching is intentional. A parent can vote as themselves, then switch to a managed member and vote for them on the same screen. `VotingView` observes `profileSessionManager.activeProfile` reactively; `ActiveProfileBanner` updates immediately. `VotingViewModel` does not reload. The key fix: resolve the "current voter" ID for vote highlighting from `profileSessionManager.activeProfile.memberId` (not the static `currentUserId` parameter), so switching profiles mid-voting correctly highlights the new active member's existing votes.

**Default:** Mid-voting profile switching supported. Update `VotingView` to derive the current voter ID from `profileSessionManager.activeProfile.memberId`.

### OQ-5: Avatar Fallback for Missing or Unrecognized avatarKey

**Question:** What does `ProfileAvatarView` render when `avatarKey` is empty, null, or unrecognized?

**Recommendation:** `ProfileAvatarView` renders a monogram fallback — a circle filled with `CardBackground` containing the first letter of `displayName` in `.title3 .semibold`. This is a prerequisite for C4 to be testable; the monogram fallback must exist before profile switching is implemented.

**Default:** Monogram fallback in `ProfileAvatarView`. Required as part of Slice C4 scope.

### OQ-6: Avatar Crossfade Timing Relative to Sheet Dismiss

**Question:** Should the nav bar avatar animate immediately when `switchProfile()` is called, or wait until the sheet fully dismisses?

**Recommendation:** Wait 0.2s after `dismiss()` before starting the avatar crossfade. This prevents the avatar and sheet animations from visually competing. The 0.2s delay is imperceptible to users but prevents the "two things animating at once" visual noise.

**Default:** Avatar crossfade starts 0.2s after `dismiss()`.

---

## Quality Checklist

- [x] US-42 all acceptance criteria addressed (avatar from top-right nav bar; shows authenticated user + managed members only; spring animation; no app reload; VoiceOver announcement; "Voting as [Name]" shown)
- [x] US-25 acceptance criteria for managed member appearance in profile switcher addressed
- [x] Flow 12 all steps mapped to component behaviors
- [x] `ProfileSessionManager` fully specified with published state, derived values, and public API
- [x] `SwitchableProfile` model fully specified with factory method and placeholder
- [x] All four core states defined for `ProfileSwitcherView` (loading, single profile, multiple profiles, error)
- [x] State 5 (managed member removed mid-session) explicitly handled
- [x] No screen has more than two primary actions
- [x] All tap targets >= 44pt (`frame(minHeight: 44)` on rows; `.contentShape(Rectangle())` on nav button)
- [x] Color usage only references semantic tokens (`AppBackground`, `CardBackground`, `PrimaryAccent`)
- [x] Typography only uses the defined hierarchy (no hardcoded sizes)
- [x] Dark mode addressed (active row tint opacity adjusts 6% → 10% in dark mode)
- [x] Dynamic Type addressed (`minHeight` not fixed height; `ViewThatFits` for banner; detent adjustment at XXXL)
- [x] VoiceOver labels specified for all interactive elements
- [x] VoiceOver announcement on profile switch specified (with 0.3s delay rationale)
- [x] Reduce Motion behavior specified for all animated elements
- [x] Haptics specified with generator type, style, and trigger
- [x] Spring animation parameters specified (response, dampingFraction) for all animations
- [x] Components extracted — `ProfileAvatarNavButton`, `ProfileSwitcherView`, `ProfileSwitcherRow`, `ActiveProfileBanner` are distinct components; no one-off inline duplication
- [x] `ProfileSessionManager` is explicitly separate from `AuthService`
- [x] `APIClient` `X-Acting-As-Member` header injection specified with code
- [x] `HomeView` toolbar replacement specified with code
- [x] `FamilyMovieNightApp` injection pattern specified
- [x] `GroupViewModel.loadMyGroup()` → `updateProfiles()` trigger specified
- [x] `VotingView` "Voting as [Name]" integration specified with code
- [x] `PreferencesView` integration specified
- [x] `RatingView` distinction from `ActiveProfileBanner` clarified (different components, different emphasis)
- [x] "Add Family Member" bridged to Slice C5 with graceful fallback
- [x] Offline behavior addressed
- [x] Sign Out relocation addressed for Slice C4 interim and long-term
- [x] Preview variants listed for all new components
- [x] Open questions surfaced with recommended defaults
- [x] COPPA note: profile switching uses member IDs only; no email, Apple ID, or device identifiers are involved; no new data collected for managed members through this feature
- [x] `ProfileAvatarView` `.xsmall` size extension noted as prerequisite
- [x] Monogram avatar fallback noted as prerequisite
