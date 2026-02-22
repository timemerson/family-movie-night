# AddManagedMemberView — UI Specification

**Version:** 1.0
**Status:** Ready for Implementation
**Slice:** C5 (Managed Member Creation UI)
**Related Stories:** US-25, US-42
**Related Flows:** Flow 11 (Add a Managed Member), Flow 12 (Profile Switching)
**Related API:** `POST /groups/{group_id}/members/managed`
**Files to Create:**
- `ios/FamilyMovieNight/Features/Group/AddManagedMemberView.swift`
- `ios/FamilyMovieNight/Features/Group/AddManagedMemberViewModel.swift`
**Files to Modify:**
- `ios/FamilyMovieNight/Features/Group/GroupDetailView.swift`
- `ios/FamilyMovieNight/Models/Group.swift`

---

## UX Flows

### Flow: Add Managed Member (Primary Path)

**Entry:** User taps "Add Family Member" in the Members section of `GroupDetailView`.

**Precondition check before entry point is shown:**
- If `group.members.count >= 8`, the "Add Family Member" button is disabled with the label "Household Full (8/8)". No navigation occurs. A brief tooltip or inline note reads "Remove a member to add another."
- If the authenticated user is not a group member (edge case), the button is hidden entirely.

```
GroupDetailView — Members section
  |
  +-- User taps "Add Family Member"
        |
        [?] group.members.count >= 8?
        +-- Yes: button disabled, no navigation
        +-- No: AddManagedMemberView presented as .sheet
              |
              +-- [State] Empty form
              |       displayName field (empty)
              |       AvatarPickerView (first avatar pre-selected)
              |       PG rating badge (informational, not interactive)
              |       COPPA disclosure
              |
              +-- User enters a display name
              |
              +-- User selects an avatar (optional — default pre-selected)
              |
              +-- User taps "Add Member"  <-- PrimaryButton
              |     |
              |     [State] Submitting (spinner, form disabled)
              |     |
              |     [?] POST /groups/{id}/members/managed succeeds?
              |     +-- Success (201):
              |     |     [State] Success confirmation
              |     |     "Max has been added!"
              |     |     Two exit paths presented:
              |     |       "Set Their Preferences" -> dismiss sheet,
              |     |         then trigger ProfileSessionManager.switchProfile(to: newMember)
              |     |         then navigate to PreferencesView
              |     |       "Done" -> dismiss sheet
              |     |     GroupDetailView member list refreshes
              |     |
              |     +-- Failure:
              |           [State] Error displayed inline
              |           Form re-enabled
              |
              +-- User taps "Cancel" (nav bar leading) at any time
                    -> sheet dismissed, no member created
```

**Exit points:**
- "Done" on success confirmation -> sheet dismissed, return to `GroupDetailView` (member list updated)
- "Set Their Preferences" on success -> sheet dismissed, profile switched, `PreferencesView` pushed
- "Cancel" in nav bar -> sheet dismissed with no action

---

## Screen Inventory

| Screen / Component | Purpose | Entry Points | Exit Points | Primary Action |
|---|---|---|---|---|
| `AddManagedMemberView` | Form for creating a managed member profile | "Add Family Member" button in `GroupDetailView` Members section | Success confirmation; Cancel | Submit the form ("Add Member") |
| `AvatarPickerView` | Horizontal scroll grid for selecting a predefined avatar | Embedded in `AddManagedMemberView` | N/A (embedded) | Tap to select avatar |
| Success confirmation (inline state within `AddManagedMemberView`) | Confirms creation and presents next-step options | Automatic after successful POST | "Done" dismiss; "Set Their Preferences" flow | Dismiss or navigate to preferences |

---

## Screen Specifications

### Screen: AddManagedMemberView

**Purpose:** A focused, single-purpose form allowing a parent/guardian to create a managed household member profile with a name and avatar. Feels calm, deliberate, and trustworthy — this is a moment where the parent is setting up their child's presence in the app.

**Presentation:** Presented as a `.sheet` from `GroupDetailView`. Uses `presentationDetents([.large])`. If the user has entered any data, `interactiveDismissDisabled(true)` prevents accidental swipe-to-dismiss; the "Cancel" button in the nav bar becomes the explicit escape path.

**Navigation title:** "Add Family Member" (`.navigationBarTitleDisplayMode(.inline)`)

**Nav bar items:**
- Leading: "Cancel" button (`.tint` color) — dismisses sheet without saving
- Trailing: none

#### Layout — Empty Form State

```
+------------------------------------------------------+
|  Cancel          Add Family Member                   |   Navigation bar
+------------------------------------------------------+
|  16pt top padding                                    |
|  +----------------------------------------------+   |   Name field card
|  |  Name                                        |   |   CardBackground, radius 16
|  |  +------------------------------------------+|   |   16pt internal padding
|  |  | [TextField: "Enter a name..."]            ||   |   Rounded, system TextField
|  |  +------------------------------------------+|   |
|  |  "Up to 30 characters" (.caption .tertiary)  |   |
|  +----------------------------------------------+   |
|  12pt gap                                            |
|  +----------------------------------------------+   |   Avatar section card
|  |  Choose an Avatar (.title3 .semibold)        |   |   CardBackground, radius 16
|  |  +--AvatarPickerView--+                      |   |   16pt internal padding
|  |  | [Grid of avatars]  |                      |   |
|  |  +--------------------+                      |   |
|  +----------------------------------------------+   |
|  12pt gap                                            |
|  +----------------------------------------------+   |   Content rating info card
|  |  Content Rating  (.body)                     |   |   CardBackground, radius 16
|  |  +------------------------------------------+|   |   16pt internal padding
|  |  | [PG badge]  Rated PG  (.body)             ||   |
|  |  +------------------------------------------+|   |
|  |  "Managed profiles are always limited to PG  |   |
|  |   or below." (.caption .secondary)           |   |
|  +----------------------------------------------+   |
|  12pt gap                                            |
|  +----------------------------------------------+   |   COPPA disclosure card
|  |  [info.circle icon] (.caption .secondary)    |   |   CardBackground (or .ultraThinMaterial),
|  |  "This profile is managed by you on behalf   |   |   radius 16, 16pt padding
|  |  of a household member. No data is           |   |   Subtle, informational tone
|  |  collected directly from them."              |   |
|  +----------------------------------------------+   |
|  20pt gap                                            |
|  +----------------------------------------------+   |   PrimaryButton
|  |              Add Member                      |   |   Disabled until name is non-empty
|  +----------------------------------------------+   |   Min 44pt height
|  16pt + safe area bottom                             |
+------------------------------------------------------+
```

**Content hierarchy:**
1. Name field — the single required input; receives focus automatically on appear
2. Avatar picker — visual, tactile, fun but secondary to the name
3. Content rating badge — informational only; communicates the PG ceiling without alarming the parent
4. COPPA disclosure — required by product spec; visually subdued so it doesn't overwhelm but is clearly readable
5. Submit button — enabled only when a valid name is entered

**Navigation:**
- Inside a `NavigationStack` within the `.sheet`. No back button needed — modal context with explicit Cancel.

**Interaction behaviors:**
- Text field receives `.onAppear` focus via `@FocusState` binding
- Character counter updates in real time as user types (shown near the 20-character mark, always visible once user begins typing; see Validation section)
- "Add Member" button enables/disables with `.animation(.easeInOut(duration: 0.2), value: canSubmit)`
- Tapping outside the keyboard dismisses it without submitting
- Haptic feedback on successful submission: `UINotificationFeedbackGenerator().notificationOccurred(.success)`

---

#### Layout — Validation Error State (inline)

The form does not navigate away on validation failure. Errors appear inline:

```
+----------------------------------------------+
|  Name                                        |
|  +------------------------------------------+|    Red border (WarningAccent, 1.5pt stroke)
|  | [TextField: "Zara the Explorer 🦁🎬🍿"]  ||    Content entered (38 chars — too long)
|  +------------------------------------------+|
|  "Name must be 30 characters or less."       |    .caption, WarningAccent color
|  "38/30 characters" (.caption .tertiary)     |    Character counter turns red at limit
+----------------------------------------------+
```

Validation rules:
- Name is required (non-empty, non-whitespace-only)
- Name max 30 characters (enforced at field level — no characters accepted beyond 30 via `.onChange` or `TextField` limit modifier)
- Character counter: hidden until user has typed at least 10 characters, then shows as "12/30" in `.caption .tertiary`. Turns `WarningAccent` at 25 characters (approaching limit) and stays `WarningAccent` if the limit is reached.

**Note on max-length enforcement:** The field uses `.onChange(of: displayName)` to truncate at 30 characters client-side. No inline error for exceeding the limit is needed because the user cannot exceed it — the field stops accepting input. The counter turning red at 25+ characters provides the warning signal.

---

#### Layout — Submitting State

```
+----------------------------------------------+
|  Name                                        |   Fields appear visually muted
|  [Tim]                                       |   .disabled(true) applied to form
+----------------------------------------------+
|  [AvatarPickerView — disabled/muted]         |
+----------------------------------------------+
|  [Content rating card — unchanged]           |
+----------------------------------------------+
|  [COPPA disclosure — unchanged]              |
+----------------------------------------------+
|  +------------------------------------------+|   PrimaryButton with ProgressView
|  |  [ProgressView()]  Adding...             ||   Label replaced by spinner + "Adding..."
|  +------------------------------------------+|
```

- `VStack` containing all form fields wrapped in `.disabled(isSubmitting)`
- Nav bar "Cancel" button hidden during submission (`isSubmitting ? .hidden : .visible`)
- No interaction possible until request completes

---

#### Layout — Success Confirmation State

After a successful POST, the form content is replaced with a success state. The sheet stays open; the user must actively dismiss it.

```
+------------------------------------------------------+
|                 Add Family Member                    |   Nav bar — no Cancel button
+------------------------------------------------------+
|                                                      |
|  Spacer (flexible)                                   |
|                                                      |
|  [Avatar image: selected avatar, 88x88pt]            |   Centered
|  8pt gap                                             |
|  "[Name] has been added!"                            |   .title2 .bold, centered
|  12pt gap                                            |
|  "Switch to [Name]'s profile to set up their        |   .body .secondary, centered
|  genre preferences."                                |   max 3 lines, centered
|                                                      |
|  Spacer (flexible)                                   |
|                                                      |
|  +----------------------------------------------+   |   PrimaryButton
|  |         Set Their Preferences                |   |
|  +----------------------------------------------+   |
|  8pt gap                                             |
|  +----------------------------------------------+   |   SecondaryButton
|  |                    Done                      |   |
|  +----------------------------------------------+   |
|  16pt + safe area bottom                             |
+------------------------------------------------------+
```

**Transition into success state:**
```swift
withAnimation(.easeInOut(duration: 0.3)) {
    submissionState = .success(newMember)
}
```

The entire form content fades out and the success view fades in. The avatar uses a scale-in spring: `.transition(.scale(scale: 0.7).combined(with: .opacity))` with `.animation(.spring(response: 0.4, dampingFraction: 0.7))`.

**Haptic:** `UINotificationFeedbackGenerator().notificationOccurred(.success)` fires as the success state appears.

**"Set Their Preferences" action:**
1. Dismiss the sheet
2. `ProfileSessionManager.switchProfile(to: newMember)` (Slice C4 dependency)
3. Navigate to `PreferencesView` configured for the new managed member

**For Slice C5 (pre-C4):** "Set Their Preferences" dismisses the sheet. The parent must manually open the profile switcher and switch to the new member before setting preferences. A note may be added: "Open the profile switcher to set [Name]'s preferences."

---

#### Layout — Household Full Error State

This state is shown in `GroupDetailView` before the sheet is ever presented, not inside `AddManagedMemberView`. See Integration Notes.

---

#### Layout — Submission Error State

The form returns to the editable state with an inline error banner above the submit button.

```
+----------------------------------------------+
|  [COPPA disclosure card]                     |
+----------------------------------------------+
|  12pt gap                                    |
|  +------------------------------------------+|   Error banner
|  |  [exclamationmark.triangle]              ||   WarningAccent background at 10% opacity
|  |  "Couldn't add this member. Your         ||   WarningAccent border 1pt
|  |  household may be full."                 ||   .caption, WarningAccent foreground
|  +------------------------------------------+|   cornerRadius 12
|  8pt gap                                     |
|  +------------------------------------------+|   PrimaryButton re-enabled
|  |              Add Member                  ||
|  +------------------------------------------+|
```

Haptic: `UINotificationFeedbackGenerator().notificationOccurred(.error)` fires on error state entry.

---

### Component: AvatarPickerView (embedded in AddManagedMemberView)

**Purpose:** A horizontally scrolling row of predefined avatar options. The selected avatar is highlighted with the `PrimaryAccent` border and background tint. One avatar is always selected (no "no avatar" state).

**Layout:**

```
+----------------------------------------------+
|  +--[Scroll: horizontal, no indicator]-----+ |
|  | [Av1] [Av2] [Av3*] [Av4] [Av5] [Av6]   | |   Each avatar: 64x64pt tappable circle
|  |       (* = selected)                    | |   8pt spacing between
|  +------------------------------------------+ |
+----------------------------------------------+
```

