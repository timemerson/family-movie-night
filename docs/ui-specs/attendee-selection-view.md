# AttendeeSelectionView — UI Specification

**Version:** 1.0
**Status:** Ready for Implementation
**Slice:** C6 (Attendee Selection UI — iOS)
**Related Stories:** US-43 (select attendees), US-44 (anyone can start)
**Related Flows:** Flow 5 step 1, Flow 7 step 2, Flow 6 step 1
**Related API:** `POST /groups/{group_id}/rounds` with `attendees[]`
**Depends On:** C2 (attendees backend), C4 (ProfileSessionManager — active profile context)
**Implements:** `AttendeeSelectionView` + `AttendeeSelectionViewModel` + `AttendeeRowView`

---

## Overview

`AttendeeSelectionView` is the first step in the movie night initiation flow — shown immediately after any household member taps "Pick Tonight's Movie." It presents a checklist of all household members and lets the initiating member select who is physically present for movie night. The selected subset is sent as `attendees[]` in `POST /groups/{group_id}/rounds`, scoping the suggestion algorithm and vote progress denominator to the chosen attendees.

This is a focused, single-purpose screen. It should feel quick and low-friction — the typical family will confirm the default (all members checked) and tap "Next" in under five seconds. The screen must not feel like bureaucracy.

**Key behaviors:**
- All household members are pre-checked by default (US-43)
- Minimum 2 attendees required; "Next" is disabled below this threshold
- Any household member can initiate — not creator-only (US-44)
- Both independent and managed members are selectable
- When acting as a managed member via profile switching, that member is the `started_by` on the round

---

## UX Flows

### Flow: Attendee Selection to Round Creation

**Entry point:** Any household member taps "Pick Tonight's Movie" from `GroupDetailView`.

```
GroupDetailView
  |
  +-- Tap "Pick Tonight's Movie"
        |
        [?] Is there an active voting round?
        |
        +-- Yes  -> Skip to VotingView (active round resume -- not in this spec)
        |
        +-- No   -> Navigate to AttendeeSelectionView
                      |
                      +-- [State] Loading: fetch group members if needed
                      |
                      +-- [State] Populated: member checklist, all pre-checked
                      |
                      +-- User adjusts selection
                      |   (toggle individuals, or "All" / "None" shortcuts)
                      |
                      +-- [Validation] selectedCount >= 2?
                      |   +-- No  -> "Next" disabled; inline helper visible
                      |   +-- Yes -> "Next" enabled
                      |
                      +-- User taps "Next"
                            |
                            +-- Navigate to StartRoundView(selectedAttendeeIds)
                                  |
                                  +-- [System] POST /groups/{group_id}/rounds
                                  |          { attendees: [...ids] }
                                  |
                                  +-- [Success]  -> VotingView(roundId)
                                  +-- [409]      -> Error: active round exists
                                  +-- [422]      -> Error: insufficient preferences
                                  +-- [net/5xx]  -> Error: connection failed
```

**Exit points:**
- Forward: `VotingView` on successful round creation
- Back: `GroupDetailView` — system back button; selection state discarded
- Error (load failure): stays on `AttendeeSelectionView`
- Error (round creation): stays on `StartRoundView`

---

## Screen Inventory

| Component | Purpose | Entry Points | Exit Points | Primary Action |
|---|---|---|---|---|
| `AttendeeSelectionView` | Select tonight's attending household members | "Pick Tonight's Movie" CTA in `GroupDetailView` | Forward to `StartRoundView`; back to `GroupDetailView` | Tap "Next" |
| `AttendeeRowView` | Single selectable member row with avatar, name, badges, and checkmark | Embedded in `AttendeeSelectionView` | N/A — embedded | Toggle attendance |
| `AttendeeSelectionViewModel` | Member fetch, selection state, validation, ordering | Owned by `AttendeeSelectionView` | N/A — view model | Manage selection; expose `canProceed` |

---

## Screen Specifications

### Screen: AttendeeSelectionView

**Purpose:** Let any household member choose who is physically present for tonight's movie night before generating movie suggestions and creating a voting round.

**Presentation:** Pushed onto `NavigationStack` from `GroupDetailView`
**Navigation title:** "Who's Watching Tonight?" — `.navigationBarTitleDisplayMode(.inline)`
**Primary action:** "Next"
**Secondary action:** None (back navigation is system default)
**ViewModel:** `AttendeeSelectionViewModel`

#### Layout — Populated State (default on appear)

```
+----------------------------------------------------------+
|  < Back    Who's Watching Tonight?                       |  NavigationBar (.inline)
+----------------------------------------------------------+
|                                                          |
|  16pt                                                    |
|                                                          |
|  Select who's here for movie night.                      |  .body, .secondary
|  Suggestions will be tailored to your group.            |  16pt H padding
|                                                          |
|  12pt                                                    |
|                                                          |
|  +----------------------------------------------------+  |  CardBackground
|  |  ATTENDING (3 of 4)         [All]     [None]      |  |  radius 16, 16pt padding
|  |  ------------------------------------------       |  |
|  |  [Av]  Tim          [You]  [check.circle.fill]   |  |  Locked row
|  |  - - - - - - - - - - - - - - - - - - - - - - -   |  |  Divider (inset 44pt)
|  |  [Av]  Sarah               [check.circle.fill]   |  |
|  |  - - - - - - - - - - - - - - - - - - - - - - -   |  |
|  |  [Av]  Max       [Managed] [check.circle.fill]   |  |
|  |  - - - - - - - - - - - - - - - - - - - - - - -   |  |
|  |  [Av]  Grandma             [circle            ]  |  |  Unselected row
|  +----------------------------------------------------+  |
|                                                          |
|  12pt                                                    |
|                                                          |
|  [!] Select at least 2 people to start movie night.     |  .caption, WarningAccent
|      (hidden when selectedCount >= 2; fades in/out)      |
|                                                          |
|  Spacer (flexible)                                       |
|                                                          |
|  +----------------------------------------------------+  |  PrimaryButton
|  |                     Next                           |  |  disabled when count < 2
|  +----------------------------------------------------+  |
|  16pt + safeAreaInsets.bottom                            |
+----------------------------------------------------------+
```

