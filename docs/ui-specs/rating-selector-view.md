# RatingSelectorView — UI Specification

**Version:** 1.0
**Status:** Ready for Implementation
**Slice:** C1 (Ratings Service — Backend + iOS)
**Related Stories:** US-19, US-46
**Related Flows:** Flow 4 (Marking Watched), Flow 6 step 6 (Post-Watch Rating), Flow 7 step 10, Flow 13 (Session History)
**Related API:** `POST /rounds/{round_id}/ratings`, `GET /rounds/{round_id}/ratings`
**Implements:** `RatingSelectorView` (interactive picker) + `RatingSummaryView` (read-only aggregate)

---

## Overview

After a household watches their picked movie, each attending member rates it on a 3-point scale: **Loved**, **Liked**, or **Did Not Like**. Ratings are individual and keyed by `round_id + member_id`. The session auto-transitions from `watched` to `rated` when all attendees have submitted a rating. The household creator can also close ratings early.

This spec covers two components:

1. **`RatingSelectorView`** — The interactive rating picker embedded in `RatingView`. Presented as a sheet from `PickConfirmationView` after marking the movie as watched.
2. **`RatingSummaryView`** — A read-only aggregate rating display. Used in session history list rows and session detail screens.

Both components must feel warm, celebratory, and calm — not clinical. Rating a movie together is the satisfying close to a family movie night; the UI should reflect that.

---

## UX Flows

### Flow A: Rating Prompt via Post-Watch Path (Primary)

```
PickConfirmationView
  |
  +-- User taps "We Watched It"
        |
        +-- [System] PATCH /rounds/{id} -> { "status": "watched" }
        +-- [System] Session transitions to `watched`
        |
        +-- [UI] Sheet presents: RatingView
              |
              +-- [State] Loading: shimmer skeleton while fetching existing ratings
              |
              +-- [State] Unrated: Movie header + three rating option cards shown
              |
              +-- User taps one option (Loved / Liked / Did Not Like)
              |     +-- Spring animation on card, light haptic fires
              |
              +-- User taps "Save My Rating"
              |     +-- [System] POST /rounds/{id}/ratings -> { "rating": "loved" }
              |     +-- [State] Submitting: spinner on button, options disabled
              |     |
              |     +-- [System] On success:
              |           +-- [State] Wait: "Your rating is in!"
              |           |         Shows who has and hasn't rated
              |           |
              |           [?] All attendees rated?
              |           +-- Yes -> [System] Session auto-transitions to `rated`
              |           |         [State] All-Rated: summary + "Done" button
              |           +-- No  -> Wait state; creator sees "Close Ratings"
              |
              +-- User taps "Skip for now" at any time before submitting
              |     +-- Sheet dismissed, no rating recorded
              |
              +-- [Error] POST fails -> inline error, options re-enabled
```

**Managed Member Path:** When the active profile is a managed member, a persistent "Rating as [Name]" pill appears below the rating options. The rating is attributed to that member's `member_id` via the `X-Acting-As-Member` header. After rating as a managed member, the parent must manually switch profiles to rate on their own behalf.

### Flow B: Rating from Session History (Secondary)

```
SessionHistoryView
  +-- User taps a session with status: "watched"
        +-- SessionDetailView
              +-- "Rate Now" button (if active member hasn't rated)
                    +-- Sheet presents: RatingView (same component)
```

### Flow C: Creator Closes Ratings Early

```
RatingView (Wait state -- after active member has submitted)
  +-- Creator taps "Close Ratings" (SecondaryButton)
        +-- Confirmation alert:
              "End the rating period? Members who haven't rated
               will be recorded as not rated."
              +-- "End Ratings" -> PATCH /rounds/{id} -> { "status": "rated" }
              |                   Transition to All-Rated state
              +-- "Cancel"     -> Dismiss alert
```

---

## Screen Inventory

| Component | Purpose | Entry Points | Exit Points | Primary Action |
|---|---|---|---|---|
| `RatingView` | Full-screen modal container for the post-watch rating flow | Sheet from `PickConfirmationView`; "Rate Now" from `SessionDetailView` | "Done" dismiss; "Skip for now" dismiss | Submit rating |
| `RatingSelectorView` | Interactive 3-option rating picker, embedded in `RatingView` | Rendered inside `RatingView` | N/A — embedded | Tap to select a rating option |
| `RatingWaitView` | Post-submission wait state showing per-member rating status | Shown inside `RatingView` after successful POST | N/A — embedded | "Close Ratings" (creator only) |
| `RatingSummaryView` | Read-only aggregate display | Session history list rows; session detail screen | N/A — display only | None |
| `RatingMemberRowView` | Single member + rating status row | Embedded in `RatingWaitView`, `SessionDetailView` | N/A — display only | None |
| `MovieHeaderCard` | Movie identity anchor (poster + title + metadata) | Top of `RatingView`; reusable elsewhere | N/A — display only | None |

---

## Screen Specifications

### Screen: RatingView

**Purpose:** Full-screen modal container housing the movie header, `RatingSelectorView`, submission controls, and post-submission wait state.

**Presentation:** `.sheet` with `presentationDetents([.large])`. When an option is selected but not yet submitted, use `interactiveDismissDisabled(true)` to prevent accidental swipe-to-dismiss. "Skip for now" is the explicit escape path.

#### Layout — Unrated State