The picker is a `ScrollView(.horizontal, showsIndicators: false)` containing an `HStack(spacing: 8)` with `padding(.horizontal, 4)`. Avatars are arranged in a single row. On screen, approximately 5 avatars are visible at once on a standard iPhone; the user scrolls horizontally to see all options.

**Predefined avatar set (12 avatars, v1):**

| avatar_key | Description |
|---|---|
| `avatar_bear` | Bear face, warm brown |
| `avatar_fox` | Fox face, orange |
| `avatar_owl` | Owl face, blue-grey |
| `avatar_dino` | Dinosaur face, green |
| `avatar_cat` | Cat face, cream |
| `avatar_dog` | Dog face, golden |
| `avatar_lion` | Lion face, yellow |
| `avatar_penguin` | Penguin, black and white |
| `avatar_rabbit` | Rabbit face, white |
| `avatar_panda` | Panda face, black and white |
| `avatar_koala` | Koala face, grey |
| `avatar_frog` | Frog face, green |

**Default selection:** `avatar_bear` (first in the list) is pre-selected on first load.

**Individual avatar cell layout:**

```
ZStack {
    Circle()
        .fill(isSelected
            ? Color("PrimaryAccent").opacity(0.12)
            : Color("CardBackground"))
        .frame(width: 64, height: 64)

    // Avatar illustration — AsyncImage or bundled asset
    // Image(avatarKey) as a bundled asset image
    // Placeholder: Circle with systemImage "person.fill"
    Image(avatar.key)
        .resizable()
        .scaledToFit()
        .frame(width: 44, height: 44)

    if isSelected {
        Circle()
            .strokeBorder(Color("PrimaryAccent"), lineWidth: 2.5)
            .frame(width: 64, height: 64)
    }
}
.frame(width: 64, height: 64)
```

**Selection animation:**
```swift
.animation(.spring(response: 0.25, dampingFraction: 0.7), value: isSelected)
```
When an avatar becomes selected, a scale punch on the cell: 1.0 -> 1.1 -> 1.0 using the same pattern as `RatingOptionCard`.

**Interaction:**
- Tap any avatar -> `UIImpactFeedbackGenerator(style: .light).impactOccurred()` + selection changes
- Only one avatar can be selected at a time
- The picker auto-scrolls to keep the newly-selected avatar visible: `.scrollTo(avatar.id, anchor: .center)`

**Note on avatar assets:** In v1, avatar illustrations are bundled as image assets (not fetched remotely). The `avatar_key` string matches the asset name in the Xcode asset catalog. `ProfileAvatarView` must be updated (or already support) rendering from `avatar_key`.

---

## Component Library

### Existing Components Used

| Component | Usage in AddManagedMemberView | Notes |
|---|---|---|
| `ProfileAvatarView` | Success confirmation state: display the newly-created member's avatar at 88pt | Verify it accepts `avatarKey` and a `size` parameter; may need `.large` size variant added |
| `PrimaryButton` | "Add Member" submit button; "Set Their Preferences" on success | Standard usage |
| `SecondaryButton` | "Done" on success confirmation | Standard usage |

### New Components Required

#### AvatarPickerView

**File:** `ios/FamilyMovieNight/Features/Group/AvatarPickerView.swift`

**Purpose:** Horizontally scrollable avatar selection row for profile creation. Reusable in profile editing (US-21, `PATCH /users/me`) and the future managed-member editing flow.

**Props:**
```swift
struct AvatarPickerView: View {
    @Binding var selectedAvatarKey: String
    var isDisabled: Bool = false
}
```

**Behavior:** Renders a `ScrollView(.horizontal)` containing all predefined avatars. Maintains its own `ScrollViewReader` to auto-scroll the selected avatar into view. Selection changes propagate through the binding immediately (no "confirm" step — selection is live).

**Accessibility:**
- Each avatar cell: `.accessibilityLabel("\(avatar.displayName) avatar\(isSelected ? ", selected" : ""). Double-tap to select.")`
- `.accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)`
- Container: `.accessibilityLabel("Avatar selection. \(selectedAvatar.displayName) is currently selected.")`

**Variants:**
- Default (enabled): Full opacity, interactive
- Disabled: `.opacity(0.4)`, `allowsHitTesting(false)` — used during form submission

**Previews required:**
- Light mode, default selection (avatar_bear)
- Dark mode, mid-list selection (avatar_dino)
- Disabled state
- XXXL Dynamic Type (avatars should not change size with Dynamic Type — they are fixed 64pt visual elements, not text-dependent)

---

#### AddManagedMemberViewModel

**File:** `ios/FamilyMovieNight/Features/Group/AddManagedMemberViewModel.swift`

**Purpose:** MVVM ViewModel for `AddManagedMemberView`. Handles form state, validation, API submission, and success/error transitions.

**Properties:**
```swift
@MainActor
class AddManagedMemberViewModel: ObservableObject {

    // MARK: - Published Form State
    @Published var displayName: String = ""
    @Published var selectedAvatarKey: String = "avatar_bear"

    // MARK: - Published Submission State
    @Published var isSubmitting: Bool = false
    @Published var submissionState: SubmissionState = .idle
    @Published var error: String? = nil

    // MARK: - Derived
    var canSubmit: Bool {
        !displayName.trimmingCharacters(in: .whitespaces).isEmpty && !isSubmitting
    }
    var characterCount: Int { displayName.count }
    var isApproachingLimit: Bool { displayName.count >= 25 }
    var hasUnsavedChanges: Bool {
        !displayName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    // MARK: - Configuration
    private var groupId: String = ""
    private var apiClient: APIClient?

    // MARK: - State Machine
    enum SubmissionState: Equatable {
        case idle
        case submitting
        case success(ManagedMemberResponse)
        case error(String)
    }

    // MARK: - Methods
    func configure(apiClient: APIClient, groupId: String)
    func submit() async   // POST /groups/{groupId}/members/managed
    func reset()          // Clear form, return to idle
}
```

**API request:**
```swift
struct CreateManagedMemberRequest: Encodable {
    let displayName: String
    let avatarKey: String
}

struct ManagedMemberResponse: Decodable, Equatable {
    let userId: String        // "managed_<uuid>"
    let displayName: String
    let avatarKey: String
    let isManaged: Bool
    let parentUserId: String
    let contentRatingCeiling: String  // "PG"
    let memberType: String    // "managed"
}
```

**Error handling by HTTP status:**
| Status | User-facing message |
|---|---|
| 409 | "Your household is full (8 members). Remove a member to add another." |
| 400 | "Check the name and try again." |
| 403 | "You don't have permission to add members to this household." |
| Network / 500 | "Couldn't connect. Check your connection and try again." |

---

#### ContentRatingBadge (reusable)

**File:** `ios/FamilyMovieNight/Features/Shared/ContentRatingBadge.swift`

**Purpose:** A compact, read-only badge displaying an MPAA content rating (G, PG, PG-13, R). Used in the managed member form (showing the forced PG ceiling) and in movie cards/detail screens.

**Props:**
```swift
struct ContentRatingBadge: View {
    let rating: String   // "G", "PG", "PG-13", "R"
    var style: ContentRatingBadgeStyle = .standard
}

enum ContentRatingBadgeStyle {
    case standard  // Rectangular badge with border
    case compact   // Smaller, used inline in movie metadata lines
}
```

**Visual (standard):**
- `Text(rating)` at `.caption .semibold`
- Foreground: `.primary`
- Background: `Color("CardBackground")`
- Border: `RoundedRectangle(cornerRadius: 4).stroke(Color.secondary.opacity(0.4), lineWidth: 1)`
- Padding: `.padding(.horizontal, 6).padding(.vertical, 3)`
- Fixed width enough to contain the longest label ("PG-13")

**Accessibility:**
```swift
.accessibilityLabel("Rated \(rating)")
.accessibilityAddTraits(.isStaticText)
```

---

### Model Additions Required

The following additions are needed in `ios/FamilyMovieNight/Models/Group.swift` to support Slice C5:

```swift
// Extend GroupMember with managed member fields (Slice C0/C3 alignment)
struct GroupMember: Codable, Identifiable {
    let userId: String
    let displayName: String
    let avatarKey: String
    let role: String
    let joinedAt: String
    // New fields (Slice C0):
    var isManaged: Bool { memberType == "managed" }
    var memberType: String?        // "independent" | "managed"; nil = legacy data, treat as "independent"
    var parentUserId: String?      // Present only for managed members
    var contentRatingCeiling: String?   // "G", "PG", "PG-13", "R"; present for managed members

    var id: String { userId }
    var isCreator: Bool { role == "creator" }
}

// New response type for managed member creation
struct ManagedMemberResponse: Decodable, Equatable {
    let userId: String
    let displayName: String
    let avatarKey: String
    let isManaged: Bool
    let parentUserId: String
    let contentRatingCeiling: String
    let memberType: String
}
```

---

## State Definitions

### AddManagedMemberView States

#### State 1: Loading (Initial Appear)

**Trigger:** `AddManagedMemberView` appears. No async loading is required for this form itself — all data is local. This state resolves immediately.

**What the user sees:** The form as described in the Empty Form State layout above. The text field receives automatic focus via `@FocusState`.

**Available actions:** Type a name, select an avatar, tap Cancel.

**Transition out:** Instantly ready — there is no loading phase. If `GroupDetailView` was still loading group data when the user triggered this sheet, the `Add Family Member` button should not be shown until the group is loaded. That constraint belongs to `GroupDetailView`, not this form.

---

#### State 2: Empty Form (Idle)

**Trigger:** Initial state when the sheet presents with no prior data.

**What the user sees:**
- Name field: empty, placeholder "Enter a name..." visible, focus active
- `AvatarPickerView`: first avatar (`avatar_bear`) pre-selected, scrolled to start
- Content rating card: PG badge + explanatory caption
- COPPA disclosure card
- "Add Member" button: visually disabled (`.opacity(0.5)`, `allowsHitTesting(false)`)
- Character counter: hidden

**Available actions:** Type a name, select an avatar, tap Cancel.

**Transition out:** As soon as a non-whitespace character is entered, the "Add Member" button becomes enabled with `.animation(.easeInOut(duration: 0.2))`.

---

#### State 3: Form Filled (Ready to Submit)

**Trigger:** User has entered at least one non-whitespace character.

**What the user sees:**
- Name field: contains user input
- Character counter appears if name length >= 10: "12/30" in `.caption .tertiary`
- Character counter turns `WarningAccent` color when name length >= 25
- "Add Member" button: enabled, full opacity
- All other form elements unchanged

**Available actions:** Edit name further, change avatar selection, tap "Add Member", tap Cancel.

**interactiveDismissDisabled:** Set to `true` once `hasUnsavedChanges` is `true`. The Cancel button remains the explicit escape. Tapping Cancel when `hasUnsavedChanges` is true shows a `.confirmationDialog`:
```
"Discard this profile?"
Actions: "Discard" (destructive), "Keep Editing" (default)
```

---

#### State 4: Submitting

**Trigger:** User taps "Add Member"; `isSubmitting = true`.

**What the user sees:**
- All form fields visually muted (`.disabled(true)`, slight opacity reduction to 0.6)
- Name field cannot be tapped
- `AvatarPickerView` cannot be tapped
- "Add Member" button shows `ProgressView()` replacing the label text, plus the text "Adding..."
- Nav bar Cancel button hidden (`.toolbar { ToolbarItem(placement: .cancellationAction) { if !isSubmitting { Button("Cancel") { ... } } } }`)

**Available actions:** None — user waits for the API response.

**Transition out — success (201):** Crossfade (0.3s) to Success Confirmation state. Haptic: `.success`.

**Transition out — error:** Crossfade back to Form Filled state with error banner. Haptic: `.error`.

---

#### State 5: Success Confirmation

**Trigger:** `POST /groups/{group_id}/members/managed` returns 201.

**What the user sees:**
- Nav bar: title remains "Add Family Member"; Cancel button is gone; no trailing item
- Centered layout in the remaining space:
  - The newly created member's selected avatar rendered at 88x88pt via `ProfileAvatarView`
  - `Text("\(newMember.displayName) has been added!")` in `.title2 .bold`, centered
  - `Text("Switch to \(newMember.displayName)'s profile to set up their movie preferences.")` in `.body .secondary`, centered, max width 280pt
- `PrimaryButton("Set Their Preferences")` — full width
- 8pt gap
- `SecondaryButton("Done")` — full width

**Avatar entrance animation:** Scale from 0.6 to 1.0 with spring:
```swift
.transition(.scale(scale: 0.6).combined(with: .opacity))
.animation(.spring(response: 0.4, dampingFraction: 0.65), value: submissionState)
```

**Available actions:**
- "Set Their Preferences" (primary path)
- "Done" (secondary path)

**GroupDetailView update:** On success, `GroupViewModel.loadGroup(groupId:)` must be called to refresh the member list. This happens automatically if `GroupDetailView` observes changes or if `AddManagedMemberViewModel` broadcasts the new member via a callback/completion handler passed at initialization. Recommended: pass an `onMemberCreated: (GroupMember) -> Void` callback to `AddManagedMemberViewModel` at init time. `GroupDetailView` uses this callback to append the new member locally before the full reload, preventing a flash of the old member count.

---

#### State 6: Error

**Trigger:** `POST` returns a non-2xx response, or a network error occurs.