**Screen background:** `Color("AppBackground")`

**Instruction text:**
- Content: "Select who's here for movie night. Suggestions will be tailored to your group."
- Style: `.body`, `.secondary`
- Padding: 16pt horizontal
- Wraps naturally at XXXL Dynamic Type

**Attendee card:**
- Background: `Color("CardBackground")`
- Corner radius: 16pt
- Internal padding: 16pt all sides
- No shadow
- 16pt from screen edges on both sides

**Card header row (`HStack`):**
- Left: `Text("ATTENDING (\(selectedCount) of \(totalCount))")`
  - Style: `.caption .semibold`
  - Color: `.secondary` (normal) / `Color("WarningAccent")` (when `selectedCount < 2`)
  - Count change: `.contentTransition(.numericText()).animation(.easeInOut(duration: 0.2), value: selectedCount)`
- Right: `Text("All")` and `Text("None")` — `.caption .regular`, `.tint` color, 12pt gap between them
- "All" dims to `.opacity(0.4)` when all members are already selected
- "None" dims to `.opacity(0.4)` when only the locked active user remains
- Row minimum height: 44pt (ensures "All"/"None" meet tap target)
- Below header: `Divider()` with `.padding(.top, 8)`

**Member list:**
- `VStack(spacing: 0)` of `AttendeeRowView` items
- `Divider()` between rows with `.padding(.leading, 44)` inset (past avatar column)
- Custom card layout — not a `List` — to maintain `CardBackground` and radius
- Member ordering: active user first, other independents alphabetically, managed members alphabetically
- Scrollable: wrapping `VStack` in a `ScrollView` at screen level handles XXXL Dynamic Type overflow

**Minimum helper text:**
- `HStack(spacing: 6)`: `Image(systemName: "exclamationmark.circle")` + `Text("Select at least 2 people to start movie night.")`
- Style: `.caption`, `Color("WarningAccent")`
- 16pt horizontal padding
- Visibility: `.opacity(viewModel.selectedCount < 2 ? 1.0 : 0.0)`
- Animation: `.animation(.easeInOut(duration: 0.2), value: viewModel.selectedCount < 2)`

**"Next" button:**
- `PrimaryButton` with label "Next"
- State: disabled when `!viewModel.canProceed` — renders at `.opacity(0.4)` per `PrimaryButton` standard
- Horizontal padding: 16pt
- Bottom: 16pt + `safeAreaInsets.bottom`
- On tap (enabled): fires `onProceed(Array(viewModel.selectedMemberIds))`

---

## Component Library

### Existing Components Used

| Component | Usage in this spec |
|---|---|
| `ProfileAvatarView` | 36pt member avatar in `AttendeeRowView` |
| `PrimaryButton` | "Next" CTA at screen bottom |

Note: `MemberChip` is NOT used here. `MemberChip` is a compact inline display token; `AttendeeRowView` is the full-row selection variant appropriate for this checklist context.

### New Components Required

#### AttendeeRowView

**File:** `ios/FamilyMovieNight/Features/Rounds/AttendeeRowView.swift`

**Purpose:** Single selectable row in the attendee checklist. Displays avatar, display name, contextual type badges ("You", "Managed"), and a checkmark indicator. Structurally parallel to `RatingMemberRowView` from the rating spec — adapted for a toggle selection interaction rather than read-only display.

**Props:**
```swift
struct AttendeeRowView: View {
    let member: GroupMember
    let isSelected: Bool
    let isActiveUser: Bool   // true = this is the authenticated user or active managed profile
    let isLocked: Bool       // true = row cannot be deselected; always equals isActiveUser
    let onToggle: () -> Void
}
```

**Visual Description:**

`HStack(spacing: 12)` with `.frame(minHeight: 44)` and `.padding(.vertical, 10)`:

- **Left:** `ProfileAvatarView(avatarKey: member.avatarKey, size: .small)` — 36pt diameter
- **Center:** `VStack(alignment: .leading, spacing: 2)`:
  - `Text(member.displayName)` — `.body`, `.primary`, `.lineLimit(1)`, `.truncationMode(.tail)`
  - Badges `HStack(spacing: 4)` — rendered only when `isActiveUser || member.isManaged`:
    - **"You" badge** (when `isActiveUser`): `Text("You")` at `.caption2 .semibold`, `Color("PrimaryAccent")` foreground, `Color("PrimaryAccent").opacity(0.10)` background, `cornerRadius(4)`, padding `.init(horizontal: 6, vertical: 2)`
    - **"Managed" badge** (when `member.isManaged`): `Text("Managed")` at `.caption2 .regular`, `.secondary` foreground, `Color(.systemGray5)` background, same corner radius and padding as "You" badge
    - Both badges can coexist (active managed profile shows both)
- **Spacer()**
- **Right:** Checkmark at `.title3` (22pt):
  - Selected or locked: `Image(systemName: "checkmark.circle.fill")` in `Color("PrimaryAccent")`
  - Unselected: `Image(systemName: "circle")` in `Color(.systemGray3)`
  - `@State private var checkmarkScale: CGFloat = 1.0` applied to the checkmark icon only

**Interaction Behavior:**
- `.contentShape(Rectangle())` on the full `HStack` — entire row is tappable
- When `!isLocked`: `.onTapGesture { onToggle() }`
- When `isLocked`: `.onTapGesture { UIImpactFeedbackGenerator(style: .rigid).impactOccurred() }` — signals the lock intentionally without ignoring the tap
- Checkmark icon/color transition: `.animation(.spring(response: 0.25, dampingFraction: 0.7), value: isSelected)`
- Scale punch on selection (`isSelected` becomes `true`):
  ```swift
  .onChange(of: isSelected) { _, newValue in
      guard newValue else { return }
      withAnimation(.spring(response: 0.18, dampingFraction: 0.5)) {
          checkmarkScale = 1.2
      }
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
          withAnimation(.spring(response: 0.22, dampingFraction: 0.7)) {
              checkmarkScale = 1.0
          }
      }
  }
  ```