```
+------------------------------------------------------+
|  +================================================+  |  Navigation bar (.inline)
|  |  "Rate the Movie"              [Skip for now]  |  |
|  +================================================+  |
|                                                      |
|  +----------------------------------------------+   |  MovieHeaderCard
|  |  [Poster]   Movie Title (.title3 .semibold)  |   |  CardBackground, radius 16
|  |  60x90pt    2022 . PG-13 (.caption .second)  |   |  16pt internal padding
|  +----------------------------------------------+   |
|  20pt gap                                            |
|  "How was it?"  (.title2)                            |
|  8pt gap                                             |
|  +----------+   +----------+   +---------------+   |  RatingSelectorView
|  |    heart |   |   thumb  |   |   thumb       |   |  Three RatingOptionCards
|  |  Loved   |   |  Liked   |   | Did Not Like  |   |  Equal width, min 88pt height
|  +----------+   +----------+   +---------------+   |  8pt spacing
|  12pt gap                                            |
|  [Rating as Max -- pill, only when managed member]   |  .caption, PrimaryAccent tint
|  20pt gap                                            |
|  +----------------------------------------------+   |  PrimaryButton
|  |              Save My Rating                  |   |  Disabled until option selected
|  +----------------------------------------------+   |
|  16pt + safe area bottom                             |
+------------------------------------------------------+
```

#### Layout — Wait State (after submitting, not all rated)

```
+------------------------------------------------------+
|  +================================================+  |
|  |  "Rate the Movie"                              |  |  No "Skip" -- already submitted
|  +================================================+  |
|                                                      |
|  [MovieHeaderCard -- unchanged]                      |
|  20pt gap                                            |
|  "Your rating is in!"  heart  (.title2 .bold)       |  Confirmation + rating echo
|  "Waiting for 2 more to rate."  (.body .secondary)  |
|  16pt gap                                            |
|  +----------------------------------------------+   |  Member list card
|  |  [Avatar] Tim      heart Loved     check     |   |  CardBackground, radius 16
|  |  [Avatar] Sarah    - Not yet                 |   |  16pt padding
|  |  [Avatar] Max      - Not yet                 |   |  RatingMemberRowView x N
|  +----------------------------------------------+   |
|  16pt gap                                            |
|  [Creator only:]                                     |
|  +----------------------------------------------+   |  SecondaryButton
|  |              Close Ratings                   |   |
|  +----------------------------------------------+   |
+------------------------------------------------------+
```

#### Layout — All-Rated State

```
+------------------------------------------------------+
|  +================================================+  |
|  |  "Rate the Movie"                              |  |
|  +================================================+  |
|                                                      |
|  [MovieHeaderCard -- unchanged]                      |
|  20pt gap                                            |
|  "Everyone's in!"  (.title2 .bold)                   |
|  "Here's how you all felt:"  (.body .secondary)      |
|  16pt gap                                            |
|  [RatingSummaryView -- expanded style]               |
|  20pt gap                                            |
|  +----------------------------------------------+   |  PrimaryButton
|  |                    Done                      |   |
|  +----------------------------------------------+   |
+------------------------------------------------------+
```

**Navigation:**
- Navigation title: "Rate the Movie" (`.navigationBarTitleDisplayMode(.inline)`)
- Trailing nav bar item: "Skip for now" (tint color, available in Unrated and Loading states only)
- No back navigation — modal sheet
- On "Done" or "Skip": sheet dismisses, returns to `PickConfirmationView`

**ViewModel Requirements — `RatingViewModel` must expose:**
- `selectedRating: RatingValue?`
- `isSubmitting: Bool`
- `hasSubmitted: Bool`
- `isLoading: Bool`
- `error: String?`
- `ratingEntries: [RatingEntry]` — all attendees with rating status
- `allRated: Bool` — derived
- `ratedCount: Int` — derived
- `totalAttendees: Int` — derived
- `alreadyRated: Bool` — whether active member already has a rating
- `isCreator: Bool`
- `ratingsClosed: Bool` — round is in `rated` status
- `activeProfileName: String?` — non-nil when acting as managed member
- `roundId: String`
- `movieTitle: String`, `movieYear: Int`, `movieContentRating: String?`, `posterURL: URL?`

---

## Component Library

### Existing Components Used

| Component | Usage |
|---|---|
| `ProfileAvatarView` | Member avatars in `RatingMemberRowView` |
| `PrimaryButton` | "Save My Rating" and "Done" buttons |
| `SecondaryButton` | "Close Ratings" (creator only) |

### New Components Required

| Component | File | Notes |
|---|---|---|
| `RatingView` | `Features/Rounds/RatingView.swift` | Full screen modal container |
| `RatingWaitView` | `Features/Rounds/RatingView.swift` | Sub-view within `RatingView` |
| `RatingSelectorView` | `Features/Rounds/RatingSelectorView.swift` | Reusable — use wherever a rating is collected |
| `RatingOptionCard` | `Features/Rounds/RatingSelectorView.swift` | Sub-component of `RatingSelectorView` |
| `RatingSummaryView` | `Features/Shared/RatingSummaryView.swift` | Reusable — history, session detail |
| `RatingMemberRowView` | `Features/Rounds/RatingMemberRowView.swift` | Reusable — wait state + history |
| `MovieHeaderCard` | `Features/Shared/MovieHeaderCard.swift` | Reusable — pick confirmation, rating, detail |
| `RatingViewModel` | `Features/Rounds/RatingViewModel.swift` | MVVM — new |

### Supporting Model Additions