**What the user sees:**
- Form returns to Form Filled state (all fields re-enabled and editable)
- Error banner appears above the "Add Member" button with a `WarningAccent`-tinted background and border (see Submission Error State layout above)
- "Add Member" button is re-enabled
- Nav bar Cancel button reappears
- Error message text is specific to the HTTP status (see `AddManagedMemberViewModel` error handling table)

**Auto-dismiss of error banner:** The banner is dismissed after 8 seconds or when the user taps the field or "Add Member" again. It does not auto-dismiss on its own if the user is idle.

**Available actions:** Edit the form (error banner clears on field focus), tap "Add Member" to retry, tap Cancel to abandon.

---

### AvatarPickerView States

| State | What the User Sees |
|---|---|
| Default (one selected) | All avatars visible; selected has `PrimaryAccent` border and tint; others neutral `CardBackground` |
| Disabled | All avatars at 0.4 opacity; no interaction possible; selection preserved visually |

The picker has no loading state (assets are bundled) and no error state.

---

## Interaction Details

### Haptics

| Trigger | Generator | Style |
|---|---|---|
| Tap any avatar in picker | `UIImpactFeedbackGenerator` | `.light` |
| Tap "Add Member" (submit) | `UIImpactFeedbackGenerator` | `.medium` |
| Success state entered | `UINotificationFeedbackGenerator` | `.success` |
| Error state entered | `UINotificationFeedbackGenerator` | `.error` |
| "Set Their Preferences" tapped | `UIImpactFeedbackGenerator` | `.medium` |
| "Done" tapped | `UIImpactFeedbackGenerator` | `.light` |

All generators must be instantiated lazily. Fire only on `UIDevice.current.userInterfaceIdiom == .phone`.

### Animations

**Avatar selection:**
```swift
// On isSelected becoming true — scale punch on avatar cell
.onChange(of: isSelected) { _, newValue in
    guard newValue else { return }
    withAnimation(.spring(response: 0.18, dampingFraction: 0.45)) {
        cellScale = 1.1
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
        withAnimation(.spring(response: 0.22, dampingFraction: 0.65)) {
            cellScale = 1.0
        }
    }
}
.scaleEffect(cellScale)

// Card background / border transition (always on)
.animation(.spring(response: 0.25, dampingFraction: 0.7), value: isSelected)
```

**Submit button enable/disable:**
```swift
.animation(.easeInOut(duration: 0.2), value: canSubmit)
```

**Form -> Submitting transition:**
```swift
withAnimation(.easeInOut(duration: 0.15)) { isSubmitting = true }
```

**Submitting -> Success transition:**
```swift
withAnimation(.easeInOut(duration: 0.3)) { submissionState = .success(response) }
```
The form `VStack` fades out (`.transition(.opacity)`). The success view fades in with the avatar doing a scale spring (`.transition(.scale(scale: 0.6).combined(with: .opacity))`). Wrap in `if case .success = submissionState { ... }` inside a `ZStack` or use `@ViewBuilder` switch.

**Submitting -> Error transition:**
```swift
withAnimation(.easeInOut(duration: 0.2)) {
    isSubmitting = false
    error = errorMessage
}
```
Form re-enables. Error banner slides in from below with `.transition(.move(edge: .bottom).combined(with: .opacity))`.

**Sheet presentation:** Standard iOS `.sheet` spring presentation. No custom transition needed — the system default is appropriate.

### Keyboard

- Text field receives `.focused($isNameFieldFocused)` and `isNameFieldFocused = true` on `.onAppear`
- `.submitLabel(.done)` on the text field — tapping "Done" on the keyboard dismisses the keyboard without submitting. Submission requires an explicit tap of the "Add Member" button.
- The `ScrollView` (if the form is embedded in one) should use `.scrollDismissesKeyboard(.interactively)` so that scrolling down dismisses the keyboard naturally.

### Reduce Motion

When `@Environment(\.accessibilityReduceMotion) var reduceMotion` is `true`:
- Replace avatar selection scale punch with instant `.opacity` change (0.7 -> 1.0)
- Replace form/success crossfade transitions with instant state changes
- Spring animations on button enable/disable replaced with no animation (`.animation(nil, value: canSubmit)`)

---

## Accessibility

### Dynamic Type

- Text field, labels, captions: all use semantic type styles — no hardcoded sizes
- Avatar cells: fixed 64x64pt regardless of Dynamic Type. Avatars are illustrative icons, not text content. The label "Choose an Avatar" above the picker scales with Dynamic Type.
- COPPA disclosure text: `.body` style wrapped in a card — wraps gracefully at all sizes; card grows in height
- At XXXL Dynamic Type, the form may become tall enough to require scrolling. The outer `VStack` must be inside a `ScrollView` to accommodate this:
  ```swift
  ScrollView {
      VStack(spacing: 12) {
          // All form sections
      }
      .padding(.horizontal, 16)
      .padding(.bottom, 16)
  }
  ```

### VoiceOver Labels

| Element | VoiceOver Label | Traits |
|---|---|---|
| Name text field | `"Name. Required field. \(characterCount) of 30 characters used."` | `.isTextField` |
| Name field (empty) | `"Name. Required field. Enter a display name for this family member."` | `.isTextField` |
| `AvatarPickerView` container | `"Avatar selection. \(selectedAvatar.displayName) is currently selected. Swipe to browse."` | `.isGroup` |
| Individual avatar (unselected) | `"\(avatar.displayName) avatar. Double-tap to select."` | `.isButton` |
| Individual avatar (selected) | `"\(avatar.displayName) avatar, selected."` | `.isButton, .isSelected` |
| Content rating section | `"Content rating: PG. Managed profiles are always limited to PG or below."` | `.isSummaryElement` |
| COPPA disclosure | Full disclosure text as the label | `.isStaticText` |
| "Add Member" (disabled) | `"Add Member. Enter a name first."` | `.isButton, .notEnabled` |
| "Add Member" (enabled) | `"Add Member"` | `.isButton` |
| "Cancel" nav button | `"Cancel. Discard this profile."` | `.isButton` |
| Success: avatar image | `"\(name)'s avatar"` | `.isImage` |
| "Set Their Preferences" | `"Set \(name)'s Preferences. Navigate to set up this profile's movie preferences."` | `.isButton` |
| "Done" | `"Done. Close this screen."` | `.isButton` |

**Focus management:**
- When the sheet presents, VoiceOver focus should move to the Name field: use `.accessibilityFocused($isAccessibilityFocused)` with a matching `@AccessibilityFocusState`.
- When the success state appears, VoiceOver should announce: `AccessibilityNotification.Announcement("\(name) has been added to your household.").post()`

### Contrast

- COPPA disclosure card: The text at `.caption` must maintain 4.5:1 contrast against `CardBackground` in both light and dark mode. Because the disclosure is informational and important, use `.primary` foreground color (not `.secondary`) if the `.secondary` system color fails contrast at the specified opacity.
- Error messages in `WarningAccent` must maintain 4.5:1 against `AppBackground`. Verify during token definition.
- Content rating badge border uses `.secondary.opacity(0.4)` — this is decorative only; the text inside is `.primary` and carries the information.
- Avatar cells: the `PrimaryAccent` border on selected state must be 3:1 or better against `CardBackground` to satisfy non-text contrast (WCAG AA 1.4.11). Full-opacity `PrimaryAccent` stroke on `CardBackground` should meet this comfortably.

---

## Visual Specifications

### Spacing

| Element | Value |
|---|---|
| Screen outer horizontal padding | 16pt |
| Top padding below nav bar | 16pt |
| Spacing between form sections (cards) | 12pt |
| Card internal padding | 16pt all sides |
| Name field: label -> field gap | 8pt |
| Name field: field -> helper text gap | 6pt |
| Avatar section: label -> picker gap | 12pt |
| Spacing between avatar cells | 8pt |
| Avatar cell: content inset | 10pt (centered within 64pt circle) |
| Content rating: badge -> explanatory text gap | 8pt |
| COPPA icon -> text gap | 8pt |
| Last card -> submit button gap | 20pt |
| Submit button height (minimum) | 44pt |
| "Done" button height (minimum) | 44pt |
| Success state: avatar -> name gap | 8pt |
| Success state: name -> subtitle gap | 12pt |
| Success state: subtitle -> "Set Preferences" gap | 28pt |
| Success state: "Set Preferences" -> "Done" gap | 8pt |

### Typography

| Element | Style | Weight | Color Token |
|---|---|---|---|
| Nav title "Add Family Member" | `.inline` nav title | System default | System |
| "Cancel" nav button | System nav button | System default | Tint (PrimaryAccent) |
| Name field label "Name" | `.subheadline` | `.semibold` | `.primary` |
| Name text field input | `.body` | `.regular` | `.primary` |
| Name field placeholder | `.body` | `.regular` | `.tertiary` |
| Name helper "Up to 30 characters" | `.caption` | `.regular` | `.tertiary` |
| Character counter (normal) | `.caption` | `.regular` | `.tertiary` |
| Character counter (near limit 25+) | `.caption` | `.regular` | `WarningAccent` |
| Name validation error | `.caption` | `.regular` | `WarningAccent` |
| "Choose an Avatar" label | `.subheadline` | `.semibold` | `.primary` |
| Avatar cell label (VoiceOver only) | N/A | N/A | N/A |
| "Content Rating" section label | `.subheadline` | `.semibold` | `.primary` |
| "Rated PG" text | `.body` | `.regular` | `.primary` |
| Content rating explanatory text | `.caption` | `.regular` | `.secondary` |
| COPPA disclosure text | `.caption` | `.regular` | `.secondary` |
| Error banner text | `.caption` | `.regular` | `WarningAccent` |
| Success: member name "X has been added!" | `.title2` | `.bold` | `.primary` |
| Success: subtitle | `.body` | `.regular` | `.secondary` |

### Colors

| Element | Token / Value | Notes |
|---|---|---|
| Screen background | `AppBackground` | |
| Card backgrounds (name, avatar, rating, COPPA) | `CardBackground` | |
| Name field text field background | `.ultraThinMaterial` or system grouped `.listRowBackground` | Use system default `TextField` appearance; do not override background |
| Avatar cell — unselected background | `CardBackground` | |
| Avatar cell — selected background | `PrimaryAccent` at 12% opacity | 16% in dark mode |
| Avatar cell — selected border | `PrimaryAccent` full opacity | 2.5pt stroke |
| Content rating badge background | `CardBackground` | |
| Content rating badge border | `.secondary.opacity(0.4)` | |
| COPPA card background | `CardBackground` | Slightly elevated visual if using `.ultraThinMaterial` — both acceptable |
| COPPA icon color | `.secondary` | `info.circle` SF Symbol |
| Error banner background | `WarningAccent` at 10% opacity | |
| Error banner border | `WarningAccent` at 60% opacity | |
| Error banner text | `WarningAccent` | |
| Success avatar background (ProfileAvatarView) | Avatar-specific (from `ProfileAvatarView` internal styling) | |
| "Set Their Preferences" button | `PrimaryAccent` (standard PrimaryButton styling) | |
| "Done" button | Standard SecondaryButton styling | |

**Dark mode:** All semantic tokens resolve automatically. The `PrimaryAccent` tint on selected avatar cells should increase from 12% to 16% opacity in dark mode for sufficient visual differentiation. Use `@Environment(\.colorScheme)` inside `AvatarPickerView` to conditionally adjust.

---

## Integration Notes

### GroupDetailView Changes (Slice C5)

The current `GroupDetailView` does not have an "Add Family Member" option. The following additions are required:

**1. State for presenting the sheet:**
```swift
@State private var showAddManagedMember = false
```

**2. Add the "Add Family Member" button in the Members section:**

Replace the current static member list section with an expanded version:

```swift
Section("Members (\(group.members.count)/8)") {
    ForEach(group.members) { member in
        HStack {
            // ProfileAvatarView for the member (once ProfileAvatarView exists)
            Text(member.displayName)
            Spacer()
            if member.isCreator {
                Text("Creator")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if member.isManaged {
                Text("Managed")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    if group.members.count < 8 {
        Button {
            showAddManagedMember = true
        } label: {
            Label("Add Family Member", systemImage: "person.badge.plus")
        }
    } else {
        HStack {
            Label("Add Family Member", systemImage: "person.badge.plus")
                .foregroundStyle(.secondary)
            Spacer()
            Text("Household Full")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .accessibilityLabel("Add Family Member. Household is full at 8 members.")
    }
}
```

**3. Sheet presentation:**
```swift
.sheet(isPresented: $showAddManagedMember) {
    NavigationStack {
        AddManagedMemberView(
            groupId: group.groupId,
            apiClient: viewModel.apiClient,
            onMemberCreated: { newMember in
                // Append member locally, then trigger full refresh
                viewModel.appendMember(newMember)
                Task { await viewModel.loadGroup(groupId: group.groupId) }
            }
        )
    }
}
```

**4. GroupViewModel addition:**
```swift
func appendMember(_ member: GroupMember) {
    group?.members.append(member)
    // This gives instant UI feedback before the reload completes
}
```

**Note on who can add managed members:** Per US-25 and Flow 11, any household member (not just the creator) can create managed profiles. The "Add Family Member" button should be visible to all members when the household is not full. The `isCreator` guard is not needed here.

---

### Profile Switcher Integration (Slice C4 dependency)