- Deselection: spring transition only — no scale punch

**Variants:**

| Variant | Badges shown | Checkmark | Tappable |
|---|---|---|---|
| Independent, unselected | None | Open circle | Yes |
| Independent, selected | None | Filled check | Yes |
| Active user, locked | "You" | Filled check | No (warning haptic) |
| Managed, unselected | "Managed" | Open circle | Yes |
| Managed, selected | "Managed" | Filled check | Yes |
| Active managed profile, locked | "You" + "Managed" | Filled check | No (warning haptic) |

**Accessibility:**
```swift
.accessibilityElement(children: .ignore)
.accessibilityLabel({
    var label = member.displayName
    if isActiveUser { label += ", you" }
    if member.isManaged { label += ", managed profile" }
    label += isSelected ? ", attending" : ", not attending"
    if isLocked { label += ". Required attendee." }
    return label
}())
.accessibilityAddTraits(isLocked ? [] : .isButton)
.accessibilityHint(
    isLocked
        ? "You must be attending to start movie night."
        : (isSelected
            ? "Double-tap to remove from tonight's movie night."
            : "Double-tap to add to tonight's movie night.")
)
```

---

#### AttendeeSelectionViewModel

**File:** `ios/FamilyMovieNight/Features/Rounds/AttendeeSelectionViewModel.swift`

**Purpose:** Manages the attendee checklist state. Accepts pre-populated members from the caller (to avoid a redundant API call) and falls back to fetching if members are unavailable. Does not call `POST /groups/{group_id}/rounds` — it passes the selected IDs to `StartRoundView` via the `onProceed` closure.

```swift
@MainActor
class AttendeeSelectionViewModel: ObservableObject {

    // MARK: - Published State
    @Published var members: [GroupMember] = []
    @Published var selectedMemberIds: Set<String> = []
    @Published var isLoading: Bool = false
    @Published var error: String? = nil

    // MARK: - Derived
    var selectedCount: Int { selectedMemberIds.count }
    var totalCount: Int { members.count }
    var canProceed: Bool { selectedCount >= 2 }
    var selectedMembers: [GroupMember] {
        members.filter { selectedMemberIds.contains($0.userId) }
    }

    // MARK: - Private
    private(set) var activeUserId: String = ""
    private var groupId: String = ""
    private var apiClient: APIClient?

    // MARK: - Preferred Initializer (avoids redundant GET /groups/{id} call)
    init(members: [GroupMember], activeUserId: String, groupId: String) {
        self.activeUserId = activeUserId
        self.groupId = groupId
        self.members = Self.sorted(members, activeUserId: activeUserId)
        self.selectedMemberIds = Set(members.map { $0.userId })  // all pre-checked
    }

    // MARK: - Deferred Configuration
    func configure(apiClient: APIClient, groupId: String, activeUserId: String) {
        self.apiClient = apiClient
        if self.groupId.isEmpty { self.groupId = groupId }
        if self.activeUserId.isEmpty { self.activeUserId = activeUserId }
    }

    // MARK: - API (fallback when members array is empty)
    func loadMembers() async {
        guard let apiClient else { return }
        isLoading = true
        error = nil
        do {
            let group: Group = try await apiClient.request("GET", path: "/groups/\(groupId)")
            let sorted = Self.sorted(group.members, activeUserId: activeUserId)
            self.members = sorted
            self.selectedMemberIds = Set(sorted.map { $0.userId })
            isLoading = false
        } catch {
            isLoading = false
            self.error = "Couldn't load members. Check your connection and try again."
        }
    }

    // MARK: - Selection Management
    func toggle(memberId: String) {
        guard memberId != activeUserId else {
            UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
            return
        }
        withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
            if selectedMemberIds.contains(memberId) {
                selectedMemberIds.remove(memberId)
            } else {
                selectedMemberIds.insert(memberId)
            }
        }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        postCountAnnouncement()
    }

    func selectAll() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        for (index, member) in members.enumerated() {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(index) * 0.03) {
                withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
                    self.selectedMemberIds.insert(member.userId)
                }
            }
        }
        postCountAnnouncement()
    }

    func deselectAll() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        let locked = activeUserId
        for (index, member) in members.enumerated() {
            guard member.userId != locked else { continue }
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(index) * 0.03) {
                withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
                    self.selectedMemberIds.remove(member.userId)
                }
            }
        }
        postCountAnnouncement()
    }

    func isSelected(_ memberId: String) -> Bool { selectedMemberIds.contains(memberId) }
    func isLocked(_ memberId: String) -> Bool { memberId == activeUserId }

    // MARK: - Private Helpers
    private static func sorted(_ members: [GroupMember], activeUserId: String) -> [GroupMember] {
        let active = members.filter { $0.userId == activeUserId }
        let indep  = members.filter { $0.userId != activeUserId && !$0.isManaged }
                            .sorted { $0.displayName < $1.displayName }
        let managed = members.filter { $0.isManaged }
                             .sorted { $0.displayName < $1.displayName }
        return active + indep + managed
    }

    private func postCountAnnouncement() {
        AccessibilityNotification.Announcement(
            "\(selectedMemberIds.count) of \(members.count) attending"
        ).post()
    }
}
```

---

## State Definitions

### AttendeeSelectionView States

#### State 1: Loading

**Trigger:** `AttendeeSelectionView` appears and `members` is empty (no pre-populated data from `GroupViewModel`).