New file `ios/FamilyMovieNight/Models/Rating.swift`:

```swift
// MARK: - Rating Value

enum RatingValue: String, CaseIterable, Codable {
    case loved       = "loved"
    case liked       = "liked"
    case didNotLike  = "did_not_like"

    var label: String {
        switch self {
        case .loved:      return "Loved"
        case .liked:      return "Liked"
        case .didNotLike: return "Did Not Like"
        }
    }

    var icon: String {
        switch self {
        case .loved:      return "heart.fill"
        case .liked:      return "hand.thumbsup.fill"
        case .didNotLike: return "hand.thumbsdown.fill"
        }
    }

    // Used for card tint + icon/label color when selected
    var accentTokenName: String {
        switch self {
        case .loved:      return "SuccessAccent"
        case .liked:      return "PrimaryAccent"
        case .didNotLike: return "WarningAccent"
        }
    }

    var accessibilityLabel: String {
        switch self {
        case .loved:      return "Loved it"
        case .liked:      return "Liked it"
        case .didNotLike: return "Did not like it"
        }
    }
}

// MARK: - API Request/Response

struct SubmitRatingRequest: Encodable {
    let rating: String  // RatingValue.rawValue
}

struct RatingResponse: Decodable {
    let roundId:  String
    let memberId: String
    let rating:   String
    let ratedAt:  String
}

struct RatingsListResponse: Decodable {
    let roundId: String
    let ratings: [RatingEntryResponse]
}

struct RatingEntryResponse: Decodable, Identifiable {
    let memberId:    String
    let displayName: String
    let avatarKey:   String?
    let rating:      String?
    let ratedAt:     String?

    var id: String { memberId }

    var ratingValue: RatingValue? {
        guard let r = rating else { return nil }
        return RatingValue(rawValue: r)
    }
}

// MARK: - Derived Summary

struct RatingsSummary {
    let loved:         Int
    let liked:         Int
    let didNotLike:    Int
    let totalRated:    Int
    let totalAttendees: Int

    var allRated:      Bool { totalRated == totalAttendees }
    var hasAnyRating:  Bool { totalRated > 0 }

    static func from(entries: [RatingEntryResponse]) -> RatingsSummary {
        RatingsSummary(
            loved:          entries.filter { $0.rating == "loved"        }.count,
            liked:          entries.filter { $0.rating == "liked"        }.count,
            didNotLike:     entries.filter { $0.rating == "did_not_like" }.count,
            totalRated:     entries.filter { $0.rating != nil            }.count,
            totalAttendees: entries.count
        )
    }
}

// MARK: - View Model Entry (maps API response to view-ready model)

struct RatingEntry: Identifiable {
    let memberId:    String
    let displayName: String
    let avatarKey:   String
    let rating:      RatingValue?
    let ratedAt:     Date?

    var id: String  { memberId }
    var hasRated: Bool { rating != nil }
}
```

---

## Component Specifications

### RatingSelectorView

**Purpose:** Interactive 3-option rating picker. A reusable component accepting a binding to the selected rating.

**Props:**
```swift
struct RatingSelectorView: View {
    @Binding var selectedRating: RatingValue?
    var isDisabled: Bool = false
}
```

**Visual Description:**
Three `RatingOptionCard` components in an `HStack(spacing: 8)` with `16pt` horizontal padding. Each card uses `.frame(maxWidth: .infinity)` so all three are equal width.

**Accessibility:**
- Wrap the `HStack` in `.accessibilityElement(children: .contain)` with `.accessibilityLabel("Rating options, 3 available")`
- Each card is individually labeled (see `RatingOptionCard`)

---

### RatingOptionCard

**Purpose:** A single tappable rating option card within `RatingSelectorView`.

**Props:**
```swift
struct RatingOptionCard: View {
    let option:     RatingValue
    let isSelected: Bool
    let isDisabled: Bool
    let onTap:      () -> Void
}
```

**Visual Description:**

Unselected state:
- Background: `Color("CardBackground")`
- No border
- Icon: `Image(systemName: option.icon)` at `.title` font, color `.secondary`
- Label: `Text(option.label)` at `.subheadline .regular`, color `.secondary`

Selected state:
- Background: `Color(option.accentTokenName).opacity(0.12)`
- Border: 2pt `Color(option.accentTokenName)` stroke via `overlay(RoundedRectangle(cornerRadius: 16).stroke(...))`
- Icon: `Color(option.accentTokenName)` at full opacity
- Label: `.semibold`, `Color(option.accentTokenName)`

Both states:
- Corner radius: 16pt
- Internal padding: 16pt vertical, 12pt horizontal
- Contents: `VStack(spacing: 8)` — icon above label, both centered
- Minimum height: 88pt (enforced via `.frame(minHeight: 88)`)
- Maximum width: `.infinity`

Disabled state: `.opacity(0.4)`, `.allowsHitTesting(false)`

**Interaction Behavior:**
- Tap fires `onTap()` and `UIImpactFeedbackGenerator(style: .light).impactOccurred()`
- On `isSelected` becoming `true`, trigger a scale punch on the icon (1.0 -> 1.25 -> 1.0)
- Card container uses `.animation(.spring(response: 0.3, dampingFraction: 0.65), value: isSelected)`

**Accessibility:**
```swift
.accessibilityLabel(isSelected
    ? "\(option.accessibilityLabel), selected. Double-tap to change."
    : "\(option.accessibilityLabel). Double-tap to select.")
.accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
```