After a managed member is created, "Set Their Preferences" should:
1. Dismiss the `AddManagedMemberView` sheet
2. Call `ProfileSessionManager.switchProfile(to: newMember)` — available in Slice C4
3. Navigate to `PreferencesView` configured for the managed member via `?member_id=` query param

**For Slice C5 (before C4 lands):** The "Set Their Preferences" button should dismiss the sheet and display an inline note in `GroupDetailView`:

```swift
// Temporary (pre-C4): after sheet dismiss, show a brief banner
// "Profile created! Use the profile switcher to set up [Name]'s preferences."
```

This keeps C5 shippable independently of C4. When C4 lands, the banner is replaced with the direct navigation.

---

### `ProfileAvatarView` Dependency

`ProfileAvatarView` is listed as a foundational component in CLAUDE.md but does not appear in the current Swift file inventory. Before implementing `AddManagedMemberView`:

- Verify `ProfileAvatarView` exists or create it as part of Slice C5
- It must accept `avatarKey: String` and `size: ProfileAvatarSize` (`.small` = 32pt, `.medium` = 44pt, `.large` = 88pt)
- It renders the bundled avatar asset for the given key; falls back to `person.fill` SF Symbol if the key is unrecognized
- It must support light/dark mode

If `ProfileAvatarView` does not yet exist, create it in `ios/FamilyMovieNight/Features/Shared/ProfileAvatarView.swift` as part of this slice.

---

### MemberChip Dependency

`MemberChip` is listed as a foundational component but is not yet in the file inventory. `AddManagedMemberView` does not directly use `MemberChip`, but the `GroupDetailView` member list update in this slice is a natural point to introduce `MemberChip` for displaying members in the section. This is a recommendation — not a blocking dependency for Slice C5.

---

### API Response to Model Conversion

After a successful `POST /groups/{group_id}/members/managed`, the response must be converted to a `GroupMember` for appending to `GroupViewModel.group?.members`:

```swift
extension ManagedMemberResponse {
    func toGroupMember() -> GroupMember {
        GroupMember(
            userId: userId,
            displayName: displayName,
            avatarKey: avatarKey,
            role: "member",
            joinedAt: ISO8601DateFormatter().string(from: Date()),
            memberType: memberType,          // "managed"
            parentUserId: parentUserId,
            contentRatingCeiling: contentRatingCeiling  // "PG"
        )
    }
}
```

---

## Preview Variants

All of the following must be implemented per CLAUDE.md requirements:

### AddManagedMemberView

| # | Variant | Notes |
|---|---|---|
| 1 | Light mode, empty form | Default state; name field focused |
| 2 | Dark mode, empty form | Verify token resolution on dark background |
| 3 | Light mode, form filled (name "Max", avatar_dino selected) | "Add Member" button enabled |
| 4 | Light mode, form filled at limit (30 characters) | Counter in WarningAccent |
| 5 | Light mode, submitting state | Spinner on button, fields muted |
| 6 | Light mode, success state ("Max has been added!") | Avatar visible, two CTA buttons |
| 7 | Dark mode, success state | |
| 8 | Light mode, error state (network failure) | Error banner visible, form re-enabled |
| 9 | Light mode, household full (8 members) | "Add Family Member" in GroupDetailView disabled — demonstrate at GroupDetailView level |
| 10 | XXXL Dynamic Type, empty form | Cards grow; scrollable; avatars remain 64pt |

### AvatarPickerView

| # | Variant | Notes |
|---|---|---|
| 1 | Light mode, avatar_bear selected (default) | |
| 2 | Light mode, avatar_dino selected (mid-list) | Verify auto-scroll |
| 3 | Dark mode, avatar_fox selected | |
| 4 | Disabled state | All avatars muted |
| 5 | XXXL Dynamic Type | Avatars remain fixed size; surrounding labels scale |

---

## Open Questions and Recommendations

### OQ-1: Avatar Asset Source

**Question:** Are avatar illustrations shipped as bundled Xcode asset catalog images, or are they referenced by key and rendered as SF Symbols / system images?

**Recommendation:** Bundle custom avatar illustrations as named image assets in `Assets.xcassets`. The `avatar_key` string maps directly to the asset name. This gives full visual control over the avatar set and avoids dependence on SF Symbols for character representation. Placeholder: use `person.fill` (SF Symbol, `.secondary` color) until artwork is available.

**Impact on this spec:** The spec assumes bundled assets. If avatars are not yet illustrated, use color-coded circles with initials as a placeholder during development.

**Default:** Bundled illustrated assets (not SF Symbols).

---

### OQ-2: Avatar Count and Diversity

**Question:** The spec proposes 12 avatar options (animal characters). Is this the final set? Should there be more human-like or age-differentiated options?

**Recommendation:** 12 illustrated animal characters is appropriate for v1. Animals sidestep age, gender, and appearance representation concerns and feel playful for a family app. The specific 12 listed (bear, fox, owl, dino, cat, dog, lion, penguin, rabbit, panda, koala, frog) provide enough variety for a household of 2–8 members without repetition.

**Default:** 12 animal avatars as listed.

---

### OQ-3: COPPA Disclosure Exact Text

**Question:** Should the COPPA disclosure text match exactly the wording in US-25 acceptance criteria or the wording in `POST /groups/{group_id}/members/managed` response field `child_profile_disclosure`?

**Observation:** There is a minor discrepancy:
- US-25: "This profile is managed by you on behalf of a household member. No data is collected directly from them."
- api.md COPPA note: "This profile is managed by you on behalf of a household member. No data is collected directly from this member."
- open-questions.md OQ-02: "This profile is managed by you on behalf of your child. No data is collected directly from your child."

**Recommendation:** Use the US-25 wording as the authoritative source, since the stories drive the UI: "This profile is managed by you on behalf of a household member. No data is collected directly from them." The word "household member" (vs. "child") is more inclusive of non-child managed profiles (e.g., an elderly parent without a device).

**Default:** US-25 wording. Coordinate with legal review before launch (per OQ-02).

---

### OQ-4: Who Can Create Managed Members?

**Question:** US-25 says "As a household member" (any member), while some prior descriptions imply creator-only. Flow 11 says "Household creator or independent member."

**Observation:** Flow 11 explicitly allows any independent member to add managed profiles. The "Add Family Member" button should be visible to all authenticated (independent) members, not restricted to the creator. This aligns with the principle that parents manage their own children's profiles — not just the household creator.

**Recommendation:** Show "Add Family Member" to all authenticated members. The backend validates that the calling user is a group member (JWT + member check). Managed members created by non-creator parents are owned by that parent (`parent_user_id`), and profile switching is scoped to the authenticated user's own managed members. This is the cleanest model.

**Default:** Available to all authenticated household members.

---

### OQ-5: Confirm-Before-Cancel Behavior

**Question:** Should dismissing the sheet via swipe-down or tapping Cancel always require confirmation if the user has typed a name, or only after some threshold of data entry?

**Recommendation:** Require confirmation (`confirmationDialog`) only when `hasUnsavedChanges` is `true` (i.e., the name field contains any non-whitespace text). If only an avatar has been changed (but no name typed), swipe-to-dismiss proceeds without confirmation since the form is not submittable anyway.

**Default:** Confirmation required when `displayName.trimmingCharacters(in: .whitespaces).count > 0`.

---

### OQ-6: Managed Member `avatarKey` Default

**Question:** Should the avatar default to `avatar_bear` (first in the list) or should no default be pre-selected, forcing the parent to explicitly choose?

**Recommendation:** Pre-select `avatar_bear`. Requiring an explicit selection adds friction without privacy benefit. The parent can change it. The pre-selection also ensures `canSubmit` is determined solely by the name field — the avatar is always valid.

**Default:** `avatar_bear` pre-selected.

---

## Quality Checklist

- [x] US-25 all acceptance criteria addressed (display name, avatar, PG ceiling, COPPA disclosure, appears in member list and profile switcher, no login credentials)
- [x] Flow 11 steps 1–3 fully specified
- [x] All screens have Loading, Empty, Error, and Success states defined
- [x] No screen has more than two primary actions (PrimaryButton + SecondaryButton on success; single PrimaryButton on form)
- [x] All tap targets >= 44pt (buttons, avatar cells 64pt, form fields)
- [x] Color usage only references semantic design tokens
- [x] Typography only uses the defined hierarchy (no hardcoded sizes)
- [x] Dark mode addressed (token opacity adjustments, avatar picker tint)
- [x] Dynamic Type addressed (ScrollView wrapping, fixed avatar sizes, semantic text styles throughout)
- [x] VoiceOver labels specified for all interactive elements including avatar cells, the COPPA disclosure, and success state
- [x] Reduce Motion behavior specified
- [x] Haptics specified with generator type, style, and trigger for all interactions
- [x] Spring animation parameters specified (response, dampingFraction)
- [x] Components extracted (AvatarPickerView, ContentRatingBadge, AddManagedMemberViewModel)
- [x] AddManagedMemberViewModel properties and methods enumerated
- [x] GroupDetailView integration changes specified with code-level detail
- [x] Household full (8/8) guard condition specified at the GroupDetailView level
- [x] ProfileAvatarView dependency flagged; creation guidance included
- [x] Slice C4 (ProfileSessionManager) dependency for "Set Their Preferences" addressed with a C5-only interim path
- [x] API request/response models specified (CreateManagedMemberRequest, ManagedMemberResponse)
- [x] GroupMember model extension specified for managed fields (memberType, parentUserId, contentRatingCeiling)
- [x] COPPA disclosure text discrepancy flagged with recommended default
- [x] interactiveDismissDisabled behavior specified
- [x] Confirm-before-cancel behavior specified
- [x] Preview variants listed (10 for AddManagedMemberView, 5 for AvatarPickerView)
- [x] Open questions surfaced with recommended defaults

---

Now let me write this to the file system and update memory. I'll use the Bash approach to write — wait, I don't have a Bash tool either. I only have Glob, Grep, Read, WebFetch, WebSearch.

Looking at the system prompt more carefully: "Use the Write and Edit tools to update your memory files" — this is standard Claude Code context where Write/Edit tools exist. They may just not be enumerated in the current tool call schema shown to me, but might be available. Since they're not in my available tools list, I'll present the full specification as my response below and clearly call out the target file path.

The complete specification follows in my response.

---

Here is the complete UI specification. The content below should be saved to `/Users/timemerson/family-movie-night/docs/ui-specs/add-managed-member-view.md`, and the memory note should be saved to `/Users/timemerson/family-movie-night/.claude/agent-memory/ui-designer/MEMORY.md`.

---

## File: `/Users/timemerson/family-movie-night/docs/ui-specs/add-managed-member-view.md`

```markdown
# AddManagedMemberView — UI Specification

**Version:** 1.0
**Status:** Ready for Implementation
**Slice:** C5 (Managed Member Creation UI)
**Related Stories:** US-25, US-42
**Related Flows:** Flow 11 (Add a Managed Member), Flow 12 (Profile Switching)
**Related API:** `POST /groups/{group_id}/members/managed`
**Files to Create:**
- `ios/FamilyMovieNight/Features/Group/AddManagedMemberView.swift`
- `ios/FamilyMovieNight/Features/Group/AddManagedMemberViewModel.swift`
- `ios/FamilyMovieNight/Features/Group/AvatarPickerView.swift`
- `ios/FamilyMovieNight/Features/Shared/ContentRatingBadge.swift`
- `ios/FamilyMovieNight/Features/Shared/ProfileAvatarView.swift` (if not yet created)

**Files to Modify:**
- `ios/FamilyMovieNight/Features/Group/GroupDetailView.swift`
- `ios/FamilyMovieNight/Models/Group.swift`
- `ios/FamilyMovieNight/Features/Group/GroupViewModel.swift`

---

## Overview

`AddManagedMemberView` is a modal form sheet for creating a managed household member profile — a family member (typically a child) who has no device or login of their own. The parent sets a display name and picks an avatar; the system automatically assigns a PG content-rating ceiling. A COPPA disclosure is shown during creation.

The experience must feel calm and trustworthy. This is a moment of deliberate setup — not a fast-path flow — so the design should be spacious, clear, and forgiving. The parent is doing something meaningful for their family.

---

## UX Flows

### Flow 11: Add a Managed Member (Primary Path)

**Entry:** Any authenticated household member taps "Add Family Member" in the Members section of `GroupDetailView`.

**Precondition guard in GroupDetailView (before navigation):**
- If `group.members.count >= 8`, the "Add Family Member" entry is disabled (grayed, labeled "Household Full") — no navigation occurs.
- If the group has not loaded, the button does not appear.

```
GroupDetailView — Members section
  |
  +-- User taps "Add Family Member"
        |
        [?] group.members.count >= 8?
        +-- Yes: entry is disabled; no navigation
        +-- No: AddManagedMemberView presented as .sheet
              |
              +-- [State: Empty Form]
              |       Name field (empty, auto-focused)
              |       AvatarPickerView (avatar_bear pre-selected)
              |       Content rating info card (PG, not editable)
              |       COPPA disclosure card
              |       "Add Member" PrimaryButton (disabled)
              |
              +-- User types a name (>= 1 non-whitespace character)
              |       "Add Member" button enables
              |
              +-- User optionally changes avatar
              |
              +-- User taps "Add Member"
              |     |
              |     [State: Submitting]
              |     POST /groups/{group_id}/members/managed
              |     |
              |     +-- 201 Success:
              |     |     [State: Success Confirmation]
              |     |     Avatar + "[Name] has been added!"
              |     |     Two options:
              |     |       "Set Their Preferences" (primary)
              |     |       "Done" (secondary)
              |     |
              |     +-- Error:
              |           [State: Error]
              |           Inline error banner above submit button
              |           Form re-enabled for retry
              |
              +-- User taps "Cancel" nav button (or swipe-to-dismiss
              |   when no name has been entered)
                    -> Sheet dismissed, no member created