**What the user sees:**
- Navigation title and instruction text visible immediately
- Attendee card: correct background and corner radius; member rows replaced by 4 shimmer skeleton rows
  - Each skeleton: `RoundedRectangle(cornerRadius: 8).fill(Color(.systemGray5))` at `frame(minHeight: 44)`
  - Shimmer overlay: `LinearGradient` from `.clear` to `Color(.systemGray4).opacity(0.6)` to `.clear`, `startPoint` animated from `.leading` to `.trailing` over 1.2s, repeating
  - Reduce Motion: static `Color(.systemGray5)` fill, no animation
- Card header: "ATTENDING" label shown; count shown as "— of —" or hidden; "All"/"None" hidden
- "Next" button: visible but disabled

**Available actions:** Back navigation

**Transition out:** `.animation(.easeInOut(duration: 0.25), value: isLoading)` crossfade — skeletons fade out, real rows fade in

---

#### State 2: All Selected (default on load)

**Trigger:** Members loaded; `selectedMemberIds` contains all member IDs. This is the state on every fresh appearance.

**What the user sees:**
- Card header: "ATTENDING (4 of 4)" — "All" dimmed (`.opacity(0.4)`), "None" full opacity
- All rows show `checkmark.circle.fill` in `PrimaryAccent`
- Minimum helper text hidden
- "Next" enabled

**Available actions:** Deselect individual rows, tap "None", tap "Next"

---

#### State 3: Partial Selection (2 or more, not all)

**Trigger:** User has deselected one or more members; `selectedCount` is between 2 and `totalCount - 1`.

**What the user sees:**
- Card header count updates with `.contentTransition(.numericText())`
- "All" full opacity; "None" full opacity
- Deselected rows show `circle` in `Color(.systemGray3)`
- Minimum helper hidden
- "Next" enabled

**Available actions:** Toggle rows, "All", "None", "Next"

---

#### State 4: Below Minimum (fewer than 2 selected)

**Trigger:** `selectedCount < 2`. Reachable when the only non-locked member is deselected (possible in a 2-member household, or after tapping "None").

**What the user sees:**
- Card header: "ATTENDING (1 of N)" — header text color transitions to `Color("WarningAccent")` with `.animation(.easeInOut(duration: 0.2), value: selectedCount < 2)`
- Minimum helper text fades in: `Image(systemName: "exclamationmark.circle") + Text("Select at least 2 people to start movie night.")` in `.caption`, `WarningAccent`
- "Next" at `.opacity(0.4)`, non-interactive

**Available actions:** Toggle members, tap "All"

**Transition to valid state:** On selecting a second member, helper fades out, header color animates back to `.secondary`, "Next" enables — all via `value: selectedCount < 2` animation driver

---

#### State 5: Error — Members Failed to Load

**Trigger:** `loadMembers()` returns a network or API error.

**What the user sees:**
- Attendee card content area shows inline error (replaces skeleton rows):
  ```
  +------------------------------------------------+
  |  [wifi.slash]  (.title2, .secondary)            |
  |  Couldn't Load Members  (.body .semibold)        |
  |  Check your connection and try again.            |
  |  (.caption .secondary)                          |
  |  [   Try Again   ]  (SecondaryButton)           |
  +------------------------------------------------+
  ```
- "Next" remains disabled
- Haptic: `UINotificationFeedbackGenerator().notificationOccurred(.error)` on entry

**Available actions:** "Try Again" calls `viewModel.loadMembers()`

---

#### State 6: Error — Round Creation Failed

**Trigger:** `POST /groups/{group_id}/rounds` returns an error. This error is owned by `StartRoundView` / `VotingViewModel`. If the navigation stack returns to `AttendeeSelectionView`, an optional error binding surfaces the message here.

**What the user sees:**
- Full member list shown (already loaded)
- Inline error banner below the card:
  `HStack(spacing: 6)`: `Image(systemName: "exclamationmark.circle")` in `WarningAccent` + `Text(errorMessage)` at `.caption`, `WarningAccent`, 16pt horizontal padding
- "Next" remains enabled (user can retry with same or adjusted selection)
- Haptic: `UINotificationFeedbackGenerator().notificationOccurred(.error)` on entry
- Auto-dismisses after 8 seconds or when the user changes the selection

**Error messages by status code:**

| Code | Message |
|---|---|
| 409 | "A voting round is already active for this household." |
| 422 | "Some attendees haven't set their movie preferences yet. Ask them to set preferences before starting." |
| 400 | "Something went wrong with the attendee list. Try again." |
| Network / 500 | "Couldn't connect. Check your connection and try again." |

**Available actions:** Adjust selection, tap "Next" to retry

---

## Interaction Details

### Haptics

| Trigger | Generator | Style |
|---|---|---|
| Toggle non-locked member row | `UIImpactFeedbackGenerator` | `.light` |
| Tap "All" shortcut | `UIImpactFeedbackGenerator` | `.medium` |
| Tap "None" shortcut | `UIImpactFeedbackGenerator` | `.medium` |
| Tap locked (active user) row | `UIImpactFeedbackGenerator` | `.rigid` |
| Tap "Next" with valid selection | `UIImpactFeedbackGenerator` | `.medium` |
| Error state entered | `UINotificationFeedbackGenerator` | `.error` |

All generators initialized lazily. Only fire on `UIDevice.current.userInterfaceIdiom == .phone`.

### Animations

#### Row Checkmark Toggle

```swift
// In AttendeeRowView — @State private var checkmarkScale: CGFloat = 1.0
.onChange(of: isSelected) { _, newValue in
    guard newValue else { return }
    withAnimation(.spring(response: 0.18, dampingFraction: 0.5)) {
        checkmarkScale = 1.2
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
        withAnimation(.spring(response: 0.22, dampingFraction: 0.7)) {
            checkmarkScale = 1.0
        }
    }
}
// Applied to checkmark image only:
.scaleEffect(checkmarkScale)

// Background color / icon swap:
.animation(.spring(response: 0.25, dampingFraction: 0.7), value: isSelected)
```

Deselection: spring icon swap only — no scale punch.

#### "All" / "None" Cascade Animation