---

### RatingSummaryView

**Purpose:** Read-only aggregate rating display for session history and session detail contexts.

**Props:**
```swift
struct RatingSummaryView: View {
    let summary: RatingsSummary
    var style:   RatingSummaryStyle = .compact
}

enum RatingSummaryStyle {
    case compact   // Single line: "heart 2 Loved . thumb 1 Liked"
    case expanded  // Full breakdown with proportional bars
}
```

**Compact Style:**
A single `HStack` displaying only rating options with a count > 0, joined by dividers:
- `Image(systemName: option.icon)` at `.caption` size + `Text("\(count) \(option.label)")` at `.caption`
- Colors: `.secondary` for dividers, `.primary` for values
- If no ratings: `Text("No ratings yet")` in `.caption .tertiary`
- If partial (not all rated): append `Text("N of M rated")` in `.caption2 .tertiary`

**Expanded Style:**
`VStack(spacing: 8)` with one row per `RatingValue`:

```
heart  Loved          [========---]  2
thumb  Liked          [====-------]  1
thumb  Did Not Like   [-----------]  0
```

Each row: `HStack` — icon (`.body`) + label (`.body .regular`) + `Spacer()` + progress bar (`GeometryReader` scaled to `attendeeCount`) + count (`.body`, fixed width)

Progress bar: height 8pt, `cornerRadius(4)`, `Color(option.accentTokenName).opacity(0.7)` fill on `.ultraThinMaterial` background.

Footer (if partial): `Text("N of M attendees rated")` in `.caption .tertiary`

**Accessibility (compact):**
```swift
.accessibilityElement(children: .ignore)
.accessibilityLabel("Ratings: \(summary.loved) Loved, \(summary.liked) Liked, \(summary.didNotLike) Did Not Like. \(summary.totalRated) of \(summary.totalAttendees) attendees rated.")
```

**Accessibility (expanded):** Each row individually labeled; progress bars hidden from VoiceOver (`.accessibilityHidden(true)`) since count text carries the same information.

---

### RatingMemberRowView

**Purpose:** A single row displaying a member's name, avatar, and rating status.

**Props:**
```swift
struct RatingMemberRowView: View {
    let entry: RatingEntry
}
```

**Visual Description:**
`HStack(spacing: 12)`:
- `ProfileAvatarView(avatarKey: entry.avatarKey, size: .small)` — 32pt diameter
- `Text(entry.displayName)` at `.body`
- `Spacer()`
- Trailing: if rated — `Image(systemName: entry.rating!.icon)` in `Color(entry.rating!.accentTokenName)` + `Text(entry.rating!.label)` at `.subheadline .secondary`; if not rated — `Text("Not yet")` at `.caption .tertiary`

Minimum height: 44pt.

**Accessibility:**
```swift
.accessibilityElement(children: .combine)
.accessibilityLabel("\(entry.displayName): \(entry.hasRated ? entry.rating!.accessibilityLabel : "has not rated yet")")
```

---

### MovieHeaderCard

**Purpose:** Compact movie identity display — poster, title, metadata. Visual anchor at the top of `RatingView`. Designed for reuse in `PickConfirmationView` and `SessionDetailView`.

**Props:**
```swift
struct MovieHeaderCard: View {
    let title:         String
    let year:          Int
    let contentRating: String?
    let posterURL:     URL?
}
```

**Visual Description:**
`HStack(spacing: 12)` inside a card container:
- Left: `AsyncImage` at 60x90pt, `cornerRadius(8)`, `contentMode: .fill`. Placeholder: `RoundedRectangle` filled with `.systemGray5` containing `Image(systemName: "film")` in `.secondary`.
- Right: `VStack(alignment: .leading, spacing: 4)`:
  - `Text(title)` at `.title3 .semibold`, `.lineLimit(2)`
  - `Text(metadataLine)` at `.caption .secondary` — e.g. "2022 . PG-13", omitting nil fields

Card container: `CardBackground`, `cornerRadius(16)`, `padding(16)`.

No shadow (per design philosophy: flat, calm).

---

## State Definitions

### RatingView States

#### State 1: Loading

**Trigger:** `RatingView` appears; `RatingViewModel.loadRatings()` is in flight.

**What the user sees:**
- `MovieHeaderCard` is shown immediately (data passed in from caller)
- Three shimmer skeleton rectangles in the shape of `RatingOptionCard` components (88pt height, 16pt radius, opacity pulsing between 0.4 and 0.7 over 1.2s)
- "Save My Rating" button not shown
- "Skip for now" visible and active

**Available actions:** Skip for now

**Transition out:** Crossfade (0.25s) to Unrated or Already-Rated state based on fetched data.

---

#### State 2: Unrated

**Trigger:** Loading completes; active member has no rating for this round.

**What the user sees:**
- `MovieHeaderCard`
- "How was it?" prompt in `.title2`
- Three `RatingOptionCard` components in neutral state
- "Rating as [Name]" pill (managed member only)
- "Save My Rating" `PrimaryButton`, visually dimmed/disabled
- "Skip for now" in nav bar trailing

**Available actions:** Select a rating option, Skip for now

---

#### State 3: Option Selected (Unsubmitted)

**Trigger:** User taps any rating option while in Unrated state.

**What the user sees:**
- Same layout as Unrated
- Selected card: color-filled background, icon in accent color, label semibold
- Unselected cards: neutral (not dimmed — all remain tappable)
- "Save My Rating" `PrimaryButton` is now enabled
- `interactiveDismissDisabled(true)` prevents swipe-to-dismiss