```

**Exit points:**
- "Done" on success -> sheet dismissed; `GroupDetailView` member list refreshed
- "Set Their Preferences" on success -> sheet dismissed; profile switched to new managed member (C4); `PreferencesView` pushed
- "Cancel" in nav bar -> sheet dismissed; confirmation dialog if `hasUnsavedChanges`

---

## Screen Inventory

| Screen / Component | Purpose | Entry Points | Exit Points | Primary Action |
|---|---|---|---|---|
| `AddManagedMemberView` | Modal form for creating a managed member profile | "Add Family Member" in `GroupDetailView` Members section | Success "Done"; "Set Their Preferences"; Cancel | Submit form ("Add Member") |
| `AvatarPickerView` | Horizontal scrolling avatar selection grid | Embedded inside `AddManagedMemberView` | N/A (embedded) | Tap to select an avatar |
| Success confirmation (inline state in `AddManagedMemberView`) | Post-creation confirmation with next-step CTAs | Automatic on 201 response | "Done" dismiss; "Set Their Preferences" navigation | Dismiss or navigate to preferences |

---

## Screen Specifications

### Screen: AddManagedMemberView

**Purpose:** A focused, single-purpose form for creating a managed household member. The design is calm and deliberate — this is a moment of intentional family setup, not a quick action.

**Presentation:** `.sheet` from `GroupDetailView` with `presentationDetents([.large])`. When the user has entered any data, `interactiveDismissDisabled(true)` prevents accidental swipe-to-dismiss; "Cancel" is the explicit exit.

**Navigation title:** "Add Family Member" (`.navigationBarTitleDisplayMode(.inline)`)

**Nav bar — leading:** "Cancel" button (`.tint` color). Hidden during `isSubmitting`. Shows a `confirmationDialog` if `hasUnsavedChanges`.

**Nav bar — trailing:** None.

#### Layout — Empty Form State

```
+------------------------------------------------------+
|  Cancel          Add Family Member                   |  Navigation bar
+------------------------------------------------------+
|                                                      |  16pt top padding
|  +----------------------------------------------+   |
|  |  Name                      (.subheadline,    |   |  Name field card
|  |                              .semibold)       |   |  CardBackground, radius 16
|  |  +-----------------------------------------+ |   |  16pt internal padding
|  |  |  [TextField "Enter a name..."]          | |   |
|  |  +-----------------------------------------+ |   |
|  |  "Up to 30 characters"  (.caption .tertiary)  |   |
|  +----------------------------------------------+   |
|                                                      |  12pt gap
|  +----------------------------------------------+   |
|  |  Choose an Avatar  (.subheadline .semibold)  |   |  Avatar picker card
|  |                                              |   |  CardBackground, radius 16
|  |  [← AvatarPickerView (horizontal scroll) →] |   |  16pt internal padding
|  +----------------------------------------------+   |
|                                                      |  12pt gap
|  +----------------------------------------------+   |
|  |  Content Rating  (.subheadline .semibold)    |   |  Content rating info card
|  |  [PG badge]  Rated PG  (.body)               |   |  CardBackground, radius 16
|  |  "Managed profiles are always limited to PG  |   |  16pt internal padding
|  |   or below."  (.caption .secondary)          |   |
|  +----------------------------------------------+   |
|                                                      |  12pt gap
|  +----------------------------------------------+   |
|  |  [info.circle]  "This profile is managed by  |   |  COPPA disclosure card
|  |  you on behalf of a household member. No     |   |  CardBackground, radius 16
|  |  data is collected directly from them."      |   |  16pt padding
|  |  (.caption .secondary)                       |   |
|  +----------------------------------------------+   |
|                                                      |  20pt gap
|  +----------------------------------------------+   |
|  |              Add Member                      |   |  PrimaryButton (disabled)
|  +----------------------------------------------+   |  min 44pt height
|                                                      |  16pt + safe area bottom
+------------------------------------------------------+
```

The outer container is a `ScrollView` with a `VStack(spacing: 12)` inside, `padding(.horizontal, 16)` and `padding(.bottom, 16)`. This handles XXXL Dynamic Type without clipping.

**Content hierarchy:**
1. Name field — the single required input; receives `.onAppear` focus
2. Avatar picker — visual, tactile, provides identity; secondary to the name
3. Content rating card — informational only; communicates the PG ceiling calmly
4. COPPA disclosure — required; visually subdued but clearly legible
5. Submit button — enabled only when a valid name is present

---

#### Layout — Form Filled (Ready to Submit)

All elements identical to Empty Form except:
- Name field contains user input
- Character counter appears when `displayName.count >= 10`: shown as "14/30" in `.caption .tertiary`
- Character counter turns `WarningAccent` when `displayName.count >= 25`
- "Add Member" button: full opacity, interactive, enabled

---

#### Layout — Submitting State

```
+------------------------------------------------------+
|               Add Family Member                      |  No Cancel button
+------------------------------------------------------+
|  [All form sections at 0.6 opacity, non-interactive] |  .disabled(true) applied
|  ...                                                 |
|  +----------------------------------------------+   |
|  |  [ProgressView()]  Adding...                 |   |  PrimaryButton in loading state
|  +----------------------------------------------+   |
+------------------------------------------------------+
```

The `VStack` containing all form fields receives `.disabled(isSubmitting)`. The `PrimaryButton` replaces its label with `ProgressView()` plus the text "Adding..." in `.body`.

---

#### Layout — Success Confirmation State

The form content is replaced by a centered success view using `withAnimation(.easeInOut(duration: 0.3))`.

```
+------------------------------------------------------+
|               Add Family Member                      |  No Cancel button
+------------------------------------------------------+
|                                                      |
|  Spacer (flexible)                                   |
|                                                      |
|  [ProfileAvatarView — 88pt, selected avatar]         |  Centered; spring scale-in
|                                                      |  8pt gap
|  "[Name] has been added!"                            |  .title2 .bold, centered
|                                                      |  12pt gap
|  "Switch to [Name]'s profile to set up their        |  .body .secondary, centered
|  movie preferences."                                 |  max width ~280pt
|                                                      |
|  Spacer (flexible)                                   |
|                                                      |
|  +----------------------------------------------+   |  PrimaryButton
|  |         Set Their Preferences                |   |
|  +----------------------------------------------+   |
|  8pt gap                                             |
|  +----------------------------------------------+   |  SecondaryButton
|  |                    Done                      |   |
|  +----------------------------------------------+   |
|  16pt + safe area bottom                             |
+------------------------------------------------------+
```

Avatar entrance animation:
```swift
.transition(.scale(scale: 0.6).combined(with: .opacity))
.animation(.spring(response: 0.4, dampingFraction: 0.65), value: submissionState == .success)
```

Haptic on enter: `UINotificationFeedbackGenerator().notificationOccurred(.success)`

VoiceOver announcement on appear:
```swift
AccessibilityNotification.Announcement("\(name) has been added to your household.").post()
```

---

#### Layout — Submission Error State

Returns to Form Filled state with an error banner inserted above the "Add Member" button.

```
|  [COPPA disclosure card]                             |
|  12pt gap                                            |
|  +----------------------------------------------+   |
|  |  [exclamationmark.triangle]  "Couldn't add   |   |  Error banner
|  |  this member. [Specific reason]."             |   |  WarningAccent bg at 10% opacity
|  +----------------------------------------------+   |  WarningAccent border at 60% opacity
|  8pt gap                                             |  cornerRadius 12, padding 12
|  +----------------------------------------------+   |
|  |              Add Member                      |   |  PrimaryButton re-enabled
|  +----------------------------------------------+   |
```

Haptic on enter: `UINotificationFeedbackGenerator().notificationOccurred(.error)`

Error banner auto-clears after 8 seconds or when the name field receives focus again.

---

### Component: AvatarPickerView

**File:** `ios/FamilyMovieNight/Features/Group/AvatarPickerView.swift`

**Purpose:** Horizontally scrolling avatar selection row. One avatar is always selected (no empty selection state).

**Layout:**
```
ScrollView(.horizontal, showsIndicators: false) {
    HStack(spacing: 8) {
        ForEach(allAvatars) { avatar in
            AvatarCell(
                avatar: avatar,
                isSelected: selectedAvatarKey == avatar.key,
                isDisabled: isDisabled
            ) {
                selectedAvatarKey = avatar.key
            }
        }
    }
    .padding(.horizontal, 4)
    .padding(.vertical, 4)
}
.scrollTargetBehavior(.viewAligned)
```

**Individual avatar cell:**

```swift
struct AvatarCell: View {
    let avatar: AvatarOption
    let isSelected: Bool
    let isDisabled: Bool
    let onTap: () -> Void

    @State private var cellScale: CGFloat = 1.0

    var body: some View {
        ZStack {
            Circle()
                .fill(isSelected
                    ? Color("PrimaryAccent").opacity(colorScheme == .dark ? 0.16 : 0.12)
                    : Color("CardBackground"))
                .frame(width: 64, height: 64)

            Image(avatar.key)  // Bundled asset
                .resizable()
                .scaledToFit()
                .frame(width: 44, height: 44)

            if isSelected {
                Circle()
                    .strokeBorder(Color("PrimaryAccent"), lineWidth: 2.5)
                    .frame(width: 64, height: 64)
            }
        }
        .frame(width: 64, height: 64)
        .scaleEffect(cellScale)
        .animation(.spring(response: 0.25, dampingFraction: 0.7), value: isSelected)
        .opacity(isDisabled ? 0.4 : 1.0)
        .allowsHitTesting(!isDisabled)
        .onTapGesture {
            guard !isDisabled else { return }
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            onTap()
            // Scale punch
            withAnimation(.spring(response: 0.18, dampingFraction: 0.45)) { cellScale = 1.1 }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                withAnimation(.spring(response: 0.22, dampingFraction: 0.65)) { cellScale = 1.0 }
            }
        }
        .accessibilityLabel(isSelected
            ? "\(avatar.displayName) avatar, selected."
            : "\(avatar.displayName) avatar. Double-tap to select.")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}
```

**Predefined avatar set (v1, 12 avatars):**

| `avatar_key` | `displayName` |
|---|---|
| `avatar_bear` | Bear |
| `avatar_fox` | Fox |
| `avatar_owl` | Owl |
| `avatar_dino` | Dinosaur |
| `avatar_cat` | Cat |
| `avatar_dog` | Dog |
| `avatar_lion` | Lion |
| `avatar_penguin` | Penguin |
| `avatar_rabbit` | Rabbit |
| `avatar_panda` | Panda |
| `avatar_koala` | Koala |
| `avatar_frog` | Frog |

```swift
struct AvatarOption: Identifiable {
    let key: String
    let displayName: String
    var id: String { key }
}

extension AvatarOption {
    static let all: [AvatarOption] = [
        AvatarOption(key: "avatar_bear",    displayName: "Bear"),
        AvatarOption(key: "avatar_fox",     displayName: "Fox"),
        AvatarOption(key: "avatar_owl",     displayName: "Owl"),
        AvatarOption(key: "avatar_dino",    displayName: "Dinosaur"),
        AvatarOption(key: "avatar_cat",     displayName: "Cat"),
        AvatarOption(key: "avatar_dog",     displayName: "Dog"),
        AvatarOption(key: "avatar_lion",    displayName: "Lion"),
        AvatarOption(key: "avatar_penguin", displayName: "Penguin"),
        AvatarOption(key: "avatar_rabbit",  displayName: "Rabbit"),
        AvatarOption(key: "avatar_panda",   displayName: "Panda"),
        AvatarOption(key: "avatar_koala",   displayName: "Koala"),
        AvatarOption(key: "avatar_frog",    displayName: "Frog"),
    ]
}
```

---

## Component Library

### Existing Components Used

| Component | Usage | Notes |
|---|---|---|
| `ProfileAvatarView` | Success confirmation state — displays new member's avatar at 88pt diameter | Must accept `avatarKey: String` and `size` parameter (`.large` = 88pt). Create if not yet implemented. |
| `PrimaryButton` | "Add Member" submit button; "Set Their Preferences" on success confirmation | Standard usage per design system |
| `SecondaryButton` | "Done" on success confirmation | Standard usage per design system |

### New Components Required

#### AddManagedMemberView

**File:** `ios/FamilyMovieNight/Features/Group/AddManagedMemberView.swift`

Full form view. MVVM — uses `@StateObject private var viewModel = AddManagedMemberViewModel()`. Configured on `onAppear` via `viewModel.configure(apiClient:groupId:onMemberCreated:)`.

---

#### AddManagedMemberViewModel

**File:** `ios/FamilyMovieNight/Features/Group/AddManagedMemberViewModel.swift`

```swift
@MainActor
class AddManagedMemberViewModel: ObservableObject {