```swift
// selectAll() in AttendeeSelectionViewModel:
for (index, member) in members.enumerated() {
    DispatchQueue.main.asyncAfter(deadline: .now() + Double(index) * 0.03) {
        withAnimation(.spring(response: 0.25, dampingFraction: 0.7)) {
            self.selectedMemberIds.insert(member.userId)
        }
    }
}
```

Maximum cascade duration with 8 members: 240ms. Fast but perceptibly staggered.

#### Header Count Transition

```swift
Text("ATTENDING (\(viewModel.selectedCount) of \(viewModel.totalCount))")
    .contentTransition(.numericText())
    .animation(.easeInOut(duration: 0.2), value: viewModel.selectedCount)
```

#### Minimum Helper Text

```swift
Group {
    if viewModel.selectedCount < 2 {
        HStack(spacing: 6) {
            Image(systemName: "exclamationmark.circle")
            Text("Select at least 2 people to start movie night.")
        }
        .font(.caption)
        .foregroundStyle(Color("WarningAccent"))
        .padding(.horizontal, 16)
        .transition(.opacity.combined(with: .move(edge: .top)))
    }
}
.animation(.easeInOut(duration: 0.2), value: viewModel.selectedCount < 2)
```

#### "Next" Enable / Disable

```swift
.animation(.easeInOut(duration: 0.2), value: viewModel.canProceed)
```

#### Reduce Motion

Check `@Environment(\.accessibilityReduceMotion) var reduceMotion`. When `true`:
- Replace checkmark scale punch with `.opacity(0.6)` to `.opacity(1.0)`, no spring
- Replace cascade with single simultaneous `.easeInOut(duration: 0.15)` transition
- Disable shimmer — static `Color(.systemGray5)` fill
- Replace all `.spring` with `.easeInOut(duration: 0.2)`

---

## Accessibility

### Dynamic Type

- All text uses semantic styles — no hardcoded sizes
- `AttendeeRowView` height: `frame(minHeight: 44)` — grows with content
- At XXXL Dynamic Type, display name uses `.lineLimit(1)` and truncates with `...`; badges fall to the `VStack` line below; row height grows to accommodate. This is acceptable.
- Card header at XXXL: use `ViewThatFits` to collapse "All"/"None" labels to icon-only buttons if the `HStack` overflows:
  ```swift
  ViewThatFits(in: .horizontal) {
      HStack { headerLabel; Spacer(); allTextButton; noneTextButton }
      HStack { headerLabel; Spacer(); allIconButton; noneIconButton }
  }
  ```
  Icon-only fallback: `Image(systemName: "checkmark.square")` for "All", `Image(systemName: "square")` for "None"

### VoiceOver Labels

| Element | Label | Traits |
|---|---|---|
| Nav title | "Who's Watching Tonight?" | (automatic from `.navigationTitle`) |
| Instruction text | "Select who's here for movie night. Suggestions will be tailored to your group." | `.isStaticText` |
| Card header | `"\(selectedCount) of \(totalCount) members attending"` | `.isHeader` |
| "All" button | `"Select all members"` | `.isButton` |
| "None" button | `"Deselect all members"` | `.isButton` |
| Row — unselected, independent | `"[Name], not attending. Double-tap to add to tonight's movie night."` | `.isButton` |
| Row — selected, independent | `"[Name], attending. Double-tap to remove from tonight's movie night."` | `.isButton` |
| Row — active user (locked) | `"[Name], you, attending. Required attendee."` | none |
| Row — managed, unselected | `"[Name], managed profile, not attending. Double-tap to add to tonight's movie night."` | `.isButton` |
| Row — managed, selected | `"[Name], managed profile, attending. Double-tap to remove from tonight's movie night."` | `.isButton` |
| Row — active managed (locked) | `"[Name], you, managed profile, attending. Required attendee."` | none |
| Minimum helper text | `"Select at least 2 people to start movie night."` | `.isStaticText` |
| "Next" — enabled | `"Next"` | `.isButton` |
| "Next" — disabled | `"Next. Select at least 2 attendees to continue."` | `.isButton, .notEnabled` |
| Error banner | Error message text | `.isStaticText` |

**VoiceOver focus order:**
1. Nav title
2. Instruction text
3. Card header ("N of M attending") — `.isHeader`
4. "All" button
5. "None" button
6. `AttendeeRowView` rows, top to bottom
7. Minimum helper text (when visible)
8. "Next" button

**Count announcement on toggle:**
```swift
// Called after every toggle, selectAll, deselectAll:
AccessibilityNotification.Announcement(
    "\(selectedMemberIds.count) of \(members.count) attending"
).post()
```

### Contrast

- **"You" badge:** `PrimaryAccent` text on `PrimaryAccent.opacity(0.10)` background. Effective contrast is `PrimaryAccent` against near-transparent `CardBackground`. Verify `PrimaryAccent` meets 4.5:1 against `CardBackground` in both modes. Increase badge background to `0.15` in dark mode via `@Environment(\.colorScheme)` if differentiation is insufficient.
- **"Managed" badge:** `.secondary` on `Color(.systemGray5)` — system adaptive, compliant.
- **`WarningAccent` text on `AppBackground`:** Must be 4.5:1 in both modes. Verify during design token definition (same requirement noted in the `RatingSelectorView` spec).
- **Unselected circle icon (`Color(.systemGray3)`) on `CardBackground`:** Decorative UI component — 3:1 applies. Verify during implementation.

---

## Visual Specifications

### Spacing