**Available actions:** Tap a different option, tap "Save My Rating" to submit, tap "Skip for now" to abandon

---

#### State 4: Submitting

**Trigger:** User taps "Save My Rating"; `POST /rounds/{id}/ratings` is in flight.

**What the user sees:**
- Rating option cards disabled (`.opacity(0.5)`, `allowsHitTesting(false)`)
- Selected card remains visually selected
- "Save My Rating" button shows `ProgressView` in place of label text
- "Skip for now" hidden

**Available actions:** None (wait for response)

**Transition out — success:** Crossfade to Wait state.
**Transition out — error:** Crossfade back to Option Selected state with error message.

---

#### State 5: Wait (Submitted, Not All Rated)

**Trigger:** `POST /rounds/{id}/ratings` succeeds; `allRated == false`.

**What the user sees:**
- `MovieHeaderCard`
- "Your rating is in!" with the submitted rating's icon echoed in accent color (`.title2 .bold`)
- "Waiting for [N] more to rate." (`.body .secondary`)
- Member list card with `RatingMemberRowView` per attendee
- "Close Ratings" `SecondaryButton` (creator only)
- No "Skip for now"

**Available actions:** Close Ratings (creator only); the sheet can be dismissed by the system when the app backgrounds, but a deliberate close button is not provided (the user stays to watch ratings come in)

**Background polling:** `RatingViewModel.startPolling()` fires `GET /rounds/{id}/ratings` every 5 seconds. Stops on `onDisappear`.

**Transition out:** When `allRated` becomes `true` (detected by polling), crossfade to All-Rated state.

---

#### State 6: All Rated

**Trigger:** All attendees have submitted ratings (auto-detected via polling, or triggered by "Close Ratings").

**What the user sees:**
- `MovieHeaderCard`
- "Everyone's in! Here's how you all felt:" (`.title2 .bold`)
- `RatingSummaryView(summary: ..., style: .expanded)`
- "Done" `PrimaryButton`

**Haptic on enter:** `UINotificationFeedbackGenerator().notificationOccurred(.success)`

**Available actions:** Done (dismiss sheet)

---

#### State 7: Already Rated

**Trigger:** Loading completes; active member already has a rating for this round.

**What the user sees:**
- `MovieHeaderCard`
- Three `RatingOptionCard` components with the previously submitted option highlighted — all disabled
- `Text("You rated this \(timeAgo).")` in `.caption .secondary`
- If round is in `watched` status: `SecondaryButton("Change My Rating")` — re-enables cards and renames submit button to "Update Rating"
- If round is in `rated` status: no change option; `PrimaryButton("Done")` only

**Available actions:** "Change My Rating" (if round is `watched`), Done

---

#### State 8: Error

**Trigger:** `POST /rounds/{id}/ratings` returns a non-2xx response.

**What the user sees:**
- Returns to Option Selected state (selected option remains)
- "Save My Rating" re-enabled
- Inline error message below rating cards in `.caption`, `WarningAccent` color

**Error messages by status:**
- 400: "Something went wrong. Try again."
- 403: "You're not listed as an attendee for this session."
- 404: "This session wasn't found."
- 409: "Your rating has already been recorded." -> auto-transition to Already Rated state
- Network / 500: "Couldn't connect. Check your connection and try again."

**Haptic on enter:** `UINotificationFeedbackGenerator().notificationOccurred(.error)`

**Auto-dismiss of error:** After 8 seconds, or when the user taps "Save My Rating" again.

**Available actions:** Retry, Skip for now, change selected option

---

### RatingSummaryView States

| State | Compact Display | Expanded Display |
|---|---|---|
| No ratings yet | `"No ratings yet"` (.caption, .tertiary) | Three empty bars, `"0 of N rated"` footer |
| Partial ratings | `"heart 1 Loved . 2 of 4 rated"` | Proportional bars, `"N of M attendees rated"` footer |
| All rated | `"heart 2 Loved . thumb 1 Liked"` (zero-count options omitted) | Full proportional bars, no footer |

---

## Interaction Details

### Haptics

| Trigger | Generator | Style |
|---|---|---|
| Tap any rating option | `UIImpactFeedbackGenerator` | `.light` |
| Tap "Save My Rating" | `UIImpactFeedbackGenerator` | `.medium` |
| All-rated state reached | `UINotificationFeedbackGenerator` | `.success` |
| Tap "Close Ratings" confirmation | `UIImpactFeedbackGenerator` | `.medium` |
| Error state entered | `UINotificationFeedbackGenerator` | `.error` |

All generators must be initialized lazily. Only fire on `UIDevice.current.userInterfaceIdiom == .phone`.

### Animations

#### Rating Option Selection

The card container:
```swift
.animation(.spring(response: 0.3, dampingFraction: 0.65), value: isSelected)
```

Icon scale punch when `isSelected` becomes `true`:
```swift
// Inside RatingOptionCard using @State var iconScale: CGFloat = 1.0
.onChange(of: isSelected) { _, newValue in
    guard newValue else { return }
    withAnimation(.spring(response: 0.18, dampingFraction: 0.45)) {
        iconScale = 1.25
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.14) {
        withAnimation(.spring(response: 0.22, dampingFraction: 0.65)) {
            iconScale = 1.0
        }
    }
}
.scaleEffect(iconScale)
```

Deselecting a card plays only the spring background transition — no punch.