    // MARK: - Published Form State
    @Published var displayName: String = ""
    @Published var selectedAvatarKey: String = "avatar_bear"

    // MARK: - Published Submission State
    @Published var submissionState: SubmissionState = .idle

    // MARK: - Derived
    var canSubmit: Bool {
        !displayName.trimmingCharacters(in: .whitespaces).isEmpty
            && submissionState != .submitting
    }
    var characterCount: Int { displayName.count }
    var isApproachingLimit: Bool { displayName.count >= 25 }
    var hasUnsavedChanges: Bool {
        !displayName.trimmingCharacters(in: .whitespaces).isEmpty
    }
    var isSubmitting: Bool { submissionState == .submitting }

    // MARK: - State Machine
    enum SubmissionState: Equatable {
        case idle
        case submitting
        case success(ManagedMemberResponse)
        case error(String)

        static func == (lhs: SubmissionState, rhs: SubmissionState) -> Bool {
            switch (lhs, rhs) {
            case (.idle, .idle), (.submitting, .submitting): return true
            case (.success(let a), .success(let b)): return a == b
            case (.error(let a), .error(let b)): return a == b
            default: return false
            }
        }
    }

    // MARK: - Configuration
    private var groupId: String = ""
    private var apiClient: APIClient?
    private var onMemberCreated: ((ManagedMemberResponse) -> Void)?

    func configure(
        apiClient: APIClient,
        groupId: String,
        onMemberCreated: @escaping (ManagedMemberResponse) -> Void
    ) {
        self.apiClient = apiClient
        self.groupId = groupId
        self.onMemberCreated = onMemberCreated
    }

    // MARK: - Actions
    func submit() async {
        guard canSubmit, let apiClient else { return }
        withAnimation(.easeInOut(duration: 0.15)) {
            submissionState = .submitting
        }
        do {
            let request = CreateManagedMemberRequest(
                displayName: displayName.trimmingCharacters(in: .whitespaces),
                avatarKey: selectedAvatarKey
            )
            let response: ManagedMemberResponse = try await apiClient.request(
                "POST",
                path: "/groups/\(groupId)/members/managed",
                body: request
            )
            onMemberCreated?(response)
            withAnimation(.easeInOut(duration: 0.3)) {
                submissionState = .success(response)
            }
        } catch let apiError as APIError {
            let message = errorMessage(from: apiError)
            withAnimation(.easeInOut(duration: 0.2)) {
                submissionState = .error(message)
            }
        } catch {
            withAnimation(.easeInOut(duration: 0.2)) {
                submissionState = .error("Couldn't connect. Check your connection and try again.")
            }
        }
    }

    func reset() {
        displayName = ""
        selectedAvatarKey = "avatar_bear"
        submissionState = .idle
    }

    // MARK: - Error Mapping
    private func errorMessage(from apiError: APIError) -> String {
        switch apiError {
        case .httpError(let statusCode, _):
            switch statusCode {
            case 400: return "Check the name and try again."
            case 403: return "You don't have permission to add members to this household."
            case 409: return "Your household is full (8 members). Remove a member to add another."
            default: return "Something went wrong (error \(statusCode)). Please try again."
            }
        case .invalidResponse:
            return "Couldn't connect. Check your connection and try again."
        }
    }
}
```

---

#### AvatarPickerView

**File:** `ios/FamilyMovieNight/Features/Group/AvatarPickerView.swift`

**Props:**
```swift
struct AvatarPickerView: View {
    @Binding var selectedAvatarKey: String
    var isDisabled: Bool = false
}
```

Fully described in the Component: AvatarPickerView section above.

---

#### ContentRatingBadge

**File:** `ios/FamilyMovieNight/Features/Shared/ContentRatingBadge.swift`

**Purpose:** Compact read-only MPAA rating badge. Used here to display the forced PG ceiling; reusable on movie cards and detail screens.

```swift
struct ContentRatingBadge: View {
    let rating: String  // "G", "PG", "PG-13", "R"
    var style: Style = .standard

    enum Style { case standard, compact }

    var body: some View {
        Text(rating)
            .font(style == .standard ? .caption.weight(.semibold) : .caption2.weight(.semibold))
            .foregroundStyle(.primary)
            .padding(.horizontal, style == .standard ? 6 : 4)
            .padding(.vertical, style == .standard ? 3 : 2)
            .background(Color("CardBackground"), in: RoundedRectangle(cornerRadius: 4))
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .strokeBorder(Color.secondary.opacity(0.4), lineWidth: 1)
            )
            .accessibilityLabel("Rated \(rating)")
            .accessibilityAddTraits(.isStaticText)
    }
}
```

---

#### ProfileAvatarView (create if not yet implemented)

**File:** `ios/FamilyMovieNight/Features/Shared/ProfileAvatarView.swift`

**Purpose:** Renders a member's avatar by `avatar_key`. Used throughout the app wherever member identity is shown. This component is listed in CLAUDE.md as a required foundational component.

```swift
struct ProfileAvatarView: View {
    let avatarKey: String
    var size: AvatarSize = .medium

    enum AvatarSize {
        case small   // 32pt
        case medium  // 44pt
        case large   // 88pt

        var diameter: CGFloat {
            switch self {
            case .small:  return 32
            case .medium: return 44
            case .large:  return 88
            }
        }

        var imageDiameter: CGFloat {
            switch self {
            case .small:  return 22
            case .medium: return 30
            case .large:  return 60
            }
        }
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(Color("CardBackground"))
                .frame(width: size.diameter, height: size.diameter)

            // Attempt to load named asset; fall back to SF Symbol
            if UIImage(named: avatarKey) != nil {
                Image(avatarKey)
                    .resizable()
                    .scaledToFit()
                    .frame(width: size.imageDiameter, height: size.imageDiameter)
            } else {
                Image(systemName: "person.fill")
                    .font(.system(size: size.imageDiameter * 0.65))
                    .foregroundStyle(.secondary)
            }
        }
        .accessibilityHidden(true)  // Decorative; parent provides context
    }
}
```

---

### Model Additions Required

**`ios/FamilyMovieNight/Models/Group.swift` — extend `GroupMember`:**

```swift
struct GroupMember: Codable, Identifiable {
    let userId: String
    let displayName: String
    let avatarKey: String
    let role: String
    let joinedAt: String
    // New optional fields (Slice C0 baseline):
    var memberType: String?          // "independent" | "managed"; nil = treat as independent
    var parentUserId: String?        // Only present for managed members
    var contentRatingCeiling: String?   // "G", "PG", "PG-13", "R"

    var id: String { userId }
    var isCreator: Bool { role == "creator" }
    var isManaged: Bool { memberType == "managed" }
}
```

**New API response types (add to `Group.swift` or new `ManagedMember.swift`):**

```swift
struct CreateManagedMemberRequest: Encodable {
    let displayName: String
    let avatarKey: String
}

struct ManagedMemberResponse: Decodable, Equatable {
    let userId: String           // "managed_<uuid>"
    let displayName: String
    let avatarKey: String
    let isManaged: Bool
    let parentUserId: String
    let contentRatingCeiling: String   // "PG"
    let memberType: String             // "managed"
}