| Element | Value |
|---|---|
| Screen outer horizontal padding | 16pt |
| Top padding below navigation bar | 16pt |
| Gap: instruction text -> attendee card | 12pt |
| Attendee card corner radius | 16pt |
| Attendee card internal padding | 16pt all sides |
| Card header bottom -> divider gap | 8pt |
| `AttendeeRowView` minimum height | 44pt |
| `AttendeeRowView` internal vertical padding | 10pt top and bottom |
| Avatar -> name column gap | 12pt |
| Divider inset between rows | 44pt leading |
| Gap between "You" and "Managed" badges | 4pt |
| Badge internal horizontal padding | 6pt |
| Badge internal vertical padding | 2pt |
| Badge corner radius | 4pt |
| Gap between "All" and "None" shortcuts | 12pt |
| Gap: attendee card -> minimum helper text | 12pt |
| "Next" button horizontal padding | 16pt |
| "Next" button bottom padding | 16pt + `safeAreaInsets.bottom` |

### Typography

| Element | Style | Weight | Color |
|---|---|---|---|
| Navigation title | `.inline` system | System | System |
| Instruction text | `.body` | `.regular` | `.secondary` |
| Card header "ATTENDING (N of M)" | `.caption` | `.semibold` | `.secondary` / `WarningAccent` |
| "All" shortcut | `.caption` | `.regular` | `.tint` |
| "None" shortcut | `.caption` | `.regular` | `.tint` |
| Member display name | `.body` | `.regular` | `.primary` |
| "You" badge | `.caption2` | `.semibold` | `PrimaryAccent` |
| "Managed" badge | `.caption2` | `.regular` | `.secondary` |
| Minimum helper text | `.caption` | `.regular` | `WarningAccent` |
| Error banner text | `.caption` | `.regular` | `WarningAccent` |
| Load error title | `.body` | `.semibold` | `.primary` |
| Load error body | `.caption` | `.regular` | `.secondary` |

### Colors

| Element | Token | Notes |
|---|---|---|
| Screen background | `AppBackground` | |
| Attendee card background | `CardBackground` | No shadow, no border |
| Selected checkmark | `PrimaryAccent` full opacity | `checkmark.circle.fill` |
| Unselected circle | `Color(.systemGray3)` | `circle` |
| "You" badge text | `PrimaryAccent` full opacity | |
| "You" badge background | `PrimaryAccent` at 10% opacity | Increase to 15% in dark mode |
| "Managed" badge text | `.secondary` system | |
| "Managed" badge background | `Color(.systemGray5)` | System adaptive |
| Card header — normal | `.secondary` system | |
| Card header — below minimum | `WarningAccent` | Animated color change |
| Minimum helper icon + text | `WarningAccent` | |
| Error banner icon + text | `WarningAccent` | |
| "All" / "None" shortcuts | `.tint` (resolves to `PrimaryAccent`) | |
| Shimmer base | `Color(.systemGray5)` | |
| Shimmer highlight | `Color(.systemGray4)` gradient | |
| Dividers | System divider | |

**Dark mode:** All semantic tokens resolve automatically. Verify "You" badge at 10% opacity on dark `CardBackground`. Increase to 15% if visually insufficient.

---

## Integration Notes

### Changes to GroupDetailView

Add `attendeeSelection` to `RoundFlowPhase` and update navigation:

```swift
// 1. Update the enum:
enum RoundFlowPhase: Hashable {
    case idle
    case attendeeSelection                // NEW
    case start([String])                  // MODIFIED: carries selectedAttendeeIds
    case voting(String)
    case results(String)
    case picked
}

// 2. Update "Pick Tonight's Movie" NavigationLink:
// BEFORE: NavigationLink(value: RoundFlowPhase.start)
// AFTER:
NavigationLink(value: RoundFlowPhase.attendeeSelection) {
    Label("Pick Tonight's Movie", systemImage: "film.stack")
}

// 3. Add new destination:
case .attendeeSelection:
    AttendeeSelectionView(
        members: viewModel.group?.members ?? [],
        // C4: profileSessionManager.activeProfile.userId
        // Pre-C4 fallback:
        activeUserId: viewModel.currentUserId ?? "",
        groupId: group.groupId
    ) { selectedIds in
        navigationPath.append(RoundFlowPhase.start(selectedIds))
    }

// 4. Update .start destination:
case .start(let selectedAttendeeIds):
    StartRoundView(
        viewModel: votingViewModel,
        groupId: group.groupId,
        selectedAttendeeIds: selectedAttendeeIds   // MODIFIED
    ) { roundId in
        navigationPath.append(RoundFlowPhase.voting(roundId))
    }
```

**Active round skip logic (OQ-1):** Add this check in `GroupDetailView` before navigating to `.attendeeSelection`:
```swift
// When "Pick Tonight's Movie" is tapped, check for active round:
if let roundId = votingViewModel.roundDetails?.roundId,
   votingViewModel.status == "voting" {
    navigationPath.append(RoundFlowPhase.voting(roundId))
} else {
    navigationPath.append(RoundFlowPhase.attendeeSelection)
}
```
Implement this via the `NavigationLink`'s `value` — or by detecting state in `.onAppear` of the attendee screen and immediately popping forward.

### Changes to StartRoundView

Three targeted changes:

**1. Add `selectedAttendeeIds` parameter and remove `isCreator`:**
```swift
struct StartRoundView: View {
    @ObservedObject var viewModel: VotingViewModel
    let groupId: String
    let selectedAttendeeIds: [String]   // NEW
    var onRoundStarted: ((String) -> Void)?
    // Remove: let isCreator: Bool
}
```

**2. Remove the creator gate (US-44):**
```swift
// Remove entirely:
.disabled(!isCreator)

// Remove entirely:
if !isCreator {
    Text("Only the group creator can start a round.")
        .font(.caption)
        .foregroundStyle(.secondary)
}
```

**3. Pass attendees to `createRound()`:**
```swift
Task {
    if let roundId = await viewModel.createRound(
        attendees: selectedAttendeeIds,
        includeWatchlist: includeWatchlist
    ) {
        onRoundStarted?(roundId)
    }
}
```

### Changes to VotingViewModel