#### Submit Button Enable/Disable

```swift
.animation(.easeInOut(duration: 0.2), value: selectedRating != nil)
```

#### State Transitions Within RatingView

Transition from Unrated -> Wait state (and Wait -> All-Rated):
```swift
// Applied on each major section except MovieHeaderCard
.transition(.opacity.combined(with: .scale(scale: 0.97)))
// Wrapped in:
withAnimation(.easeInOut(duration: 0.3)) { hasSubmitted = true }
```

`MovieHeaderCard` does not participate in transitions — it stays fixed at the top throughout all states.

#### Loading Skeleton

Shimmer effect using a `LinearGradient` animation:
- Base fill: `Color(.systemGray5)`
- Shimmer overlay: `Color(.systemGray4)` gradient sliding from leading to trailing
- Duration: 1.2s repeating loop
- Reduce Motion: static grey fill, no shimmer

#### Reduce Motion

Check `@Environment(\.accessibilityReduceMotion) var reduceMotion`. When `true`:
- Replace icon scale punch with instant `.opacity(0.6)` -> `.opacity(1.0)` (no spring)
- Replace crossfade transitions with instant state changes
- Disable shimmer (static placeholder)

---

## Accessibility

### Dynamic Type

- All text uses semantic styles — never hardcoded sizes
- `RatingOptionCard` height: `frame(minHeight: 88)`, not `frame(height: 88)` — cards grow with text
- At XXXL Dynamic Type, "Did Not Like" will be 3 words and may wrap inside the card. This is acceptable; the card height grows automatically
- `RatingSummaryView` compact style: at large type sizes, use `ViewThatFits` to wrap to a `VStack` if the single-line layout overflows

### VoiceOver Labels

| Element | Label | Traits |
|---|---|---|
| Rating option (unselected) | `"[Loved/Liked/Did not like it]. Double-tap to select."` | `.isButton` |
| Rating option (selected) | `"[option], selected. Double-tap to change."` | `.isButton, .isSelected` |
| `RatingSelectorView` container | `"Rating options, 3 available"` | `.isGroup` |
| "Save My Rating" (disabled) | `"Save My Rating. Select a rating first."` | `.isButton, .notEnabled` |
| "Save My Rating" (enabled) | `"Save My Rating"` | `.isButton` |
| "Skip for now" | `"Skip rating. Double-tap to dismiss without rating."` | `.isButton` |
| Member row — rated | `"[Name]: [rated X]"` | combined element |
| Member row — not yet | `"[Name]: has not rated yet"` | combined element |
| `RatingSummaryView` (compact) | `"Ratings: [N] Loved, [N] Liked, [N] Did Not Like. [N] of [M] attendees rated."` | `.isSummaryElement` |
| Expanded summary rows | `"[Option]: [N] votes"` per row | — |
| Expanded summary progress bars | Hidden from VoiceOver | `.accessibilityHidden(true)` |

**Profile context announcement:** When `RatingView` appears and the active profile is a managed member, announce on `.onAppear`:
```swift
AccessibilityNotification.Announcement("Now rating as \(activeProfileName)").post()
```

### Contrast

- Tinted card backgrounds at 12% opacity: The icon and label text must use the accent color at **full opacity** as their foreground color (not the tinted background color). This ensures the icon/label contrast against the lightly-tinted card surface meets WCAG AA.
- In dark mode, 12% opacity tints may need adjustment to 16-18% for sufficient visual differentiation between selected and unselected cards. Use `@Environment(\.colorScheme)` to conditionally adjust the opacity value.
- `WarningAccent` error text must maintain 4.5:1 contrast against `AppBackground` in both light and dark mode. Verify this during token definition.

---

## Visual Specifications

### Spacing

| Element | Value |
|---|---|
| Screen outer horizontal padding | 16pt |
| `MovieHeaderCard` internal padding | 16pt all sides |
| Gap: `MovieHeaderCard` -> "How was it?" prompt | 20pt |
| Gap: prompt -> rating cards | 8pt |
| Spacing between `RatingOptionCard`s | 8pt |
| `RatingOptionCard` internal padding | 16pt vertical, 12pt horizontal |
| `RatingOptionCard` icon -> label gap | 8pt |
| `RatingOptionCard` minimum height | 88pt |
| `RatingOptionCard` corner radius | 16pt |
| Gap: rating cards -> managed member pill | 12pt |
| Gap: rating cards / pill -> submit button | 20pt |
| Member list card internal padding | 16pt |
| `RatingMemberRowView` minimum height | 44pt |
| `RatingMemberRowView` avatar -> name gap | 12pt |
| Gap: member list -> "Close Ratings" button | 16pt |

### Typography