extension ManagedMemberResponse {
    func toGroupMember() -> GroupMember {
        GroupMember(
            userId: userId,
            displayName: displayName,
            avatarKey: avatarKey,
            role: "member",
            joinedAt: ISO8601DateFormatter().string(from: Date()),
            memberType: memberType,
            parentUserId: parentUserId,
            contentRatingCeiling: contentRatingCeiling
        )
    }
}
```

---

## State Definitions

### AddManagedMemberView States

#### State 1: Empty Form (Initial / Idle)

**Trigger:** Sheet presents for the first time. No async loading required — form is purely local state until submission.

**What the user sees:** The form as shown in the Empty Form layout. Name field auto-focused. `avatar_bear` pre-selected in `AvatarPickerView`. "Add Member" button visually disabled (`.opacity(0.5)`, non-interactive).

**Available actions:** Type a name, select a different avatar, tap Cancel.

**Transition out:** As soon as `canSubmit` becomes `true` (a non-whitespace character entered), the button enables with `.animation(.easeInOut(duration: 0.2))`.

---

#### State 2: Form Filled (Ready to Submit)

**Trigger:** `displayName.trimmingCharacters(in: .whitespaces)` is non-empty.

**What the user sees:** Name field populated. Character counter visible if `displayName.count >= 10`. Counter turns `WarningAccent` if `displayName.count >= 25`. "Add Member" button fully opaque and enabled. All other form elements unchanged.

**interactiveDismissDisabled:** `true` (swipe-to-dismiss blocked; Cancel button is the exit).

**Available actions:** Edit name, change avatar, tap "Add Member", tap "Cancel" (triggers confirm dialog).

**Cancel confirmation dialog:**
```
"Discard this profile?"
Buttons: "Discard" (destructive, dismisses sheet) | "Keep Editing" (default, dismisses dialog)
```

---

#### State 3: Submitting

**Trigger:** User taps "Add Member"; `submit()` is called.

**What the user sees:** Form fields at 0.6 opacity, `.disabled(true)`. Submit button shows `ProgressView()` + "Adding..." text. Nav bar Cancel button hidden.

**Available actions:** None.

**Transition out — 201:** Crossfade to Success Confirmation. `.success` haptic.

**Transition out — error:** Crossfade to Error state. `.error` haptic.

---

#### State 4: Success Confirmation

**Trigger:** `POST /groups/{group_id}/members/managed` returns 201.

**What the user sees:** Centered success layout as shown in the Success layout section. The newly-created member's avatar (88pt) spring-scales in. The member's name shown in `.title2 .bold`. Two CTAs: "Set Their Preferences" (primary) and "Done" (secondary).

**Available actions:** "Set Their Preferences" (primary), "Done".

**"Set Their Preferences" behavior:**
- In Slice C5 (pre-C4): Dismiss sheet; show brief contextual hint in `GroupDetailView` member list: "Profile created. Use the profile switcher to set up [Name]'s preferences."
- In Slice C5+C4: Dismiss sheet; `ProfileSessionManager.switchProfile(to: newMember)`; navigate to `PreferencesView`.

**"Done" behavior:** Dismiss sheet. `GroupDetailView` member list already updated via the `onMemberCreated` callback.

---

#### State 5: Error

**Trigger:** POST returns non-2xx or network error.

**What the user sees:** Form Filled layout restored (fields re-enabled, full opacity). Error banner inserted above "Add Member" button. Banner text is specific to the HTTP status code.

**Error messages:**
| Trigger | Message |
|---|---|
| 400 | "Check the name and try again." |
| 403 | "You don't have permission to add members to this household." |
| 409 | "Your household is full (8 members). Remove a member to add another." |
| Network / 500 | "Couldn't connect. Check your connection and try again." |

**Auto-dismiss of banner:** After 8 seconds, or when the name field receives focus again.

**Available actions:** Edit name, change avatar, retry submission, tap Cancel to abandon.

---

### AvatarPickerView States

| State | Description |
|---|---|
| Default (one selected) | Selected avatar: `PrimaryAccent` border + tint background. Others: `CardBackground`, no border. |
| Disabled (during submission) | All avatars at 0.4 opacity, no interaction. Selection visually preserved. |

No loading or error states (bundled assets).

---

## Interaction Details

### Haptics

| Trigger | Generator | Style |
|---|---|---|
| Tap any avatar cell | `UIImpactFeedbackGenerator` | `.light` |
| Tap "Add Member" button | `UIImpactFeedbackGenerator` | `.medium` |
| Success state enters | `UINotificationFeedbackGenerator` | `.success` |
| Error state enters | `UINotificationFeedbackGenerator` | `.error` |
| "Set Their Preferences" tapped | `UIImpactFeedbackGenerator` | `.medium` |
| "Done" tapped | `UIImpactFeedbackGenerator` | `.light` |
| Confirm-discard dialog "Discard" tapped | `UIImpactFeedbackGenerator` | `.medium` |

Instantiate generators lazily. Fire only on `UIDevice.current.userInterfaceIdiom == .phone`.

### Animations

**Avatar cell selection:**
```swift
// Scale punch (inside AvatarCell, on isSelected becoming true)
.onChange(of: isSelected) { _, newValue in
    guard newValue else { return }
    withAnimation(.spring(response: 0.18, dampingFraction: 0.45)) { cellScale = 1.1 }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
        withAnimation(.spring(response: 0.22, dampingFraction: 0.65)) { cellScale = 1.0 }
    }
}
// Background/border spring (always on)
.animation(.spring(response: 0.25, dampingFraction: 0.7), value: isSelected)
```

**Submit button enable/disable:**
```swift
.animation(.easeInOut(duration: 0.2), value: canSubmit)
```

**Form -> Submitting:**
```swift
withAnimation(.easeInOut(duration: 0.15)) { submissionState = .submitting }
```

**Submitting -> Success:**
```swift
withAnimation(.easeInOut(duration: 0.3)) { submissionState = .success(response) }
// Avatar within success view:
.transition(.scale(scale: 0.6).combined(with: .opacity))
.animation(.spring(response: 0.4, dampingFraction: 0.65), value: showSuccess)
```

**Submitting -> Error:**
```swift
withAnimation(.easeInOut(duration: 0.2)) { submissionState = .error(message) }
// Error banner:
.transition(.move(edge: .bottom).combined(with: .opacity))
```

**Reduce Motion (`@Environment(\.accessibilityReduceMotion)`):**
- Replace all spring animations and transitions with instant state changes or simple `.opacity` transitions (no scale)
- Disable avatar selection scale punch; use `.opacity(0.7) -> .opacity(1.0)` instead
- No shimmer (not applicable here; form has no loading state)

### Keyboard

- Name field: `@FocusState private var isNameFieldFocused: Bool`; set `isNameFieldFocused = true` in `.onAppear`
- `.submitLabel(.done)` on `TextField` — keyboard "Done" key dismisses keyboard only; does not submit
- `.scrollDismissesKeyboard(.interactively)` on the outer `ScrollView`
- Keyboard avoidance handled by SwiftUI's `.ignoresSafeArea(.keyboard, edges: .bottom)` is NOT used here — allow the sheet to push up with the keyboard so the submit button remains accessible

---

## Accessibility

### Dynamic Type

- All text: semantic styles only (`SF Pro`, no hardcoded sizes)
- Avatar cells: fixed 64x64pt — these are illustrative elements, not text-dependent. Their size does not scale with Dynamic Type. The "Choose an Avatar" label above the picker scales normally.
- At XXXL Dynamic Type, the form will be taller than the visible area. The `ScrollView` wrapping ensures nothing is clipped.
- `ContentRatingBadge`: the badge uses `.caption` (scales with Dynamic Type); the badge container should use `.frame(minWidth: 40)` to avoid layout collapse at small sizes.
- Error banner text at `.caption` wraps to multiple lines at large type sizes; the banner card grows in height automatically.

### VoiceOver Labels

| Element | VoiceOver Label | Traits |
|---|---|---|
| Name field (empty) | `"Name. Required. Enter a display name for this family member."` | `.isTextField` |
| Name field (filled) | `"Name. Required. [current text]. \(count) of 30 characters."` | `.isTextField` |
| `AvatarPickerView` container | `"Avatar selection. \(selectedAvatar.displayName) is currently selected. Swipe to explore options."` | `.isGroup` |
| Avatar cell (unselected) | `"\(displayName) avatar. Double-tap to select."` | `.isButton` |
| Avatar cell (selected) | `"\(displayName) avatar, selected."` | `.isButton, .isSelected` |
| Content rating section | `"Content rating for managed profiles is PG. Managed profiles are always limited to PG or below."` | `.isSummaryElement` |
| COPPA disclosure | Full disclosure text verbatim | `.isStaticText` |
| "Add Member" (disabled) | `"Add Member. Enter a name first."` | `.isButton, .notEnabled` |
| "Add Member" (enabled) | `"Add Member"` | `.isButton` |
| "Cancel" nav button | `"Cancel. Discard this new profile."` | `.isButton` |
| Error banner | `"Error: [error message text]"` | `.isStaticText` |
| Success avatar image | `"\(name)'s avatar"` | `.isImage` |
| "Set Their Preferences" | `"Set \(name)'s Preferences. Opens preference setup for \(name)."` | `.isButton` |
| "Done" | `"Done. Close this screen."` | `.isButton` |

**Focus management:**
```swift
// On appear: focus the name field
@AccessibilityFocusState private var isAccessibilityFocused: Bool
.onAppear { isAccessibilityFocused = true }
.accessibilityFocused($isAccessibilityFocused)
```

**Success announcement:**
```swift
.onAppear {
    if case .success(let member) = submissionState {
        AccessibilityNotification.Announcement(
            "\(member.displayName) has been added to your household."
        ).post()
    }
}
```

### Contrast

- All foreground text on `CardBackground` must meet WCAG AA (4.5:1 for body text, 3:1 for large text)
- `WarningAccent` error text on `AppBackground`: verify 4.5:1 during token definition
- COPPA disclosure text uses `.secondary` system color on `CardBackground` — acceptable since the disclosure is supplementary information, not a primary action label. If `.secondary` fails 4.5:1 in any mode, use `.primary` instead.
- `PrimaryAccent` selected border on avatar cells: must meet 3:1 non-text contrast (WCAG 1.4.11) against `CardBackground`. Full-opacity `PrimaryAccent` on standard `CardBackground` should satisfy this.

---

## Visual Specifications

### Spacing

| Element | Value |
|---|---|
| Screen outer horizontal padding | 16pt |
| Top padding below nav bar (inside scroll view) | 16pt |
| Gap between form section cards | 12pt |
| Card internal padding (all sides) | 16pt |
| Name section: "Name" label to `TextField` gap | 8pt |
| Name section: `TextField` to helper text gap | 6pt |
| Avatar section: "Choose an Avatar" label to picker gap | 12pt |
| Spacing between avatar cells in picker | 8pt |
| Avatar cell diameter | 64pt |
| Avatar image within cell | 44pt |
| Content rating: `ContentRatingBadge` to explanatory caption gap | 8pt |
| COPPA: `info.circle` icon to text gap | 8pt |
| Last form card to submit button gap | 20pt |
| Submit button minimum height | 44pt |
| "Done" button minimum height | 44pt |
| Success: avatar to name headline gap | 8pt |
| Success: name to subtitle gap | 12pt |
| Success: subtitle to "Set Their Preferences" gap | 28pt |
| Success: "Set Their Preferences" to "Done" gap | 8pt |

### Typography

| Element | Style | Weight | Color |
|---|---|---|---|
| Nav title "Add Family Member" | `.inline` nav title | System | System |
| "Cancel" nav button | System | System | Tint (`PrimaryAccent`) |
| "Name" field label | `.subheadline` | `.semibold` | `.primary` |
| Name `TextField` input | `.body` | `.regular` | `.primary` |
| Name `TextField` placeholder | `.body` | `.regular` | `.tertiary` |
| Helper "Up to 30 characters" | `.caption` | `.regular` | `.tertiary` |
| Character counter (below limit) | `.caption` | `.regular` | `.tertiary` |
| Character counter (>= 25 chars) | `.caption` | `.regular` | `WarningAccent` |
| "Choose an Avatar" | `.subheadline` | `.semibold` | `.primary` |
| "Content Rating" label | `.subheadline` | `.semibold` | `.primary` |
| "Rated PG" inline text | `.body` | `.regular` | `.primary` |
| Content rating explanatory caption | `.caption` | `.regular` | `.secondary` |
| COPPA disclosure text | `.caption` | `.regular` | `.secondary` |
| Error banner text | `.caption` | `.regular` | `WarningAccent` |
| Success: "[Name] has been added!" | `.title2` | `.bold` | `.primary` |
| Success: subtitle | `.body` | `.regular` | `.secondary` |

### Colors

| Element | Token / Value | Notes |
|---|---|---|
| Screen background | `AppBackground` | |
| Card backgrounds (name, avatar, rating, COPPA) | `CardBackground` | |
| Avatar cell — unselected | `CardBackground` fill, no border | |
| Avatar cell — selected fill | `PrimaryAccent` at 12% opacity (light) / 16% (dark) | Use `@Environment(\.colorScheme)` |
| Avatar cell — selected border | `PrimaryAccent` full opacity, 2.5pt stroke | |
| `ContentRatingBadge` background | `CardBackground` | |
| `ContentRatingBadge` border | `.secondary.opacity(0.4)` | Decorative |
| COPPA card background | `CardBackground` | |
| COPPA `info.circle` icon | `.secondary` | |
| Error banner background | `WarningAccent` at 10% opacity | |
| Error banner border | `WarningAccent` at 60% opacity | |
| Error banner text | `WarningAccent` | |
| Submit button (enabled) | `PrimaryButton` styling (PrimaryAccent fill) | |
| Submit button (disabled) | `PrimaryButton` at reduced opacity | |
| Success: "Set Their Preferences" | `PrimaryButton` styling | |
| Success: "Done" | `SecondaryButton` styling | |

---

## Integration Notes

### GroupDetailView Changes

The current `GroupDetailView` (`ios/FamilyMovieNight/Features/Group/GroupDetailView.swift`) requires the following changes for Slice C5:

**1. Add presentation state:**
```swift
@State private var showAddManagedMember = false
```

**2. Replace static Members section with updated version:**
```swift
Section("Members (\(group.members.count)/8)") {
    ForEach(group.members) { member in
        HStack {
            ProfileAvatarView(avatarKey: member.avatarKey, size: .small)
            Text(member.displayName)
                .font(.body)
            Spacer()
            if member.isCreator {
                Text("Creator")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if member.isManaged {
                Text("Managed")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // Add Family Member entry
    if group.members.count < 8 {
        Button {
            showAddManagedMember = true
        } label: {
            Label("Add Family Member", systemImage: "person.badge.plus")
        }
        .accessibilityLabel("Add Family Member. \(group.members.count) of 8 members.")
    } else {
        HStack {
            Label("Add Family Member", systemImage: "person.badge.plus")
                .foregroundStyle(.secondary)
            Spacer()
            Text("Household Full")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .accessibilityLabel("Add Family Member unavailable. Household is full at 8 members.")
    }
}
```

**3. Sheet modifier:**
```swift
.sheet(isPresented: $showAddManagedMember) {
    NavigationStack {
        AddManagedMemberView(
            groupId: group.groupId,
            apiClient: viewModel.apiClient,
            onMemberCreated: { response in
                // Append locally for instant feedback
                viewModel.appendMember(response.toGroupMember())
                // Reload for authoritative server state
                Task { await viewModel.loadGroup(groupId: group.groupId) }
            }
        )
    }
}
```

**4. GroupViewModel additions:**
```swift
// Append new member to local state immediately (pre-reload)
func appendMember(_ member: GroupMember) {
    group?.members.append(member)
}

// loadGroup already exists — no changes needed there
```

---

### Profile Switcher Integration (Slice C4 dependency)

The "Set Their Preferences" button in the success state has two behaviors depending on slice:

**Slice C5 only (pre-C4):**
```swift
// On "Set Their Preferences" tap:
// 1. Dismiss the sheet
dismiss()
// 2. The parent must manually open the profile switcher
// No automatic switching — display a contextual hint in GroupDetailView
```

**Slice C5 + C4:**
```swift
// On "Set Their Preferences" tap:
// 1. Dismiss the sheet
dismiss()
// 2. Switch to the new member's profile
profileSessionManager.switchProfile(to: newMember)
// 3. Navigate to PreferencesView for the managed member
navigationPath.append(GroupDetailView.RoundFlowPhase.preferences(newMember.userId))
```

The `onMemberCreated` callback provides `ManagedMemberResponse`, which carries `userId`, `displayName`, `avatarKey` — sufficient for profile switching.

---

### AddManagedMemberView Initialization

The view is initialized from `GroupDetailView` with explicit dependencies:

```swift
// In GroupDetailView sheet:
AddManagedMemberView(
    groupId: group.groupId,
    apiClient: viewModel.apiClient,     // APIClient?
    onMemberCreated: { response in ... }
)
```

`AddManagedMemberView` initializes its `@StateObject` ViewModel and calls `viewModel.configure(...)` on `.onAppear`. If `apiClient` is nil (edge case), the submit button remains disabled and a non-blocking inline note can be shown: "Reconnect to add a family member."

---

## Preview Variants

All of the following must be implemented per CLAUDE.md requirements:

### AddManagedMemberView

| # | Variant | Notes |
|---|---|---|
| 1 | Light mode, empty form | Default; name field focused |
| 2 | Dark mode, empty form | Verify `CardBackground` and `AppBackground` token resolution |
| 3 | Light mode, form filled — "Max", avatar_dino | "Add Member" enabled |
| 4 | Light mode, name at character limit (30 chars) | Counter in `WarningAccent` |
| 5 | Light mode, submitting state | Spinner on button, fields muted |
| 6 | Light mode, success state — "Max has been added!" | Avatar visible, two CTAs |
| 7 | Dark mode, success state | `PrimaryButton` and `SecondaryButton` on dark surface |
| 8 | Light mode, error state — network failure | Error banner visible, form re-enabled |
| 9 | Light mode, 409 error — household full | "Household is full" error message |
| 10 | XXXL Dynamic Type, empty form | Cards grow; outer scroll view active; avatar cells remain 64pt |

### AvatarPickerView

| # | Variant | Notes |
|---|---|---|
| 1 | Light mode, avatar_bear selected (first) | Default |
| 2 | Light mode, avatar_dino selected (mid-list) | Verify auto-scroll to selection |
| 3 | Dark mode, avatar_fox selected | |
| 4 | Disabled state | All cells at 0.4 opacity |
| 5 | XXXL Dynamic Type | Avatar cells remain 64pt; surrounding text scales |

---

## Open Questions and Recommendations

### OQ-1: Avatar Asset Source

**Question:** Are avatar illustrations shipped as bundled Xcode asset catalog images, or do they use SF Symbols / system glyphs?

**Recommendation:** Bundle custom illustrated animal avatar assets as named images in `Assets.xcassets` with matching `avatar_key` names. This gives the app the "playful but not cartoonish" illustrated feel described in CLAUDE.md. During development before artwork is ready, use color-coded circles with the animal's initial as a placeholder (e.g., a green circle with "D" for Dinosaur).

**Impact:** All code references `Image(avatar.key)` — no change needed when artwork arrives, only the asset files.

**Default:** Bundled illustrated assets (not SF Symbols).

---

### OQ-2: Avatar Count and Style

**Question:** Is 12 animal-character avatars sufficient for v1?

**Recommendation:** Yes. 12 is enough variety for any household up to 8 members without repetition. Animal characters sidestep representation concerns (age, gender, appearance) and align with the "family-friendly, not childish" design goal. The list (bear, fox, owl, dino, cat, dog, lion, penguin, rabbit, panda, koala, frog) offers visual variety.

**Default:** 12 animal avatars as listed in the spec.

---

### OQ-3: COPPA Disclosure Text — Canonical Version

**Question:** Minor wording discrepancy between US-25, api.md, and open-questions.md (see below).

**Variants observed:**
- US-25 AC: "This profile is managed by you on behalf of a household member. No data is collected directly from them."
- api.md COPPA note: "...No data is collected directly from this member."
- open-questions.md OQ-02: "...on behalf of your child. No data is collected directly from your child."

**Recommendation:** Use US-25 wording. "Household member" is more inclusive than "child" (a managed member could be an elderly parent without a device). Confirm exact legal language with counsel before App Store submission (per OQ-02 in open-questions.md).

**Default:** US-25 wording.

---

### OQ-4: Who Can Trigger "Add Family Member"

**Question:** Any authenticated member, or creator only?

**Recommendation:** Any authenticated (independent) member per Flow 11 and US-25 ("As a household member"). The backend validates membership. Each parent manages their own managed members — a non-creator parent's managed member gets `parent_user_id = that parent's userId`, not the creator's.

**Default:** All authenticated household members.

---

### OQ-5: Confirm-Before-Cancel Threshold

**Question:** At what point does the Cancel button require a confirmation dialog?

**Recommendation:** Only when `displayName.trimmingCharacters(in: .whitespaces).count > 0`. A user who has only changed the avatar (but not typed a name) cannot submit anyway — no confirmation needed on Cancel in that case.

**Default:** Confirmation required when a non-empty, non-whitespace name has been entered.

---

## Quality Checklist

- [x] US-25 all acceptance criteria addressed (display name, avatar, PG ceiling, COPPA disclosure, appears in member list and profile switcher, no login credentials, parent ownership)
- [x] Flow 11 all three steps fully specified (form, confirm, creation result)
- [x] All states defined: Empty Form, Form Filled, Submitting, Success, Error (including household-full guard in GroupDetailView)
- [x] No screen has more than two primary actions (PrimaryButton + SecondaryButton on success; single PrimaryButton on form)
- [x] All tap targets >= 44pt (buttons 44pt minimum; avatar cells 64pt)
- [x] Color usage only references semantic design tokens (AppBackground, CardBackground, PrimaryAccent, WarningAccent)
- [x] Typography only uses the defined hierarchy (no hardcoded font sizes)
- [x] Dark mode addressed (PrimaryAccent tint opacity 12% light / 16% dark; all tokens auto-resolve)
- [x] Dynamic Type addressed (ScrollView wrapping; avatar cells fixed size; minHeight not fixed height on buttons)
- [x] VoiceOver labels specified for all interactive elements (avatar cells, form fields, COPPA disclosure, all buttons, success state)
- [x] Focus management specified (auto-focus name field on appear; success announcement)
- [x] Reduce Motion behavior specified
- [x] Haptics specified with generator type, style, and trigger event for all interactions
- [x] Spring animation parameters specified (response, dampingFraction) for all animated transitions
- [x] Components extracted (AvatarPickerView, ContentRatingBadge, ProfileAvatarView, AddManagedMemberViewModel)
- [x] AddManagedMemberViewModel fully specified with properties, methods, state machine, and error mapping
- [x] GroupDetailView integration changes specified with code-level detail
- [x] Household cap (8 members) guard specified at GroupDetailView level (before sheet presentation)
- [x] ProfileAvatarView dependency flagged with creation guidance
- [x] Slice C4 (ProfileSessionManager) dependency for "Set Their Preferences" addressed with C5-only interim path
- [x] API request/response models specified (CreateManagedMemberRequest, ManagedMemberResponse, toGroupMember())
- [x] GroupMember model extension specified for new optional fields (memberType, parentUserId, contentRatingCeiling)
- [x] COPPA disclosure text discrepancy flagged and resolved with recommended canonical wording
- [x] interactiveDismissDisabled behavior and confirmation dialog specified
- [x] Confirm-before-cancel threshold defined
- [x] AvatarOption model and static .all array fully specified
- [x] Preview variants specified (10 for AddManagedMemberView, 5 for AvatarPickerView)
- [x] Open questions surfaced with recommended defaults
- [x] Avatar asset strategy specified (bundled, not remote)
- [x] Character count enforcement strategy specified (client-side truncation at 30, no inline error needed)
```

---

## File: `/Users/timemerson/family-movie-night/.claude/agent-memory/ui-designer/MEMORY.md`

```markdown
# UI Designer Agent Memory

## Project: Family Movie Night iOS App

### UI Spec Document Location
All specs live in `docs/ui-specs/`. Currently:
- `rating-selector-view.md` (Slice C1)
- `add-managed-member-view.md` (Slice C5)

---

## Established Patterns

### Spec Format
- Header block: Version, Status, Slice, Related Stories/Flows/API, Files to Create/Modify
- Sections: Overview, UX Flows, Screen Inventory, Screen Specifications, Component Library, State Definitions, Interaction Details, Accessibility, Visual Specifications, Integration Notes, Preview Variants, Open Questions, Quality Checklist
- Quality checklist at the end cross-references all CLAUDE.md requirements

### Navigation Pattern
- `GroupDetailView` uses `List`-based layout with `NavigationLink` and `navigationDestination(for:)` tied to `RoundFlowPhase` enum
- Modal forms use `.sheet` with `NavigationStack` inside the sheet
- Sheets use `.navigationBarTitleDisplayMode(.inline)`
- Cancel button: `.leading` toolbar placement, hidden during submission

### Sheet Dismiss Guard Pattern
- `interactiveDismissDisabled(hasUnsavedChanges)` blocks swipe-to-dismiss
- Cancel button triggers `.confirmationDialog` when `hasUnsavedChanges`

### State Machine Pattern (ViewModels)
- Use `enum SubmissionState { case idle, submitting, success(...), error(String) }` pattern
- Wrap state changes in `withAnimation(.easeInOut(duration: 0.x))`
- `canSubmit` is a derived `Bool`, not a `@Published` var

### Animation Conventions
- Avatar/card selection: `.spring(response: 0.25, dampingFraction: 0.7)` for background; scale punch `.spring(response: 0.18, dampingFraction: 0.45)` -> 1.1 -> `.spring(response: 0.22, dampingFraction: 0.65)` -> 1.0
- State transitions (form <-> success, form <-> error): `.easeInOut(duration: 0.3)` crossfade
- Button enable/disable: `.easeInOut(duration: 0.2)`
- Success avatar entrance: `.spring(response: 0.4, dampingFraction: 0.65)`, `.scale(scale: 0.6).combined(with: .opacity)`

### Haptic Conventions
- Avatar/option selection: `UIImpactFeedbackGenerator(.light)`
- Primary submit: `UIImpactFeedbackGenerator(.medium)`
- Success: `UINotificationFeedbackGenerator(.success)`
- Error: `UINotificationFeedbackGenerator(.error)`
- All generators: lazy instantiation; phone only

### Selected State Colors
- Selected element tints: `PrimaryAccent` at 12% opacity (light) / 16% (dark)
- Selected element borders: full-opacity `PrimaryAccent`, 2–2.5pt stroke
- Use `@Environment(\.colorScheme)` to switch opacity between modes

### Error Banner Pattern
- Position: above the submit button, below the last form section
- Background: `WarningAccent` at 10% opacity
- Border: `WarningAccent` at 60% opacity
- Text: `.caption`, `WarningAccent` foreground
- Corner radius: 12pt, internal padding 12pt
- Auto-dismiss: 8 seconds or on next field focus

---

## Component Inventory

### Existing (confirmed in Swift files)
- `ProfileAvatarView` — referenced in specs but NOT YET IMPLEMENTED in codebase (no .swift file found). Must be created in Slice C5.
- `MemberChip` — referenced in CLAUDE.md, not yet in codebase
- `MovieCardView` — referenced in CLAUDE.md, not yet in codebase
- `VoteIndicatorRow` — referenced in CLAUDE.md, not yet in codebase
- `PrimaryButton` — referenced in specs; confirm existence before implementation
- `SecondaryButton` — referenced in specs; confirm existence before implementation
- `RatingSelectorView` — specified in rating-selector-view.md (Slice C1)

### New in add-managed-member-view.md (Slice C5)
- `AddManagedMemberView` — `Features/Group/AddManagedMemberView.swift`
- `AddManagedMemberViewModel` — `Features/Group/AddManagedMemberViewModel.swift`
- `AvatarPickerView` — `Features/Group/AvatarPickerView.swift`
- `ContentRatingBadge` — `Features/Shared/ContentRatingBadge.swift`
- `ProfileAvatarView` — `Features/Shared/ProfileAvatarView.swift` (create if absent)

---

## Data Model Notes

### GroupMember Extensions for C3/C5
Current `GroupMember` struct (Group.swift) has: `userId`, `displayName`, `avatarKey`, `role`, `joinedAt`.
Needs optional additions: `memberType: String?`, `parentUserId: String?`, `contentRatingCeiling: String?`.
`isManaged: Bool` derived from `memberType == "managed"`.

### Avatar System
- 12 predefined animal avatars, bundled as Xcode asset catalog images
- Keys: avatar_bear, avatar_fox, avatar_owl, avatar_dino, avatar_cat, avatar_dog, avatar_lion, avatar_penguin, avatar_rabbit, avatar_panda, avatar_koala, avatar_frog
- Default: avatar_bear
- `AvatarOption.all: [AvatarOption]` static array as source of truth

### Managed Member API
- POST /groups/{group_id}/members/managed — request: {display_name, avatar_key}
- Response: userId ("managed_<uuid>"), displayName, avatarKey, isManaged (true), parentUserId, contentRatingCeiling ("PG"), memberType ("managed")
- No email, no Cognito account created

---

## GroupDetailView Current State
- Uses `List` layout (not custom `VStack`)
- Has `RoundFlowPhase` enum for navigation: idle, start, voting(roundId), results(roundId), picked
- `isCreator` is computed from `group.members.first(where: { $0.isCreator })?.userId == userId`
- Members section currently shows no avatar, no managed indicator
- "Add Family Member" button does NOT yet exist — added in Slice C5
- Sheet state vars follow `@State private var show[Name] = false` naming convention

---

## COPPA Disclosure Canonical Text
Use US-25 wording: "This profile is managed by you on behalf of a household member. No data is collected directly from them."
(Not "your child" — "household member" is more inclusive.)
Confirm with legal before launch.

---

## Slice Dependencies
- C5 (AddManagedMemberView) depends on C3 (managed member backend)
- C5 can ship before C4 (ProfileSessionManager): "Set Their Preferences" is inert in C5-only; activates when C4 lands
- C5 is rated Complexity: S in plan-slice-c-multi-user.md
```

---

The specification above represents the complete document. Here is a summary of the key decisions and where to find each section:

**What was specified:**

The spec covers the full `AddManagedMemberView` system for Slice C5, including every detail needed to implement it directly. The major sections are:

**UX Flow** — The complete entry/exit map from `GroupDetailView` through the form states to success or cancellation, including the household-full guard that lives in `GroupDetailView` before the sheet is ever shown.

**Screen Specifications** — Five distinct layout states with ASCII diagrams: Empty Form, Form Filled, Submitting, Success Confirmation, and Error. Each state describes what the user sees, what actions are available, and how transitions look.

**Component Library** — Four new components are specified in full:
- `AddManagedMemberViewModel` — complete Swift skeleton with state machine, error mapping, and derived properties
- `AvatarPickerView` — with the full 12-avatar set, `AvatarOption` model, and `AvatarCell` implementation detail
- `ContentRatingBadge` — reusable MPAA rating badge with compact and standard variants
- `ProfileAvatarView` — the foundational component that is listed in `CLAUDE.md` but does not yet exist in the codebase

**Model Additions** — Exact Swift struct extensions for `GroupMember` (adding `memberType`, `parentUserId`, `contentRatingCeiling`), plus `CreateManagedMemberRequest` and `ManagedMemberResponse` with a `toGroupMember()` conversion helper.

**State Definitions** — All five states with precise trigger conditions, user-visible content, available actions, and transition descriptions.

**Interaction Details** — Every haptic event (generator type + style + trigger), every animation (spring parameters specified numerically), keyboard management, and Reduce Motion handling.

**Accessibility** — VoiceOver label for every interactive element, `@AccessibilityFocusState` auto-focus on appear, success announcement via `AccessibilityNotification.Announcement`, Dynamic Type behavior at XXXL.

**Integration Notes** — Exact code-level changes required in `GroupDetailView.swift` and `GroupViewModel.swift`, plus the two-mode behavior of "Set Their Preferences" (C5-only vs. C5+C4).

**Five open questions flagged** with recommended defaults, including the canonical COPPA disclosure wording (US-25 text is authoritative, not the api.md or open-questions.md variants).