```swift
// Updated signature:
func createRound(
    attendees: [String] = [],       // NEW — empty means backend defaults to all members
    excludeMovieIds: [Int] = [],
    includeWatchlist: Bool = false
) async -> String? {
    let request = CreateRoundRequest(
        attendees: attendees.isEmpty ? nil : attendees,
        excludeMovieIds: excludeMovieIds,
        includeWatchlist: includeWatchlist
    )
    // ... rest of function unchanged
}
```

### Changes to Round.swift

```swift
struct CreateRoundRequest: Codable {
    let attendees: [String]?     // NEW — nil = all group members (backend default)
    let excludeMovieIds: [Int]
    let includeWatchlist: Bool
}
```

### Changes to Group.swift (C0 Dependency)

`AttendeeRowView` uses `member.isManaged`. This field must be added to `GroupMember` as part of the C0 schema alignment task:

```swift
struct GroupMember: Codable, Identifiable {
    let userId: String
    let displayName: String
    let avatarKey: String
    let role: String
    let joinedAt: String
    let memberType: String    // "independent" | "managed"  -- NEW in C0
    let isManaged: Bool       // convenience: memberType == "managed"  -- NEW in C0

    var id: String { userId }
    var isCreator: Bool { role == "creator" }
}
```

### Changes to VotingView

Update the vote progress label to reflect attendee-scoped denominator:

```swift
// BEFORE:
Text("\(progress.voted) of \(progress.total) voted")

// AFTER:
Text("\(progress.voted) of \(progress.total) attending members voted")
```

The API already returns `vote_progress.total` as `attendees.count` after C2. This is a label-only change.

### ProfileSessionManager Integration (C4 Dependency)

`AttendeeSelectionView` requires the `activeUserId` to lock the active user's row. This value comes from `ProfileSessionManager.activeProfile.userId` introduced in C4.

**Integration point in `GroupDetailView`:**
```swift
// C4+ (preferred):
case .attendeeSelection:
    AttendeeSelectionView(
        members: viewModel.group?.members ?? [],
        activeUserId: profileSessionManager.activeProfile.userId,
        groupId: group.groupId
    ) { ... }

// Pre-C4 fallback (acceptable for initial C6 implementation):
case .attendeeSelection:
    AttendeeSelectionView(
        members: viewModel.group?.members ?? [],
        activeUserId: viewModel.currentUserId ?? "",
        groupId: group.groupId
    ) { ... }
```

The `AttendeeSelectionView` interface accepts `activeUserId: String` directly — the caller determines the source. No changes to `AttendeeSelectionView` itself are needed when C4 lands; only the call site in `GroupDetailView` updates.

---

## Preview Variants

### AttendeeSelectionView

| # | Variant | Notes |
|---|---|---|
| 1 | Light mode, all 4 selected (default) | Happy path; primary preview |
| 2 | Dark mode, all 4 selected | Verify `CardBackground`, badge opacity |
| 3 | Light mode, 2 of 4 selected | Helper hidden, "Next" enabled |
| 4 | Light mode, below minimum (1 of 2 member household) | Helper visible, header in `WarningAccent`, "Next" disabled |
| 5 | Light mode, managed member present and deselected | "Managed" badge; open circle on managed row |
| 6 | Light mode, managed member is active profile | "You" + "Managed" badges on locked row |
| 7 | Light mode, loading state | Shimmer skeleton rows |
| 8 | Light mode, load error (State 5) | Inline error content inside card |
| 9 | Light mode, round creation error — 422 | Error banner below card, "Next" still enabled |
| 10 | XXXL Dynamic Type, all selected | Rows grow; name truncates; badges wrap below name |

### AttendeeRowView

| # | Variant | Notes |
|---|---|---|
| 1 | Independent, unselected | Default |
| 2 | Independent, selected | Filled checkmark, scale punch shown in preview via `.onAppear` |
| 3 | Active user, locked | "You" badge; filled check; no button trait |
| 4 | Managed, unselected | "Managed" badge; open circle |
| 5 | Managed, selected | "Managed" badge; filled checkmark |
| 6 | Active managed profile, locked | "You" + "Managed" badges; locked |
| 7 | XXXL Dynamic Type, long display name | Truncation + badge wrap behavior |

---

## Open Questions and Recommendations

### OQ-1: Active Round Resume Path

**Question:** When "Pick Tonight's Movie" is tapped and an active round already exists, should `AttendeeSelectionView` be shown?

**Recommendation:** No. Skip attendee selection and navigate directly to `VotingView`. Attendees are already set on the existing round.

**Default for C6:** Implement the skip-if-active-round check in `GroupDetailView` before appending `.attendeeSelection` to the navigation path (see Integration Notes).

---

### OQ-2: Preferences Pre-check UI

**Question:** Should `AttendeeSelectionView` proactively warn if selected attendees have no preferences set?

**Recommendation:** No — defer to the 422 error from `StartRoundView`. The preference check would require an additional API call not available in C6.

**Default for C6:** 422 error message in `StartRoundView`. Add "Nudge [Name]" CTA in a later slice when push infrastructure is ready.

---

### OQ-3: Member Ordering in the List

**Question:** Should managed members be grouped at the end?

**Recommendation:** Yes. Order: active user first, independent members alphabetically, managed members alphabetically. This makes member types visually distinct without section headers.

**Default:** Implemented in `AttendeeSelectionViewModel.sorted(_:activeUserId:)`.

---

### OQ-4: "None" Shortcut and the Locked Active User

**Question:** Does tapping "None" deselect the active user?

**Recommendation:** No. "None" deselects all members except the locked active user. This intentionally produces the Below Minimum state for households where the active user is the only other person — correctly surfacing the minimum constraint.

**Default:** "None" never removes the locked active user from `selectedMemberIds`.

---

### OQ-5: Pushed View vs. Modal Sheet

**Question:** Should `AttendeeSelectionView` be a modal sheet or a pushed navigation destination?

**Recommendation:** Pushed destination. This is a linear step in the round creation flow — not a contextual overlay. Sheets (as established by `RatingView` in the rating spec) are for actions overlaying a stable screen.