| Element | Style | Weight | Color Token |
|---|---|---|---|
| Nav title "Rate the Movie" | `.inline` nav title | System | System |
| "How was it?" prompt | `.title2` | `.regular` | `.primary` |
| "Your rating is in!" | `.title2` | `.bold` | `.primary` |
| "Everyone's in!" | `.title2` | `.bold` | `.primary` |
| "Waiting for N more..." | `.body` | `.regular` | `.secondary` |
| "Here's how you all felt:" | `.body` | `.regular` | `.secondary` |
| `RatingOptionCard` label (selected) | `.subheadline` | `.semibold` | option's accent token |
| `RatingOptionCard` label (unselected) | `.subheadline` | `.regular` | `.secondary` |
| Movie title in `MovieHeaderCard` | `.title3` | `.semibold` | `.primary` |
| Movie metadata in `MovieHeaderCard` | `.caption` | `.regular` | `.secondary` |
| Member display name | `.body` | `.regular` | `.primary` |
| Member rating label | `.subheadline` | `.regular` | `.secondary` |
| "Not yet" indicator | `.caption` | `.regular` | `.tertiary` |
| Error message | `.caption` | `.regular` | `WarningAccent` |
| "Rating as [Name]" pill text | `.caption` | `.medium` | `PrimaryAccent` |
| Compact summary text | `.caption` | `.regular` | `.secondary` |
| "N of M rated" partial indicator | `.caption2` | `.regular` | `.tertiary` |
| Time-ago label in Already Rated | `.caption` | `.regular` | `.secondary` |

### Colors

| Element | Token / Value | Notes |
|---|---|---|
| Screen background | `AppBackground` | |
| Card backgrounds | `CardBackground` | `MovieHeaderCard`, member list container |
| Loved — selected tint | `SuccessAccent` at 12% opacity | Card background fill |
| Loved — selected border | `SuccessAccent` full opacity | 2pt stroke |
| Loved — icon / label | `SuccessAccent` full opacity | |
| Liked — selected tint | `PrimaryAccent` at 12% opacity | |
| Liked — selected border | `PrimaryAccent` full opacity | |
| Liked — icon / label | `PrimaryAccent` full opacity | |
| Did Not Like — selected tint | `WarningAccent` at 12% opacity | |
| Did Not Like — selected border | `WarningAccent` full opacity | |
| Did Not Like — icon / label | `WarningAccent` full opacity | |
| Unselected card background | `CardBackground` | No border |
| Unselected card icon / label | `.secondary` system color | |
| "Rating as [Name]" pill bg | `PrimaryAccent` at 10% opacity | |
| "Rating as [Name]" pill text | `PrimaryAccent` | |
| Expanded summary progress bar fill | option's token at 60% opacity | On `.ultraThinMaterial` bg |
| Error text | `WarningAccent` | |
| Shimmer base | `Color(.systemGray5)` | |
| Shimmer highlight | `Color(.systemGray4)` gradient | |

**Dark mode:** All semantic tokens resolve automatically. Increase selected card tint opacity from 12% to 16% in dark mode if visual differentiation from unselected cards is insufficient.

---

## ViewModel Specification

```swift
@MainActor
class RatingViewModel: ObservableObject {

    // MARK: - Published State
    @Published var selectedRating:   RatingValue?
    @Published var isSubmitting:     Bool = false
    @Published var hasSubmitted:     Bool = false
    @Published var isLoading:        Bool = false
    @Published var error:            String?
    @Published var ratingEntries:    [RatingEntry] = []
    @Published var ratingsClosed:    Bool = false   // round is in `rated` status

    // MARK: - Configuration (set via configure())
    private(set) var isCreator:          Bool = false
    private(set) var activeProfileName:  String? = nil   // non-nil if managed member

    // MARK: - Derived
    var allRated:    Bool { ratingEntries.allSatisfy { $0.hasRated } }
    var ratedCount:  Int  { ratingEntries.filter { $0.hasRated }.count }
    var totalAttendees: Int { ratingEntries.count }
    var alreadyRated: Bool {
        ratingEntries.first { $0.memberId == activeMemberId }?.hasRated ?? false
    }
    var summary: RatingsSummary { .from(entries: ratingEntries.map { $0.toResponse() }) }

    // MARK: - Private
    private var roundId:       String = ""
    private var activeMemberId: String = ""
    private var apiClient:     APIClient?
    private var pollingTask:   Task<Void, Never>?

    // MARK: - Configuration
    func configure(
        roundId:           String,
        activeMemberId:    String,
        isCreator:         Bool,
        activeProfileName: String?,
        apiClient:         APIClient
    )

    // MARK: - API Operations
    func loadRatings() async    // GET /rounds/{id}/ratings -> populate ratingEntries
    func submitRating() async   // POST /rounds/{id}/ratings -> hasSubmitted = true
    func closeRatings() async   // PATCH /rounds/{id} -> { "status": "rated" }

    // MARK: - Polling
    func startPolling()         // 5-second timer calling loadRatings()
    func stopPolling()          // cancel pollingTask
}
```

---

## Integration Notes

### PickConfirmationView

The existing `PickConfirmationView` requires two changes for Slice C1:

1. **Bug fix:** `markWatched()` currently calls `POST /groups/{group_id}/watched`. The correct transition is `PATCH /rounds/{round_id}` with `{"status": "watched"}`. This must be corrected when implementing C1.

2. **Rating sheet:** After `markWatched()` succeeds:
   ```swift
   // In PickConfirmationView
   @State private var showRatingSheet = false
   @StateObject private var ratingViewModel = RatingViewModel()

   // After successful markWatched():
   markedWatched = true
   showRatingSheet = true

   // Sheet presentation:
   .sheet(isPresented: $showRatingSheet) {
       NavigationStack {
           RatingView(viewModel: ratingViewModel)
       }
   }
   ```

No changes to `GroupDetailView.RoundFlowPhase` are required — the rating flow is a sheet within the existing `.picked` destination.

### Session History Integration

- `RatingSummaryView(.compact)` is placed in session history list rows using `ratings_summary` from `GET /groups/{group_id}/sessions`
- `RatingSummaryView(.expanded)` is placed in session detail using full entries from `GET /rounds/{round_id}/ratings`
- "Rate Now" button in `SessionDetailView` appears when `round.status == "watched"` and the active member has no rating entry