**Default:** Push via `RoundFlowPhase.attendeeSelection`.

---

### OQ-6: Single-Member Household Edge Case

**Question:** What if the household has only 1 member?

**Recommendation:** Guard in `GroupDetailView` — disable or hide "Pick Tonight's Movie" when `group.members.count < 2` with helper text: "Invite at least one more family member to start movie night." If `AttendeeSelectionView` is reached anyway, show an inline error with an "Invite Family" `PrimaryButton`.

**Default for C6:** Add the guard in `GroupDetailView`. Edge-case handling inside `AttendeeSelectionView` is a fallback only.

---

### OQ-7: Selection State Persistence on Back Navigation

**Question:** If a user selects a custom subset, encounters an error in `StartRoundView`, and presses back — is their selection preserved?

**Recommendation:** Yes. Declare `@StateObject private var viewModel: AttendeeSelectionViewModel` inside `AttendeeSelectionView`. SwiftUI preserves `@StateObject` instances for the lifetime of the view in the navigation stack. Selection state survives the back navigation automatically.

**Default:** Use `@StateObject` for the view model inside `AttendeeSelectionView`.

---

## Quality Checklist

- [x] US-43 all acceptance criteria addressed: attendee selection as first step, all pre-checked by default, minimum 2 enforced, suggestion algorithm scoped via `attendees[]`, vote progress uses `attendees.count`, attendees stored on the session record
- [x] US-44 addressed: `isCreator` gate removed from `StartRoundView`; all household members can access and complete the initiation flow
- [x] Flow 5 step 1 fully specified
- [x] Flow 7 step 2 fully specified
- [x] All six states defined: Loading, All Selected, Partial Selection, Below Minimum, Load Error, Round Creation Error
- [x] No screen has more than two primary actions ("Next" is the only primary action)
- [x] All tap targets >= 44pt (`AttendeeRowView` min height, header shortcuts, `PrimaryButton`)
- [x] Color usage references only semantic design tokens
- [x] Typography uses only the defined hierarchy — no hardcoded sizes
- [x] Dark mode addressed (badge opacity adjustment documented)
- [x] Dynamic Type addressed (minHeight not fixed height; `ViewThatFits` for header overflow; badge wrap behavior documented)
- [x] VoiceOver labels specified for all interactive elements including locked rows and disabled states
- [x] Accessibility count announcement on every selection change specified
- [x] Reduce Motion behavior specified for all animations
- [x] Haptics specified with generator type, style, and trigger for every interaction
- [x] Spring animation parameters specified (response, dampingFraction) for all transitions
- [x] Cascade animation for "All"/"None" specified with 30ms index-based delay
- [x] Components extracted: `AttendeeRowView` and `AttendeeSelectionViewModel` are reusable standalone files
- [x] `AttendeeSelectionViewModel` properties and methods fully specified with Swift code
- [x] Integration changes to `GroupDetailView`, `StartRoundView`, `VotingViewModel`, `Round.swift`, `Group.swift` documented with before/after code
- [x] C0 dependency (`isManaged` on `GroupMember`) explicitly flagged
- [x] C4 dependency (`ProfileSessionManager`) documented with pre-C4 fallback
- [x] Pre-population from `GroupViewModel` specified to avoid redundant API call
- [x] Active round skip logic specified (OQ-1)
- [x] `VotingView` vote progress label update specified
- [x] Preview variants listed (10 for `AttendeeSelectionView`, 7 for `AttendeeRowView`)
- [x] Design is calm, spacious, and family-friendly: single-purpose screen, default-all-checked removes friction, no extraneous elements
```

---

**End of specification.**

Now, regarding the agent memory update — since the Write tool is not in my listed tools for this conversation, I'll note the patterns to record here. The key institutional knowledge from this spec and the existing rating spec that should be preserved in `/Users/timemerson/family-movie-night/.claude/agent-memory/ui-designer/MEMORY.md` for future sessions:

**Patterns confirmed across both specs (rating-selector-view.md and this spec):**

1. **Navigation pattern:** Screens in the round flow are pushed via `RoundFlowPhase` enum cases onto a `NavigationStack` in `GroupDetailView`. Sheets are used for post-action overlays (e.g., `RatingView`). New flow steps get new enum cases.

2. **Member row pattern:** `RatingMemberRowView` (rating spec) and `AttendeeRowView` (this spec) share the same structural skeleton: `HStack(spacing: 12)` with `ProfileAvatarView` at small size, `VStack` center content, `Spacer()`, trailing indicator. Minimum height 44pt via `frame(minHeight: 44)`.

3. **Checkmark animation:** Scale punch `1.0 -> 1.2 -> 1.0` on selection using two chained `.spring` calls with `asyncAfter(0.12)` between them. Response/dampingFraction: `(0.18, 0.5)` then `(0.22, 0.7)`. This is the established selection animation pattern.

4. **Error state pattern:** Two sub-cases — load errors show inline within the card (replacing content); action errors show a banner below the card. Both use `WarningAccent` color and a `.error` notification haptic.

5. **Cascade animation:** "Select all" / "Deselect all" actions use 30ms per-item `asyncAfter` delay for a staggered spring cascade. Maximum 240ms (8 members).

6. **Shimmer skeleton:** `Color(.systemGray5)` base + animated `LinearGradient` overlay at 1.2s repeating. Reduce Motion: static fill.

7. **Locked state pattern:** Non-interactive rows use `.rigid` haptic on tap to signal the lock intentionally, instead of silently ignoring the touch.

8. **API call ownership:** View-owned API calls (round creation) stay in `VotingViewModel.createRound()`. Attendee selection state is managed by `AttendeeSelectionViewModel` and passed up via closure — clean separation of concerns.

9. **Pre-population pattern:** View models accept pre-loaded data via initializer parameters to avoid redundant API calls when parent views already hold fresh data.

10. **`ContentTransition(.numericText())`:** Used for animated count updates (e.g., "ATTENDING (N of M)") as the established pattern.