### Managed Member Context (Slice C4 dependency)

When `ProfileSessionManager.activeProfile.isManaged == true`:
- `RatingViewModel` receives `activeProfileName` from the profile manager
- `APIClient` automatically attaches `X-Acting-As-Member` header (wired in Slice C4)
- For Slice C1 (pre-C4): rating is attributed to authenticated user; managed member support activates automatically when C4 lands

### Poster URL

`PickConfirmationView` currently receives `RoundPick` which has no `poster_path`. For `MovieHeaderCard` in `RatingView`, either:
- **(Preferred for C1):** Fetch `GET /movies/{tmdb_movie_id}` on `RatingView` appear and display the skeleton poster until resolved. Cache the result.
- **(Better long-term):** Extend `PickResponse` to include `poster_path` passed from the suggestion record.

---

## Preview Variants

All of the following must be implemented per CLAUDE.md requirements:

### RatingView

| # | Variant | Notes |
|---|---|---|
| 1 | Light mode, Unrated state | Default |
| 2 | Dark mode, Unrated state | Verify token resolution |
| 3 | Light mode, "Loved" selected (unsubmitted) | Shows enabled submit button |
| 4 | Dark mode, "Did Not Like" selected | WarningAccent on dark surface |
| 5 | Light mode, Managed member ("Rating as Max" pill) | |
| 6 | Light mode, Wait state (1 of 3 rated) | Partial member list |
| 7 | Light mode, All-Rated state | Full summary shown |
| 8 | Light mode, Already Rated state | Shows "Change My Rating" |
| 9 | Light mode, Error state | Error message below cards |
| 10 | XXXL Dynamic Type, Unrated state | Cards grow; no overflow |

### RatingSelectorView

| # | Variant |
|---|---|
| 1 | All unselected |
| 2 | "Loved" selected |
| 3 | "Liked" selected |
| 4 | "Did Not Like" selected |
| 5 | Disabled (all options locked) |

### RatingSummaryView

| # | Style | State |
|---|---|---|
| 1 | Compact | No ratings |
| 2 | Compact | Partial (2 of 4 rated) |
| 3 | Compact | All rated |
| 4 | Expanded | Partial |
| 5 | Expanded | All rated |
| 6 | Expanded | Large Dynamic Type |

---

## Open Questions and Recommendations

### OQ-1: Celebration on All-Rated

**Question:** Should there be a brief celebration animation when all attendees have rated?

**Recommendation:** Yes, but minimal. A spring-animated checkmark icon (scale 0 -> 1.1 -> 1.0) with the `.notificationOccurred(.success)` haptic provides a satisfying close without being overwhelming. No confetti in v1.

**Default:** Animated checkmark + success haptic.

### OQ-2: Can a Member Change Their Rating?

**Confirmed per US-19:** "Can be changed before ratings are closed." The Already Rated state (State 7) implements this via "Change My Rating."

### OQ-3: Polling Strategy

**Recommendation:** 5-second polling on `GET /rounds/{id}/ratings` while the Wait state is visible. Pull-to-refresh as manual supplement. Cancel polling on sheet dismiss. This is sufficient for v1 with 2-8 household members.

### OQ-4: Poster in RatingView

**Recommendation:** Fetch `GET /movies/{tmdb_movie_id}` on `RatingView` appear. Show skeleton until resolved. Track as a follow-up to extend `PickResponse` with `poster_path`.

### OQ-5: Close Ratings Placement

**Recommendation:** Below the member list as a `SecondaryButton` (not in the nav bar). The proximity to the member list provides context for why the creator is closing early.

### OQ-6: Rating Deep Link from Push Notification

**Default for v1 (Slice C1):** Notification tap lands on `GroupDetailView`; no direct deep link to `RatingView`. Deep link support is a Slice C7+ concern.

---

## Quality Checklist

- [x] US-19 all acceptance criteria addressed across all states
- [x] US-46 "Close Ratings" creator action fully specified
- [x] Flow 4 post-watch path integrated with `PickConfirmationView`
- [x] Flow 6 step 6 post-watch rating fully covered
- [x] Flow 13 session history integration via `RatingSummaryView`
- [x] All components have loading, empty/unrated, error, and success states defined
- [x] No screen has more than two primary actions
- [x] All tap targets >= 44pt
- [x] Color usage only references semantic design tokens
- [x] Typography only uses the defined hierarchy (no hardcoded sizes)
- [x] Dark mode addressed (token opacity adjustments noted)
- [x] Dynamic Type addressed (minHeight, not fixed height; `ViewThatFits` for compact summary)
- [x] VoiceOver labels specified for all interactive elements
- [x] Reduce Motion behavior specified
- [x] Haptics specified with generator type, style, and trigger
- [x] Spring animation parameters specified (response, dampingFraction)
- [x] Components extracted -- no one-off inline duplication
- [x] `RatingViewModel` properties and methods enumerated
- [x] Managed member (Slice C4) integration addressed
- [x] Existing `PickConfirmationView` bug (wrong endpoint) flagged
- [x] COPPA-relevant note: rating attribution uses `member_id`, not email or device ID
- [x] Preview variants listed (10 for `RatingView`, 5 for `RatingSelectorView`, 6 for `RatingSummaryView`)
- [x] Open questions surfaced with recommended defaults
