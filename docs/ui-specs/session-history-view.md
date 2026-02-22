# SessionHistoryView — UI Specification

**Version:** 1.0
**Status:** Ready for Implementation
**Slice:** C7 (Round Lifecycle Completion + Session History)
**Related Stories:** US-45, US-20, US-19, US-46
**Related Flows:** Flow 13 (Session History), Flow 4 (Marking Watched), Flow 6 steps 6–7
**Related API:** `GET /groups/{group_id}/sessions` (cursor pagination), `GET /rounds/{round_id}`, `GET /rounds/{round_id}/ratings`
**Reuses from:** `docs/ui-specs/rating-selector-view.md` — `RatingSummaryView`, `MovieHeaderCard`, `RatingMemberRowView`, `RatingView`

---

## Overview

Session history is the household's record of every movie night — finished or abandoned. The list screen shows a scrollable, paginated timeline of sessions sorted newest first. Each row communicates the session's state, the picked movie (if any), the date, and the rating outcome at a glance. Tapping a row opens a full detail view showing attendees, the complete vote breakdown, the pick, and individual ratings. When a session is still in `watched` status and the active member hasn't rated yet, a "Rate Now" button is available in the detail view.

The screen must feel like a warm, calm diary of family movie nights — not a data table. The design prioritizes recognizable poster art, clear status badges, and spacious rows over information density.

---

## UX Flows

### Flow A: Browsing Session History (Primary Path)

```
GroupDetailView
  |
  +-- User taps "Watch History" / "Session History" row
        |
        +-- [Navigation] Push: SessionHistoryView
              |
              +-- [State] Loading: skeleton rows appear immediately
              |
              +-- [State] Populated: sessions listed, newest first
              |     |
              |     +-- User scrolls down
              |           |
              |           +-- [?] More sessions to load?
              |           ├── Yes -> "Load More" appears at bottom
              |           |         Tap -> Loading More state -> appends rows
              |           └── No  -> "That's everything" footer
              |
              +-- [State] Empty: no sessions yet (household never held a round)
```

**Entry point:** `GroupDetailView` via a `NavigationLink` in the Actions section. Navigation is a standard push (not modal).

**Exit points:** Back navigation to `GroupDetailView`. Tapping a session row pushes to `SessionDetailView`.

---

### Flow B: Session Detail (Tap into a Session)

```
SessionHistoryView
  |
  +-- User taps a session row
        |
        +-- [Navigation] Push: SessionDetailView
              |
              +-- [State] Loading: MovieHeaderCard skeleton + section skeletons
              |
              +-- [State] Populated:
              |     |
              |     +-- MovieHeaderCard (picked movie, if any)
              |     +-- Status badge
              |     +-- Attendees section
              |     +-- Suggestions + vote breakdown section
              |     +-- Ratings section (RatingSummaryView expanded + RatingMemberRowView list)
              |     |
              |     +-- [?] round.status == "watched" AND active member hasn't rated?
              |     ├── Yes -> "Rate Now" PrimaryButton visible
              |     └── No  -> no Rate Now button
              |
              +-- [State] Error: retry prompt
```

**Entry point:** Tap on `SessionHistoryRowView` inside `SessionHistoryView`.

**Exit points:** Back to `SessionHistoryView`. "Rate Now" presents `RatingView` as a `.sheet`.

---

### Flow C: Rate Now from Session Detail (Secondary Path)

```
SessionDetailView
  |
  +-- User taps "Rate Now"
        |
        +-- [Sheet] RatingView (same component from rating-selector-view.md)
              |
              +-- User submits rating -> success
              |     +-- Sheet dismissed
              |     +-- SessionDetailView refreshes (reloads ratings section)
              |     +-- [?] All attendees now rated?
              |           ├── Yes -> SessionDetailView shows "rated" status badge
              |           └── No  -> ratings section shows updated partial state
              |
              +-- User taps "Skip for now"
                    +-- Sheet dismissed, no change to detail view
```

**Entry point:** "Rate Now" `PrimaryButton` in `SessionDetailView`.

**Exit points:** Sheet dismissal returns to `SessionDetailView`.

---

### Flow D: Pagination (Load More)

```
SessionHistoryView (populated, scrolled to bottom)
  |
  +-- User scrolls past last visible row
        |
        +-- [Auto-trigger] loadNextPage() fires when last row is within 2 rows
        |   of the visible bottom (prefetch trigger)
        |
        +-- [State] Loading More: spinner in list footer
        |
        +-- [State] Appended: new rows appear at bottom
        |     Spring-animated list insertion (.transition(.opacity.combined(with: .move(edge: .bottom))))
        |
        +-- [?] next_cursor == nil (server indicates end of list)?
              └── "That's all your movie nights" footer text (no more loading)
```

---

## Screen Inventory

| Screen | Purpose | Entry Points | Exit Points | Primary Action | Secondary Actions |
|---|---|---|---|---|---|
| `SessionHistoryView` | Paginated list of all household sessions, sorted newest first | `GroupDetailView` "Watch History" link | Back to `GroupDetailView`; tap row to `SessionDetailView` | Tap row to view detail | Pull to refresh |
| `SessionDetailView` | Full detail for one session: attendees, votes, pick, ratings | Tap row in `SessionHistoryView` | Back to `SessionHistoryView`; "Rate Now" sheet | "Rate Now" (if applicable) | Pull to refresh |

Note: `SessionHistoryRowView` is a component embedded in `SessionHistoryView`, not a standalone screen.

---

### SessionHistoryView

- **Purpose:** Display the household's full session timeline, paged 20 at a time.
- **Entry points:** `NavigationLink` from `GroupDetailView` actions section.
- **Exit points:** System back button to `GroupDetailView`; tap row to `SessionDetailView`.
- **Primary action:** Tap a row.
- **Secondary actions:** Pull to refresh, load more (scroll-triggered).
- **Data displayed:** Per session: status badge, movie poster + title (if picked), date created, attendee count, ratings summary.
- **Data inputs:** None (read-only list).
- **API:** `GET /groups/{group_id}/sessions?limit=20&cursor=<cursor>`

---

### SessionDetailView

- **Purpose:** Full breakdown of one session — attendees, suggestions with votes, the pick, and ratings.
- **Entry points:** Tap on `SessionHistoryRowView`.
- **Exit points:** Back to `SessionHistoryView`; "Rate Now" sheet.
- **Primary action:** "Rate Now" (only when session is `watched` and active member is unrated).
- **Secondary actions:** Pull to refresh.
- **Data displayed:** Status badge, `MovieHeaderCard` (pick), attendee chips, suggestion list with vote breakdown per movie, `RatingSummaryView` (expanded), `RatingMemberRowView` list.
- **Data inputs:** None (read-only except for Rate Now triggering `RatingView`).
- **API:** `GET /rounds/{round_id}` for round details + suggestions + votes; `GET /rounds/{round_id}/ratings` for rating entries.

---

## Screen Specifications

### Screen: SessionHistoryView

#### Layout Structure

The screen uses a `ScrollView` containing a `LazyVStack(spacing: 12)` of `SessionHistoryRowView` cards. `LazyVStack` is required (not `List`) to enable the card aesthetic — `List` renders rows with system separators and background that conflicts with card styling. The scroll view has 16pt horizontal padding and a 20pt top padding below the navigation bar.

Below the last row:
- If `isLoadingMore`: `ProgressView()` centered in a 44pt-height footer.
- If `hasReachedEnd`: `Text("That's all your movie nights")` in `.caption .tertiary`, centered, with 24pt vertical padding.
- If neither: an invisible `Color.clear.frame(height: 1)` with `.onAppear { viewModel.loadNextPageIfNeeded() }` to trigger prefetch.

Navigation bar title is "Watch History" in `.large` display mode.

A pull-to-refresh is attached to the `ScrollView` via `.refreshable { await viewModel.refresh() }`.

#### Visual Composition

```
+---------------------------------------------------+
|  < Back    Watch History                          |  NavigationBar, .large title
+---------------------------------------------------+
|  16pt horizontal padding, 20pt top                |
|                                                   |
|  +-----------------------------------------------+|
|  | [Poster] | rated badge  Film Title       date ||  SessionHistoryRowView
|  |  60x90   | Attended: Tim, Sarah, Max          ||  CardBackground, radius 16
|  |          | heart 2 Loved . thumb 1 Liked       ||  16pt padding all sides
|  +-----------------------------------------------+|
|  12pt gap                                         |
|  +-----------------------------------------------+|
|  | [Poster] | watching badge  Another Film  date ||
|  |  60x90   | Attended: 4 members                ||
|  |          | No ratings yet                      ||
|  +-----------------------------------------------+|
|  12pt gap                                         |
|  +-----------------------------------------------+|
|  | [Placeholder] | expired badge  date only      ||  Session with no pick
|  |  film icon     | Attended: Tim, Sarah          ||
|  |                | —                             ||
|  +-----------------------------------------------+|
|                                                   |
|  [ ProgressView footer / end footer ]             |
+---------------------------------------------------+
```

#### Content Hierarchy (per row)

1. Poster (strongest visual anchor, 60x90pt)
2. Status badge (communicates actionability)
3. Movie title (what we picked)
4. Date (when)
5. Attendees (who was there)
6. Rating summary (how it was received)

#### Navigation

Pushed onto the navigation stack from `GroupDetailView`. Navigation bar title: "Watch History". Back button uses default system back label (the `GroupDetailView`'s title).

---

### Screen: SessionDetailView

#### Layout Structure

The screen uses a `ScrollView` with a `VStack(spacing: 0)` root. Sections are separated by 20pt gaps rather than explicit dividers, achieving a spacious feel. The `MovieHeaderCard` (established in `rating-selector-view.md`) is pinned at the top.

The section order is:

1. `MovieHeaderCard` — the visual anchor (or a "No pick made" empty state card if the session has no pick)
2. Status row — badge + date + "Started by [Name]"
3. Attendees section — horizontal scroll of `MemberChip` components
4. Suggestions + Votes section — a list of `SessionSuggestionRowView` cards showing each movie and its vote breakdown
5. Ratings section — `RatingSummaryView(.expanded)` followed by a `VStack` of `RatingMemberRowView` per attendee
6. "Rate Now" `PrimaryButton` (conditional — only when applicable)

Navigation bar title: movie title when picked, "Session Detail" otherwise. Display mode `.inline`.

Pull-to-refresh reloads both the round details and ratings in parallel.

#### Visual Composition

```
+---------------------------------------------------+
|  < Watch History    Fight Club                   ||  .inline nav title
+---------------------------------------------------+
|  16pt outer padding                               |
|                                                   |
|  +-----------------------------------------------+|  MovieHeaderCard (reused from rating spec)
|  | [Poster] Fight Club                           ||  CardBackground, radius 16, 16pt padding
|  |  60x90   1999 . R                             ||
|  +-----------------------------------------------+|
|  20pt gap                                         |
|  [rated badge]  Feb 14, 2026  ·  Started by Tim  |  Status row, .body/.caption
|  20pt gap                                         |
|  Attendees (.title2 section header, 12pt below)  |
|  [ Tim ] [ Sarah ] [ Max ] (MemberChip row)       |  HStack, scrollable if > 4 members
|  20pt gap                                         |
|  Vote Breakdown (.title2, 12pt below)            |
|  +-----------------------------------------------+|  SessionSuggestionRowView x N
|  | [thumb 45x68]  Fight Club          3up  1dn  ||  CardBackground, radius 16, 12pt padding
|  |                Tim heart  Sarah heart  Max dn ||  voter chips
|  +-----------------------------------------------+|
|  12pt gap                                         |
|  +-----------------------------------------------+|  (Winner row has PrimaryAccent left border)
|  | [thumb 45x68]  Parasite     ★ PICKED 4up 0dn||
|  +-----------------------------------------------+|
|  20pt gap                                         |
|  Ratings (.title2, 12pt below)                   |
|  [RatingSummaryView(.expanded)]                   |  reused component
|  16pt gap                                         |
|  [RatingMemberRowView] Tim     heart Loved       |  reused component
|  [RatingMemberRowView] Sarah   thumb Liked       |
|  [RatingMemberRowView] Max     - Not yet         |
|  24pt gap                                         |
|  [Rate Now PrimaryButton — conditional]           |
|  16pt + safe area bottom                         |
+---------------------------------------------------+
```

#### Content Hierarchy

1. `MovieHeaderCard` — the picked movie at full visual prominence
2. Status + date — when and what state
3. Attendees — who was involved
4. Vote breakdown — how the decision was made (narrative of the night)
5. Ratings — how everyone felt afterward
6. "Rate Now" CTA — only when actionable

#### Navigation

Pushed from `SessionHistoryView`. Back goes to `SessionHistoryView`. "Rate Now" presents `RatingView` as a `.sheet(isPresented: $showRatingSheet)`. After rating sheet dismissal, `SessionDetailView` calls `viewModel.loadRatings()` to refresh the ratings section without a full page reload.

---

## Component Library

### Existing Components Used

| Component | Usage in This Spec | Source |
|---|---|---|
| `MovieHeaderCard` | Top anchor in `SessionDetailView`; also available as a smaller variant in rows | `Features/Shared/MovieHeaderCard.swift` (from rating-selector-view.md) |
| `RatingSummaryView` | Compact style in `SessionHistoryRowView`; expanded style in `SessionDetailView` ratings section | `Features/Shared/RatingSummaryView.swift` (from rating-selector-view.md) |
| `RatingMemberRowView` | Member-by-member rating status in `SessionDetailView` | `Features/Rounds/RatingMemberRowView.swift` (from rating-selector-view.md) |
| `RatingView` | Presented as sheet from `SessionDetailView` "Rate Now" | `Features/Rounds/RatingView.swift` (from rating-selector-view.md) |
| `ProfileAvatarView` | Within `MemberChip` in attendees row | Foundational component |
| `MemberChip` | Attendee chips in `SessionDetailView` attendees section | Foundational component |
| `PrimaryButton` | "Rate Now" button in `SessionDetailView` | Foundational component |

### New Components Required

#### SessionHistoryRowView

**Purpose:** A single tappable card row representing one session in the history list.

**File:** `ios/FamilyMovieNight/Features/Sessions/SessionHistoryRowView.swift`

**Props:**
```swift
struct SessionHistoryRowView: View {
    let session: SessionSummary   // see Model Additions below
}
```

**Visual Description:**

`HStack(alignment: .top, spacing: 12)` inside a card container:

Left column:
- `AsyncImage` poster at 60x90pt, `cornerRadius(8)`, `contentMode: .fill`. Placeholder: `RoundedRectangle(cornerRadius: 8)` filled with `Color(.systemGray5)` containing `Image(systemName: "film")` in `.secondary`. Sessions with no pick show the film icon placeholder at full size.

Right column — `VStack(alignment: .leading, spacing: 6)`:
- Top row: `SessionStatusBadgeView(status: session.status)` + `Spacer()` + date in `.caption .secondary` (formatted as "Feb 14" for current year, "Feb 14, 2025" for prior years)
- Movie title: `Text(session.pick?.title ?? "No movie selected")` in `.body .semibold`, `.lineLimit(1)`. When no pick: `.foregroundStyle(.secondary)` and italic.
- Attendees line: `Text(attendeesSummary)` in `.caption .secondary`, e.g. "Tim, Sarah, Max" (first 3 names, then "+ 2 more"). Never truncated to fewer than 1 name.
- Rating summary: `RatingSummaryView(summary: session.ratingsSummary, style: .compact)`. Shows "No ratings yet" in `.tertiary` when `rated_count == 0`. Hidden entirely when `session.status` is `draft`, `voting`, or `expired` (sessions that never reached watched state).

Card container: `CardBackground`, `cornerRadius(16)`, `padding(16)`. No shadow. Full-width via `.frame(maxWidth: .infinity)`.

**Variants:**

| Session Status | Poster | Title | Rating Row |
|---|---|---|---|
| `draft` | placeholder | italic "No movie selected" | hidden |
| `voting` | placeholder | italic "No movie selected" | hidden |
| `selected` | poster if pick exists | pick title | hidden (not yet watched) |
| `watched` | poster | pick title | `RatingSummaryView` compact, partial or "No ratings yet" |
| `rated` | poster | pick title | `RatingSummaryView` compact, all or partial |
| `expired` | placeholder | italic "No movie selected" | hidden |

**Interaction Behavior:**

The entire card is the tap target, implemented via `.contentShape(Rectangle())` on the `HStack`. No swipe actions on rows in v1 (history is read-only).

On tap: `UIImpactFeedbackGenerator(style: .light).impactOccurred()` + navigation push.

Scale press feedback: `.buttonStyle(.plain)` combined with a `.scaleEffect` animation:
```swift
.scaleEffect(isPressed ? 0.97 : 1.0)
.animation(.spring(response: 0.2, dampingFraction: 0.7), value: isPressed)
```

**Minimum height:** 44pt enforced via `HStack` content (poster is 90pt, so rows will always exceed 44pt).

**Accessibility:**
```swift
.accessibilityElement(children: .ignore)
.accessibilityLabel(accessibilityDescription)
.accessibilityHint("Double-tap to see full session details.")
.accessibilityAddTraits(.isButton)

// accessibilityDescription examples:
// "Fight Club. Rated. February 14th. Attended by Tim, Sarah, Max. 2 Loved, 1 Liked."
// "No movie selected. Expired. January 3rd. Attended by Tim, Sarah."
// "Parasite. Watching in progress. February 20th. Attended by 4 members."
```

---

#### SessionStatusBadgeView

**Purpose:** A compact pill badge communicating the current session lifecycle state. Used in `SessionHistoryRowView` and `SessionDetailView`.

**File:** `ios/FamilyMovieNight/Features/Sessions/SessionStatusBadgeView.swift`

**Props:**
```swift
struct SessionStatusBadgeView: View {
    let status: SessionStatus
    var size:   SessionStatusBadgeSize = .regular
}

enum SessionStatusBadgeSize {
    case regular  // used in rows and detail header
    case large    // not used in v1; reserved
}
```

**Visual Description:**

A `HStack(spacing: 4)` containing:
- `Circle()` fill in the status color at 6pt diameter (`.regular` size)
- `Text(status.label)` in `.caption2 .medium`

Wrapped in a `Capsule` with `padding(.horizontal, 8).padding(.vertical, 4)` and a `background(Capsule().fill(status.backgroundToken.opacity(0.12)))`. The text and dot use `status.foregroundToken` at full opacity.

**Status tokens:**

| Status | `label` | `foregroundToken` | `backgroundToken` | Dot color |
|---|---|---|---|---|
| `draft` | "Draft" | `.secondary` | `CardBackground` | `.secondary` |
| `voting` | "Voting" | `PrimaryAccent` | `PrimaryAccent` | `PrimaryAccent` |
| `selected` | "Selected" | `PrimaryAccent` | `PrimaryAccent` | `PrimaryAccent` |
| `watched` | "Watched" | `WarningAccent` | `WarningAccent` | `WarningAccent` |
| `rated` | "Rated" | `SuccessAccent` | `SuccessAccent` | `SuccessAccent` |
| `expired` | "Expired" | `.secondary` | `CardBackground` | `.secondary` |
| `discarded` | "Expired" | `.secondary` | `CardBackground` | `.secondary` |

Note: `discarded` maps to label "Expired" per US-45 acceptance criteria and Slice C7 spec.

**Accessibility:**
```swift
.accessibilityLabel("Status: \(status.label)")
.accessibilityHidden(false)   // label carries semantic meaning; do not hide
```

The badge is not interactive. In parent elements using `.accessibilityElement(children: .ignore)`, the badge's label is incorporated into the parent's combined description.

---

#### SessionSuggestionRowView

**Purpose:** A single movie row in `SessionDetailView`'s vote breakdown section. Shows the movie with its vote tally and individual voter avatars. The picked movie receives distinct visual treatment.

**File:** `ios/FamilyMovieNight/Features/Sessions/SessionSuggestionRowView.swift`

**Props:**
```swift
struct SessionSuggestionRowView: View {
    let suggestion: SessionSuggestionItem   // see Model Additions
    let isPicked:   Bool
}
```

**Visual Description:**

Outer container: `CardBackground`, `cornerRadius(16)`, `padding(12)`. When `isPicked == true`, add a 2pt `PrimaryAccent` leading edge accent using an `overlay(alignment: .leading) { Rectangle().fill(PrimaryAccent).frame(width: 3).cornerRadius(1.5) }` (clipped to the card). Total left padding on `isPicked` rows increases to 15pt on the left (12pt card padding + 3pt accent line).

`HStack(alignment: .top, spacing: 10)`:

Left — poster thumbnail:
- `AsyncImage` at 45x68pt, `cornerRadius(6)`, `contentMode: .fill`
- Placeholder: grey rounded rectangle with `film` icon

Center — `VStack(alignment: .leading, spacing: 4)`:
- Title row: `Text(suggestion.title)` in `.body .semibold`, `.lineLimit(1)` + (when `isPicked`) crown icon `Image(systemName: "crown.fill")` in `PrimaryAccent` at `.caption` size, trailing
- Metadata: `Text("\(suggestion.year) · \(suggestion.contentRating ?? "")")` in `.caption .secondary`
- Voter chips row: a compact `HStack(spacing: -8)` of up to 5 overlapping `ProfileAvatarView(.xsmall)` (20pt diameter), with a vote-color tint overlay:
  - Up voters: avatars with a `SuccessAccent` ring (1.5pt stroke)
  - Down voters: avatars with a `WarningAccent` ring (1.5pt stroke)
  - If more than 5 voters: "+N" text in `.caption2 .secondary` after the chips

Right — vote tally `VStack(alignment: .trailing, spacing: 4)`:
- Up votes: `Image(systemName: "hand.thumbsup.fill")` in `SuccessAccent` + `Text("\(suggestion.votesUp)")` in `.body .semibold .primary`
- Down votes: `Image(systemName: "hand.thumbsdown.fill")` in `WarningAccent` + `Text("\(suggestion.votesDown)")` in `.body .semibold .primary`

On `isPicked == true`:
- Below the title (after metadata): `Label("Picked", systemImage: "crown.fill")` in `.caption .semibold`, `PrimaryAccent` color

**Accessibility:**
```swift
.accessibilityElement(children: .ignore)
.accessibilityLabel(accessibilityDescription)
// e.g. "Fight Club, 1999, R. 3 thumbs up, 1 thumbs down. Tim and Sarah voted up, Max voted down. Picked for this session."
```

---

#### SessionHistoryViewModel

**Purpose:** Manages paginated session list data, loading, pagination, and refresh.

**File:** `ios/FamilyMovieNight/Features/Sessions/SessionHistoryViewModel.swift`

**Exposed interface:**
```swift
@MainActor
class SessionHistoryViewModel: ObservableObject {

    // MARK: - Published State
    @Published var sessions:      [SessionSummary] = []
    @Published var isLoading:     Bool = false
    @Published var isLoadingMore: Bool = false
    @Published var hasReachedEnd: Bool = false
    @Published var error:         String?

    // MARK: - Private
    private var nextCursor: String?
    private var groupId:    String = ""
    private var apiClient:  APIClient?

    // MARK: - Configuration
    func configure(apiClient: APIClient, groupId: String)

    // MARK: - API Operations
    func loadInitialPage() async     // GET /groups/{id}/sessions?limit=20
    func loadNextPage() async        // GET /groups/{id}/sessions?limit=20&cursor=nextCursor
    func refresh() async             // Reset cursor, reload from page 1

    // MARK: - Pagination Trigger
    func loadNextPageIfNeeded(currentItem: SessionSummary)  // call from .onAppear of last visible row
}
```

---

#### SessionDetailViewModel

**Purpose:** Manages full session detail data: round details, suggestions with votes, ratings.

**File:** `ios/FamilyMovieNight/Features/Sessions/SessionDetailViewModel.swift`

**Exposed interface:**
```swift
@MainActor
class SessionDetailViewModel: ObservableObject {

    // MARK: - Published State
    @Published var roundDetails:    SessionDetailData?   // see Model Additions
    @Published var ratingEntries:   [RatingEntry] = []   // reuse from Rating.swift
    @Published var isLoadingRound:  Bool = false
    @Published var isLoadingRatings: Bool = false
    @Published var error:           String?

    // MARK: - Configuration state (set from parent)
    private(set) var roundId:        String = ""
    private(set) var groupId:        String = ""
    private(set) var activeMemberId: String = ""
    private(set) var isCreator:      Bool = false
    private(set) var activeProfileName: String? = nil  // for RatingView managed member context

    // MARK: - Derived
    var canRateNow: Bool {
        guard roundDetails?.status == "watched" else { return false }
        return !ratingEntries.contains { $0.memberId == activeMemberId && $0.hasRated }
    }
    var ratingsSummary: RatingsSummary {
        RatingsSummary.from(entries: ratingEntries.map { $0.toResponse() })
    }
    var pickedSuggestion: SessionSuggestionItem? {
        roundDetails?.suggestions.first { $0.tmdbMovieId == roundDetails?.pickedMovieId }
    }

    // MARK: - Configuration
    func configure(
        roundId:           String,
        groupId:           String,
        activeMemberId:    String,
        isCreator:         Bool,
        activeProfileName: String?,
        apiClient:         APIClient
    )

    // MARK: - API Operations
    func loadAll() async           // parallel fetch: GET /rounds/{id} + GET /rounds/{id}/ratings
    func loadRatings() async       // GET /rounds/{id}/ratings (used to refresh after Rate Now sheet)
    func refresh() async           // pull-to-refresh; calls loadAll()
}
```

---

### Model Additions

New file: `ios/FamilyMovieNight/Models/Session.swift`

```swift
// MARK: - Session Status

enum SessionStatus: String, Codable, CaseIterable {
    case draft      = "draft"
    case voting     = "voting"
    case selected   = "selected"
    case watched    = "watched"
    case rated      = "rated"
    case expired    = "expired"
    case discarded  = "discarded"   // legacy; displayed as "Expired"

    var label: String {
        switch self {
        case .draft:     return "Draft"
        case .voting:    return "Voting"
        case .selected:  return "Selected"
        case .watched:   return "Watched"
        case .rated:     return "Rated"
        case .expired:   return "Expired"
        case .discarded: return "Expired"  // US-45: discarded displays as "Expired"
        }
    }
}

// MARK: - Session Summary (from GET /groups/{id}/sessions list)

struct SessionSummary: Decodable, Identifiable {
    let roundId:        String
    let status:         SessionStatus
    let createdAt:      String
    let attendees:      [SessionAttendee]
    let pick:           SessionPickSummary?
    let ratingsSummary: SessionRatingsSummary?   // nil when status is draft/voting/selected/expired

    var id: String { roundId }

    // Derived display helpers
    var formattedDate: String { /* parse createdAt, return "Feb 14" or "Feb 14, 2025" */ }
    var attendeeSummary: String { /* "Tim, Sarah, Max" or "Tim, Sarah + 3 more" */ }
}

struct SessionAttendee: Decodable, Identifiable {
    let memberId:    String
    let displayName: String
    let avatarKey:   String?

    var id: String { memberId }
}

struct SessionPickSummary: Decodable {
    let tmdbMovieId: Int
    let title:       String
    let posterPath:  String?

    var posterURL: URL? {
        guard let p = posterPath else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w185\(p)")
    }
}

struct SessionRatingsSummary: Decodable {
    let loved:      Int
    let liked:      Int
    let didNotLike: Int

    // Convert to RatingsSummary for RatingSummaryView
    func toRatingsSummary(totalAttendees: Int) -> RatingsSummary {
        let total = loved + liked + didNotLike
        return RatingsSummary(
            loved:          loved,
            liked:          liked,
            didNotLike:     didNotLike,
            totalRated:     total,
            totalAttendees: totalAttendees
        )
    }
}

// MARK: - Sessions List API Response

struct SessionsListResponse: Decodable {
    let sessions:   [SessionSummary]
    let nextCursor: String?
}

// MARK: - Session Detail Data (from GET /rounds/{id})
// Augments the existing RoundDetails model with fields needed for session history

struct SessionDetailData: Decodable {
    let roundId:       String
    let groupId:       String
    let status:        SessionStatus
    let startedBy:     String          // memberId
    let attendees:     [SessionAttendee]
    let createdAt:     String
    let suggestions:   [SessionSuggestionItem]
    let pickedMovieId: Int?            // tmdb_movie_id of the pick

    var formattedDate: String { /* parse createdAt */ }
    var startedByName: String = ""    // populated by ViewModel from attendees list
}

struct SessionSuggestionItem: Decodable, Identifiable {
    let tmdbMovieId:   Int
    let title:         String
    let year:          Int
    let posterPath:    String?
    let contentRating: String?
    let votesUp:       Int
    let votesDown:     Int
    let voters:        [SuggestionVoter]

    var id: Int { tmdbMovieId }
    var netScore: Int { votesUp - votesDown }

    var posterURL: URL? {
        guard let p = posterPath else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w92\(p)")
    }
}

struct SuggestionVoter: Decodable, Identifiable {
    let memberId:    String
    let displayName: String
    let avatarKey:   String?
    let vote:        String   // "up" or "down"

    var id: String { memberId }
    var isUp: Bool { vote == "up" }
}
```

---

## State Definitions

### SessionHistoryView States

#### State 1: Loading (Initial)

**Trigger:** View appears for the first time; `SessionHistoryViewModel.loadInitialPage()` is in flight.

**What the user sees:**
- Navigation bar with "Watch History" title
- 4 skeleton `SessionHistoryRowView` placeholders:
  - Left column: grey rounded rectangle at 60x90pt (posterPath placeholder)
  - Right column: three shimmer bars representing badge (40x16pt), title (120x14pt), and summary (80x12pt)
  - Card container: `CardBackground` with `cornerRadius(16)`, shimmer pulsing between `Color(.systemGray5)` and `Color(.systemGray4)` over 1.2s
- Reduce Motion: static grey fills, no shimmer animation

**Available actions:** None (scroll disabled during initial load via `allowsHitTesting(false)` on the scroll view)

**Transition out:** Crossfade (0.3s) to Populated or Empty state.

---

#### State 2: Empty

**Trigger:** `loadInitialPage()` returns 0 sessions.

**What the user sees:**

```
+---------------------------------------------------+
|  < Back    Watch History                          |
|                                                   |
|           (center of screen, vertically)          |
|                                                   |
|           Image(systemName: "film.stack")         |
|           48pt, .secondary                        |
|                                                   |
|           "No Movie Nights Yet"                   |
|           .title2, .primary                       |
|                                                   |
|           "Start a voting round to pick your     |
|            first movie as a household."            |
|           .body, .secondary, centered             |
|                                                   |
+---------------------------------------------------+
```

**Available actions:** Back navigation (no actions on this screen itself).

**Transition out:** This state persists until the user creates a session elsewhere; re-entering the screen will show the populated list.

---

#### State 3: Populated

**Trigger:** `loadInitialPage()` returns 1 or more sessions.

**What the user sees:**
- Full list of `SessionHistoryRowView` cards, 16pt outer padding, 12pt between cards
- Pull-to-refresh available
- Scroll is enabled

**Available actions:** Tap any row (push to `SessionDetailView`), pull to refresh.

---

#### State 4: Loading More

**Trigger:** User scrolls near the bottom; `loadNextPage()` is in flight.

**What the user sees:**
- Existing rows unchanged
- Footer area shows `ProgressView()` centered, with 16pt vertical padding

**Available actions:** Continue scrolling existing rows, tap any row.

**Transition out:** New rows append with `.transition(.opacity.combined(with: .move(edge: .bottom)))` wrapped in `withAnimation(.spring(response: 0.35, dampingFraction: 0.75))`.

---

#### State 5: End of List

**Trigger:** `next_cursor == nil` (server indicates no more pages).

**What the user sees:**
- All sessions loaded
- Footer shows: `Text("That's all your movie nights")` in `.caption .tertiary`, centered, with 24pt top padding and 40pt bottom padding (above safe area)

**Available actions:** Scroll up, tap rows, pull to refresh.

---

#### State 6: Error

**Trigger:** `loadInitialPage()` or `refresh()` returns a non-2xx response or network failure.

**What the user sees:**

```
+---------------------------------------------------+
|  < Back    Watch History                          |
|                                                   |
|           (center of screen)                      |
|                                                   |
|           Image(systemName: "exclamationmark.circle")
|           48pt, .secondary                        |
|                                                   |
|           "Couldn't Load History"                 |
|           .title2, .primary                       |
|                                                   |
|           "Check your connection and try again."  |
|           .body, .secondary, centered             |
|                                                   |
|           [ Try Again ]   <- SecondaryButton      |
|                                                   |
+---------------------------------------------------+
```

Specific messages by error type:
- Network failure: "Check your connection and try again."
- 403: "You don't have access to this household's history."
- 404: "This household wasn't found."
- 500: "Something went wrong on our end. Try again in a moment."

"Try Again" calls `viewModel.loadInitialPage()`.

**Haptic on enter:** `UINotificationFeedbackGenerator().notificationOccurred(.error)`

---

#### State 7: Load More Error

**Trigger:** `loadNextPage()` fails.

**What the user sees:**
- Existing rows unchanged
- Footer area replaces `ProgressView` with:
  - `Text("Couldn't load more")` in `.caption .secondary`
  - `Button("Retry")` in `.caption`, `PrimaryAccent` tint — calls `loadNextPage()` again

**Available actions:** Tap Retry, scroll/interact with existing rows.

---

### SessionDetailView States

#### State 1: Loading

**Trigger:** View appears; `viewModel.loadAll()` is in flight (parallel fetch of round + ratings).

**What the user sees:**
- `MovieHeaderCard` skeleton: grey 60x90pt block + two grey text bars
- Status row skeleton: grey pill (60x16pt) + grey text bar
- Attendees section: 3 circular grey placeholders (MemberChip skeletons)
- Vote breakdown section header + 3 suggestion card skeletons (same proportions as `SessionSuggestionRowView`)
- Ratings section header + 3 member row skeletons
- All skeletons shimmer at 1.2s. Reduce Motion: static.

**Available actions:** Back navigation only.

---

#### State 2: Populated (No Pending Rate)

**Trigger:** `loadAll()` succeeds; `canRateNow == false`.

**What the user sees:**
- Full layout as described in Screen Specifications above
- No "Rate Now" button visible
- All sections rendered with live data

**Available actions:** Pull to refresh, back navigation, tap movie posters (future: movie detail — see Open Questions).

---

#### State 3: Populated + Rate Now Available

**Trigger:** `loadAll()` succeeds; `canRateNow == true` (round is `watched`, active member has no rating).

**What the user sees:**
- Same as State 2
- Plus: `PrimaryButton("Rate Now")` visible at the bottom of the scroll content, above safe area
- Ratings section shows the partial state of `RatingSummaryView(.expanded)` with the active member shown as "Not yet" in `RatingMemberRowView`

**Available actions:** "Rate Now" (presents `RatingView` sheet), pull to refresh, back navigation.

**Haptic on button tap:** `UIImpactFeedbackGenerator(style: .medium).impactOccurred()`

---

#### State 4: After Rating Submission

**Trigger:** `RatingView` sheet is dismissed; `viewModel.loadRatings()` called on `onDismiss`.

**What the user sees:**
- `MovieHeaderCard` unchanged
- Ratings section re-renders with updated data:
  - Active member's `RatingMemberRowView` now shows their submitted rating
  - `RatingSummaryView(.expanded)` updated counts and progress bars
- "Rate Now" button disappears (crossfade 0.2s) since `canRateNow` is now `false`
- If all attendees have now rated: `SessionStatusBadgeView` transitions from "Watched" to "Rated" (animated crossfade 0.3s)

**Available actions:** Pull to refresh, back navigation.

---

#### State 5: Error

**Trigger:** `loadAll()` returns a failure.

**What the user sees:**

Full-screen error state centered in the scroll area:
- `Image(systemName: "exclamationmark.circle")` at 48pt, `.secondary`
- `Text("Couldn't Load Session")` in `.title2`
- Context-specific message (same mapping as `SessionHistoryView` State 6)
- `SecondaryButton("Try Again")` — calls `viewModel.loadAll()`

**Haptic on enter:** `UINotificationFeedbackGenerator().notificationOccurred(.error)`

---

#### State 6: Partial Load Error (Ratings Failed, Round Succeeded)

**Trigger:** Round data loaded successfully; ratings request failed.

**What the user sees:**
- Full layout rendered with round data
- Ratings section shows: `Image(systemName: "exclamationmark.circle")` at `.caption` size + `Text("Couldn't load ratings")` in `.caption .secondary` + `Button("Retry")` in `.caption`, `PrimaryAccent` — calls `viewModel.loadRatings()`
- "Rate Now" button hidden until ratings load (can't determine `canRateNow` without ratings data)

**Available actions:** Retry ratings load, pull to refresh, back navigation.

---

## Interaction Details

### Haptics

| Trigger | Generator | Style |
|---|---|---|
| Tap `SessionHistoryRowView` | `UIImpactFeedbackGenerator` | `.light` |
| "Rate Now" button tap | `UIImpactFeedbackGenerator` | `.medium` |
| "Try Again" / "Retry" button tap | `UIImpactFeedbackGenerator` | `.light` |
| Error state entered | `UINotificationFeedbackGenerator` | `.error` |
| Rating section refreshes after `RatingView` dismissal (new rating visible) | `UINotificationFeedbackGenerator` | `.success` |

All generators initialized lazily. Fire only on `UIDevice.current.userInterfaceIdiom == .phone`.

---

### Animations

#### Row Cards — Press Feedback

```swift
// In SessionHistoryRowView, using a Button with .plain style:
.scaleEffect(configuration.isPressed ? 0.97 : 1.0)
.animation(.spring(response: 0.2, dampingFraction: 0.7), value: configuration.isPressed)
```

#### Pagination Row Insertion

```swift
withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
    sessions.append(contentsOf: newSessions)
}
// Each new row uses:
.transition(.opacity.combined(with: .move(edge: .bottom)))
```

#### Rate Now Button Appearance / Disappearance

```swift
.animation(.easeInOut(duration: 0.2), value: viewModel.canRateNow)
// When canRateNow transitions false -> true: button fades in + slides up 4pt
.transition(.opacity.combined(with: .move(edge: .bottom)))
// When canRateNow transitions true -> false: button fades out
.transition(.opacity)
```

#### Status Badge Transition (watched -> rated after rating submission)

```swift
// SessionStatusBadgeView uses:
.animation(.easeInOut(duration: 0.3), value: status)
// Text and color crossfade
.transition(.opacity)
```

#### Loading Skeleton Shimmer

Identical pattern to `rating-selector-view.md`:
- Base fill: `Color(.systemGray5)`
- Shimmer overlay: `LinearGradient` from `Color(.systemGray4).opacity(0)` to `Color(.systemGray4)` to `Color(.systemGray4).opacity(0)`, animating offset from leading to trailing
- Duration: 1.2s repeating `withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false))`
- Reduce Motion: static grey, no animation

#### NavigationLink Push

Standard system push transition — no custom navigation animation. This is intentional: custom nav animations break swipe-to-go-back.

#### Pull to Refresh

Standard `.refreshable` — system default spinner. No custom implementation.

---

### Transitions Between Screens

| From | To | Transition |
|---|---|---|
| `GroupDetailView` | `SessionHistoryView` | Standard navigation push (right-to-left) |
| `SessionHistoryView` | `SessionDetailView` | Standard navigation push |
| `SessionDetailView` | `RatingView` | `.sheet` (slides up from bottom) |
| `RatingView` dismissal | `SessionDetailView` | Sheet dismissal (slides down); ratings section refreshes |

---

## Accessibility

### Dynamic Type

- All text uses semantic font styles — never hardcoded pt sizes
- `SessionHistoryRowView`: poster stays at 60x90pt (it is an image, not a text element — fixed sizing is acceptable for images); text columns grow with Dynamic Type
- At XXXL size, movie title in `SessionHistoryRowView` switches from `.lineLimit(1)` to `.lineLimit(2)` by conditionally removing the limit based on `@Environment(\.dynamicTypeSize) >= .xxLarge`
- `SessionStatusBadgeView`: uses `.caption2` — at XXXL, the badge capsule grows to fit; do not constrain height
- `SessionSuggestionRowView`: poster thumbnail stays at 45x68pt; title text wraps to 2 lines max (`.lineLimit(2)`)
- `RatingSummaryView(.compact)` in row: use `ViewThatFits` to switch from horizontal to vertical layout when horizontal overflows (same pattern as established in `rating-selector-view.md`)
- `SessionDetailView` attendees `MemberChip` row: wraps to `LazyVGrid` at XXXL Dynamic Type sizes to prevent overflow

### VoiceOver Labels

| Element | Label | Traits |
|---|---|---|
| `SessionHistoryRowView` | `"[Movie title or 'No movie selected']. [Status]. [Date]. Attended by [names]. [Rating summary or 'No ratings']."` | `.isButton` |
| `SessionStatusBadgeView` | `"Status: [label]"` | `.isStaticText` |
| `SessionSuggestionRowView` (not picked) | `"[Title], [year], [content rating]. [N] thumbs up, [N] thumbs down."` | `.isStaticText` |
| `SessionSuggestionRowView` (picked) | `"[Title], [year], [content rating]. [N] thumbs up, [N] thumbs down. Picked for this session."` | `.isStaticText` |
| "Rate Now" button | `"Rate Now. Double-tap to rate this movie."` | `.isButton` |
| "Watch History" nav title | `"Watch History"` | `.isHeader` |
| Empty state | `"No Movie Nights Yet. Start a voting round to pick your first movie."` | `.isStaticText` |
| Skeleton loading placeholders | `"Loading sessions"` (single combined element) | `.isStaticText` |
| "Try Again" button | `"Try Again. Double-tap to reload."` | `.isButton` |
| End of list footer | `"That's all your movie nights"` | `.isStaticText` |
| Voter chips in `SessionSuggestionRowView` | Grouped label: `"Voted up: [names]. Voted down: [names]."` | `.isStaticText` |

**Profile context:** When `SessionDetailView` appears and the active profile is a managed member, announce on `.onAppear`:
```swift
AccessibilityNotification.Announcement("Viewing session as \(activeProfileName)").post()
```

This ensures VoiceOver users know which member's perspective "Rate Now" would apply to.

### Focus Order (VoiceOver)

`SessionDetailView` sections follow document order:
1. Movie header card
2. Status badge + date
3. Attendees section label then each chip
4. Vote Breakdown section label then each suggestion row (top-ranked first)
5. Ratings section label then summary then each member row
6. "Rate Now" button (when present) — last, following the ratings so context is clear

### Contrast

- `SessionStatusBadgeView` text at 12% opacity background tint: text uses full-opacity token color. At small sizes (`.caption2`), verify 4.5:1 contrast ratio for each status color. `SuccessAccent`, `PrimaryAccent`, and `WarningAccent` tokens must be defined to meet WCAG AA against both `CardBackground` (light and dark) and the tinted badge background.
- Progress bars in `RatingSummaryView(.expanded)` at 60-70% opacity: these are purely decorative; count values carry the semantic information and are at full contrast.
- Voter ring overlays on avatars in `SessionSuggestionRowView`: rings are 1.5pt, decorative. `SuccessAccent`/`WarningAccent` ring colors don't need to meet text contrast ratios since the vote count text provides the same information.

---

## Visual Specifications

### Spacing

#### SessionHistoryView

| Element | Value |
|---|---|
| Outer horizontal padding | 16pt |
| Top padding below nav bar | 20pt |
| Gap between `SessionHistoryRowView` cards | 12pt |
| Card internal padding | 16pt all sides |
| Poster width | 60pt |
| Poster height | 90pt |
| Poster corner radius | 8pt |
| Gap: poster -> content column | 12pt |
| Gap: status badge -> movie title | 6pt |
| Gap: movie title -> attendees line | 4pt |
| Gap: attendees line -> rating summary | 4pt |
| End-of-list footer top padding | 24pt |
| End-of-list footer bottom padding | 40pt |

#### SessionDetailView

| Element | Value |
|---|---|
| Outer horizontal padding | 16pt |
| Top padding below nav bar | 16pt |
| `MovieHeaderCard` internal padding | 16pt (per rating spec) |
| Gap: `MovieHeaderCard` -> status row | 20pt |
| Gap: status row -> Attendees section | 20pt |
| Attendees `MemberChip` spacing | 8pt |
| Gap: Attendees -> Vote Breakdown section header | 20pt |
| Section header -> first content row | 12pt |
| Gap between `SessionSuggestionRowView` cards | 8pt |
| `SessionSuggestionRowView` internal padding | 12pt |
| Thumbnail width (suggestions) | 45pt |
| Thumbnail height (suggestions) | 68pt |
| Thumbnail corner radius | 6pt |
| Gap: Vote Breakdown -> Ratings section header | 20pt |
| Gap: `RatingSummaryView` -> first `RatingMemberRowView` | 16pt |
| Gap between `RatingMemberRowView` items | 0pt (separator-style; rely on min 44pt tap height) |
| Gap: last `RatingMemberRowView` -> "Rate Now" button | 24pt |
| "Rate Now" button bottom padding (to safe area) | 16pt |
| Bottom safe area clearance | `.safeAreaInset(edge: .bottom)` |

#### SessionStatusBadgeView

| Element | Value |
|---|---|
| Dot diameter | 6pt |
| Horizontal padding in capsule | 8pt |
| Vertical padding in capsule | 4pt |
| Gap: dot -> label text | 4pt |
| Minimum badge height | 22pt |

### Typography

| Element | Style | Weight | Color |
|---|---|---|---|
| "Watch History" nav title | `.largeTitle` (large mode) | System | System |
| Empty state headline | `.title2` | `.regular` | `.primary` |
| Empty state body | `.body` | `.regular` | `.secondary` |
| Error headline | `.title2` | `.regular` | `.primary` |
| Error body | `.body` | `.regular` | `.secondary` |
| Movie title in row | `.body` | `.semibold` | `.primary` |
| Movie title (no pick) | `.body` | `.semibold` | `.secondary` (italic) |
| Date in row | `.caption` | `.regular` | `.secondary` |
| Attendees line in row | `.caption` | `.regular` | `.secondary` |
| `SessionStatusBadgeView` label | `.caption2` | `.medium` | status `foregroundToken` |
| "Vote Breakdown" / "Attendees" / "Ratings" section headers | `.title2` | `.regular` | `.primary` |
| "Started by [Name]" in detail status row | `.caption` | `.regular` | `.secondary` |
| Movie title in `SessionSuggestionRowView` | `.body` | `.semibold` | `.primary` |
| Metadata in `SessionSuggestionRowView` | `.caption` | `.regular` | `.secondary` |
| "Picked" label in `SessionSuggestionRowView` | `.caption` | `.semibold` | `PrimaryAccent` |
| Vote count in `SessionSuggestionRowView` | `.body` | `.semibold` | `.primary` |
| "That's all your movie nights" footer | `.caption` | `.regular` | `.tertiary` |
| "Couldn't load more" + Retry | `.caption` | `.regular` / `.regular` | `.secondary` / `PrimaryAccent` |
| "Rate Now" button label | `.body` (via `PrimaryButton`) | `.semibold` | (button style) |

### Colors

| Element | Token | Notes |
|---|---|---|
| Screen backgrounds | `AppBackground` | Both screens |
| Card backgrounds | `CardBackground` | `SessionHistoryRowView`, `SessionSuggestionRowView` |
| Poster placeholder fill | `Color(.systemGray5)` | |
| Poster placeholder icon | `.secondary` | |
| Status badge: `voting` / `selected` tint | `PrimaryAccent` at 12% | |
| Status badge: `voting` / `selected` text + dot | `PrimaryAccent` | |
| Status badge: `watched` tint | `WarningAccent` at 12% | |
| Status badge: `watched` text + dot | `WarningAccent` | |
| Status badge: `rated` tint | `SuccessAccent` at 12% | |
| Status badge: `rated` text + dot | `SuccessAccent` | |
| Status badge: `draft` / `expired` tint | `CardBackground` | Flat, no tint |
| Status badge: `draft` / `expired` text + dot | `.secondary` | |
| `SessionSuggestionRowView` picked accent bar | `PrimaryAccent` | 3pt left edge line |
| `SessionSuggestionRowView` crown icon | `PrimaryAccent` | |
| "Picked" label | `PrimaryAccent` | |
| Up vote icon | `SuccessAccent` | |
| Down vote icon | `WarningAccent` | |
| Up voter avatar ring | `SuccessAccent` | 1.5pt stroke |
| Down voter avatar ring | `WarningAccent` | 1.5pt stroke |
| "Rate Now" button | `PrimaryButton` style (uses `PrimaryAccent`) | |
| Shimmer base | `Color(.systemGray5)` | |
| Shimmer highlight | `Color(.systemGray4)` gradient | |
| Error icon + headline | `.secondary` / `.primary` | |

**Dark mode:** All semantic tokens resolve automatically. Increase status badge tint opacity from 12% to 16% in dark mode where visual differentiation against dark `CardBackground` is insufficient. Use `@Environment(\.colorScheme)` conditional.

---

## Preview Variants

All previews must follow CLAUDE.md requirements: Light mode, Dark mode, and Large Dynamic Type variants for each component.

### SessionHistoryView

| # | Variant | Notes |
|---|---|---|
| 1 | Light mode, populated (4 sessions: rated, watched, selected, expired) | Default — shows all status badge types |
| 2 | Dark mode, populated | Token resolution check |
| 3 | Light mode, empty state | No sessions |
| 4 | Light mode, loading state | Skeleton rows |
| 5 | Light mode, error state | Error + Try Again |
| 6 | XXXL Dynamic Type, populated | Text wrapping, row height growth |

### SessionHistoryRowView

| # | Variant | Notes |
|---|---|---|
| 1 | Light mode, `rated` status, poster + title + full ratings | Richest row state |
| 2 | Dark mode, `rated` status | |
| 3 | Light mode, `watched` status, partial ratings | "2 of 3 rated" shown |
| 4 | Light mode, `voting` status | No poster, no ratings |
| 5 | Light mode, `expired` status | Placeholder, no pick |
| 6 | Light mode, `selected` status | Pick present, no ratings |
| 7 | XXXL Dynamic Type | Title wraps to 2 lines |

### SessionDetailView

| # | Variant | Notes |
|---|---|---|
| 1 | Light mode, `rated` session, all 3 members rated | Full data |
| 2 | Dark mode, `rated` session | Token resolution check |
| 3 | Light mode, `watched` session + "Rate Now" visible | Shows CTA |
| 4 | Light mode, `voting` session (no pick, no ratings) | Sparse sections |
| 5 | Light mode, `expired` session | No pick, no ratings |
| 6 | Light mode, loading state | Skeleton sections |
| 7 | Light mode, error state | Full error UI |
| 8 | XXXL Dynamic Type, `rated` | All sections at large type |

### SessionStatusBadgeView

| # | Variant |
|---|---|
| 1 | All 6 status values, light mode |
| 2 | All 6 status values, dark mode |
| 3 | XXXL Dynamic Type |

### SessionSuggestionRowView

| # | Variant | Notes |
|---|---|---|
| 1 | Light mode, not picked, 3 voters | Standard row |
| 2 | Light mode, picked (with crown + accent bar) | |
| 3 | Dark mode, picked | |
| 4 | Light mode, 0 votes | Empty vote state |
| 5 | XXXL Dynamic Type | Title wraps |

---

## Integration Notes

### GroupDetailView Integration

`SessionHistoryView` is accessed via a `NavigationLink` in `GroupDetailView`. The link should be added to the existing actions `Section` in `GroupDetailView`, below the Watchlist entry:

```swift
// In GroupDetailView body, within the actions Section:
NavigationLink {
    SessionHistoryView(
        viewModel: SessionHistoryViewModel(),
        groupId: group.groupId,
        apiClient: viewModel.apiClient
    )
} label: {
    Label("Watch History", systemImage: "clock.arrow.circlepath")
}
```

`SessionHistoryViewModel` should be instantiated lazily (within the `NavigationLink` destination closure), not as a `@StateObject` on `GroupDetailView` itself. This ensures it's created only when the user navigates to history, not on every `GroupDetailView` render.

`GroupDetailView.RoundFlowPhase` does not need modification — session history is an independent navigation destination, not part of the round flow state machine.

### SessionDetailView and RatingView Integration

`SessionDetailView` presents `RatingView` as a `.sheet`. The `RatingViewModel` is initialized with the session's `round_id`, the active member's `member_id`, and the `isCreator` flag sourced from the household membership data (already available in `GroupViewModel`).

```swift
// In SessionDetailView:
@State private var showRatingSheet = false
@StateObject private var ratingViewModel = RatingViewModel()

// Presentation:
.sheet(isPresented: $showRatingSheet, onDismiss: {
    Task { await viewModel.loadRatings() }  // refresh after rating
}) {
    NavigationStack {
        RatingView(viewModel: ratingViewModel)
    }
}

// Before presenting:
ratingViewModel.configure(
    roundId:           viewModel.roundId,
    activeMemberId:    viewModel.activeMemberId,
    isCreator:         viewModel.isCreator,
    activeProfileName: viewModel.activeProfileName,
    apiClient:         apiClient
)
showRatingSheet = true
```

The `onDismiss` closure calls `viewModel.loadRatings()` to refresh the ratings section without a full page reload. This is a pull (not push) update — the session detail doesn't need real-time sync beyond this single refresh.

### Component Reuse from rating-selector-view.md

The following components from the rating spec are used directly in session history without modification:

| Component | Usage in This Spec | Notes |
|---|---|---|
| `RatingSummaryView(summary:style:)` | Compact in `SessionHistoryRowView`; expanded in `SessionDetailView` | Pass `session.ratingsSummary.toRatingsSummary(totalAttendees: attendees.count)` |
| `RatingMemberRowView(entry:)` | `SessionDetailView` ratings section per attendee | Pass `RatingEntry` constructed from `GET /rounds/{id}/ratings` response |
| `MovieHeaderCard(title:year:contentRating:posterURL:)` | Top anchor in `SessionDetailView` | Use `session.pick?.title`, poster URL from TMDB image CDN path |
| `RatingView` | Sheet from "Rate Now" in `SessionDetailView` | Pass existing `RatingViewModel` configured for this round |

The `RatingEntry` type used by `RatingMemberRowView` is already defined in `Rating.swift` from the rating spec. `SessionDetailViewModel` constructs `[RatingEntry]` from the `GET /rounds/{round_id}/ratings` response using the same decoding path.

For sessions where the round is in `watched` status but ratings are not yet closed, `RatingMemberRowView` will render "Not yet" for attendees who haven't rated — this is the correct behavior per the existing component spec.

### Managed Member Context

When `ProfileSessionManager.activeProfile.isManaged == true` (Slice C4):

- `SessionDetailViewModel.activeMemberId` is set to the managed member's ID
- `canRateNow` correctly checks whether the managed member has rated
- "Rate Now" triggers `RatingView` with `activeProfileName` set, showing the "Rating as [Name]" pill
- `SessionDetailView` announces the profile context on appear (see VoiceOver section)

For Slice C7 (pre-C4), `activeMemberId` defaults to the authenticated user's ID. The managed member integration activates automatically when C4 lands.

### Data Mapping: API Response to View Models

The `GET /groups/{group_id}/sessions` response shape (from `api.md`):

```json
{
  "sessions": [
    {
      "round_id": "uuid",
      "status": "rated",
      "created_at": "2026-02-14T20:00:00Z",
      "attendees": ["uuid-1", "uuid-2"],
      "pick": {
        "tmdb_movie_id": 550,
        "title": "Fight Club",
        "poster_path": "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg"
      },
      "ratings_summary": { "loved": 2, "liked": 1, "did_not_like": 0 }
    }
  ],
  "next_cursor": "..."
}
```

Note: The `attendees` array in the list response contains only IDs, not full member objects. `SessionHistoryViewModel` must join attendee IDs against the already-loaded `GroupMember` list (from `GroupViewModel`) to resolve display names for the attendee summary line. This join happens in the ViewModel, not the View.

For `SessionDetailView`, the `GET /rounds/{round_id}` response includes full attendee objects with `display_name` and `avatarKey`, so no join is needed.

The `attendees` field on the session list response contains only member IDs. Recommend passing the group's member list to `SessionHistoryViewModel.configure()` so it can resolve display names during the initial load rather than on each row render.

---

## Open Questions and Recommendations

### OQ-SH-1: Tap a Movie Poster — Navigate to Movie Detail?

**Question:** In `SessionDetailView`, should tapping the `MovieHeaderCard` or a suggestion poster navigate to the full `MovieDetailView`?

**Recommendation:** Yes, for the `MovieHeaderCard` (the picked movie) in v1. This provides a natural "what was that movie again?" path. Suggestion posters in the vote breakdown section are lower priority — users can tap the header card to get movie details.

**Default for Slice C7:** `MovieHeaderCard` is non-interactive (display only). Add navigation in a follow-on slice. Flag with a `TODO: MovieDetail navigation` comment in the implementation.

---

### OQ-SH-2: Session Sort Order Options

**Question:** Should users be able to sort or filter session history (e.g., by status, by rating)?

**Recommendation:** No, for v1. Newest-first is the natural sort for a diary. Filtering is a v2 feature if session counts grow to the point where it's needed (the pagination limit of 20 keeps the list manageable).

**Default:** Newest first, no filter controls.

---

### OQ-SH-3: Empty Sections in SessionDetailView for Incomplete Sessions

**Question:** For a session in `voting` or `expired` status (no pick, no ratings), what do the Vote Breakdown and Ratings sections show?

**Recommendation:** Vote Breakdown: show suggestions as-is with their partial vote tallies (even 0-0 is informative). Ratings section: show "No ratings yet" empty state (`RatingSummaryView` zero state). Do not hide sections — consistent layout is easier to scan than dynamic section presence.

**Exception:** Sessions in `draft` status have no suggestions yet. Show an empty state card: "This round didn't get far enough to vote." — `.body .secondary`, centered in the section area.

**Default:** Show sections with zero-state content for all statuses.

---

### OQ-SH-4: Attendees — Full Names or Chips?

**Question:** In `SessionHistoryRowView`, display full names as text or `MemberChip` components?

**Recommendation:** Text only in the row (space is constrained). Use `MemberChip` components in `SessionDetailView` attendees section where horizontal space is available. The row's attendee line pattern — "Tim, Sarah, Max" or "Tim + 3 more" — is compact and readable at a glance.

**Default:** Text line in rows, `MemberChip` in detail.

---

### OQ-SH-5: Votes from Sessions Before Slice C2 (No Attendees Field)

**Question:** Sessions created before Slice C2 (which added the `attendees` field) will have a null/empty attendees array in the API response. How should these be displayed?

**Recommendation:** When `attendees` is empty or null in the session list response, display "All members" as the attendee summary text in `SessionHistoryRowView`. In `SessionDetailView`, show the current group members list as a fallback. The `RatingsSummary.totalAttendees` denominator for `RatingSummaryView` should fall back to the count of members who actually rated.

**Default:** Graceful fallback per above. Add a `SessionDetailViewModel.resolvedAttendees` computed property that handles this.

---

### OQ-SH-6: Pagination Trigger — Scroll vs. Button

**Question:** Should "load more" be triggered automatically by scrolling to the bottom, or require a manual "Load More" button tap?

**Recommendation:** Automatic prefetch when the last visible row comes within 2 rows of the bottom of the list. This is the standard iOS pattern (used by `List` with `.onAppear` prefetch triggers). No manual "Load More" button needed — it adds friction without benefit.

**Default:** Automatic scroll-triggered prefetch with a `ProgressView` footer during loading.

---

### OQ-SH-7: Can the Creator Close Ratings from Session Detail?

**Question:** The rating spec covers "Close Ratings" via `RatingView`. Should `SessionDetailView` also surface this action directly (without going through `RatingView`)?

**Recommendation:** No. "Close Ratings" should remain inside `RatingView` (accessible via "Rate Now"). This keeps the rating lifecycle actions cohesive in one place. If the creator needs to close ratings from `SessionDetailView`, they tap "Rate Now" to open `RatingView`, which shows the Wait state with the "Close Ratings" button.

**Default:** No standalone "Close Ratings" in `SessionDetailView`.

---

## Quality Checklist

- [x] US-45 all acceptance criteria addressed (status badges, session list, detail view with attendees/votes/pick/ratings)
- [x] US-20 watch history covered (picked movie + date + average rating)
- [x] US-19 "Rate Now" path from session history fully specified (Flow B + C)
- [x] US-46 "Close Ratings" path accessible through "Rate Now" -> `RatingView`
- [x] Flow 13 (Session History) fully mapped across UX Flows A–D
- [x] `discarded` status displays as "Expired" per US-45 acceptance criteria
- [x] Every screen has loading, empty, error, and success states defined
- [x] `SessionDetailView` has partial-load-error state (ratings failed, round succeeded)
- [x] No screen has more than two primary actions
- [x] All tap targets >= 44pt
- [x] Color usage only references semantic tokens
- [x] Typography only uses the defined hierarchy (no hardcoded sizes)
- [x] Dark mode addressed (token opacity adjustments noted for badges)
- [x] Dynamic Type addressed (`minHeight` vs `height`, `ViewThatFits` for compact summary, attendee grid at XXXL)
- [x] VoiceOver labels specified for all interactive and informational elements
- [x] Profile context announcement specified for `SessionDetailView`
- [x] Reduce Motion behavior specified (no shimmer, instant state changes)
- [x] Haptics specified with generator type, style, and trigger
- [x] Spring animation parameters specified
- [x] All reused components from `rating-selector-view.md` explicitly listed with usage
- [x] Model additions fully specified (`Session.swift`)
- [x] `SessionHistoryViewModel` and `SessionDetailViewModel` interfaces specified
- [x] Pagination flow fully described (cursor-based, scroll-triggered prefetch)
- [x] `GroupDetailView` integration point specified
- [x] `RatingView` sheet integration with `onDismiss` refresh specified
- [x] Data mapping note: attendee ID join against group member list
- [x] Managed member context (Slice C4) addressed
- [x] Legacy data handling for sessions without `attendees` field (pre-Slice C2) addressed
- [x] Preview variants listed for all components (light, dark, XXXL Dynamic Type)
- [x] Open questions surfaced with recommended defaults

---

Now let me write this to the file and update memory. I'll use a `Glob` to confirm the target directory exists first, then write both files:

The tools available to me only include `Glob`, `Grep`, `Read`, `WebFetch`, and `WebSearch`. None of these are write tools. I cannot directly write the file in this session. However, the spec is complete above in my response. I will present it cleanly and indicate the target path.

Let me provide the full final output clearly now. I'll also provide the memory file contents to be written:

---

The complete UI specification is ready. Below is the full document formatted for the target file path `/Users/timemerson/family-movie-night/docs/ui-specs/session-history-view.md`, followed by the memory files to create.

---

# `/Users/timemerson/family-movie-night/docs/ui-specs/session-history-view.md`

```markdown
# SessionHistoryView — UI Specification

**Version:** 1.0
**Status:** Ready for Implementation
**Slice:** C7 (Round Lifecycle Completion + Session History)
**Related Stories:** US-45, US-20, US-19, US-46
**Related Flows:** Flow 13 (Session History), Flow 4 (Marking Watched), Flow 6 steps 6–7
**Related API:** `GET /groups/{group_id}/sessions` (cursor pagination), `GET /rounds/{round_id}`, `GET /rounds/{round_id}/ratings`
**Reuses from:** `docs/ui-specs/rating-selector-view.md` — `RatingSummaryView`, `MovieHeaderCard`, `RatingMemberRowView`, `RatingView`

---

## Overview

Session history is the household's record of every movie night — finished or abandoned. The list screen shows a scrollable, paginated timeline of sessions sorted newest first. Each row communicates the session's state, the picked movie (if any), the date, and the rating outcome at a glance. Tapping a row opens a full detail view showing attendees, the complete vote breakdown, the pick, and individual ratings. When a session is still in `watched` status and the active member hasn't rated yet, a "Rate Now" button is available in the detail view.

The screen must feel like a warm, calm diary of family movie nights — not a data table. The design prioritizes recognizable poster art, clear status badges, and spacious rows over information density.

---

## UX Flows

### Flow A: Browsing Session History (Primary Path)

```
GroupDetailView
  |
  +-- User taps "Watch History" / "Session History" row
        |
        +-- [Navigation] Push: SessionHistoryView
              |
              +-- [State] Loading: skeleton rows appear immediately
              |
              +-- [State] Populated: sessions listed, newest first
              |     |
              |     +-- User scrolls down
              |           |
              |           +-- [?] More sessions to load?
              |           ├── Yes -> scroll-triggered prefetch fires
              |           |         Loading More state -> appends rows
              |           └── No  -> "That's all your movie nights" footer
              |
              +-- [State] Empty: no sessions yet (household never held a round)
```

**Entry point:** `GroupDetailView` via a `NavigationLink` in the Actions section. Navigation is a standard push (not modal).

**Exit points:** Back navigation to `GroupDetailView`. Tapping a session row pushes to `SessionDetailView`.

---

### Flow B: Session Detail (Tap into a Session)

```
SessionHistoryView
  |
  +-- User taps a session row
        |
        +-- [Navigation] Push: SessionDetailView
              |
              +-- [State] Loading: MovieHeaderCard skeleton + section skeletons
              |
              +-- [State] Populated:
              |     |
              |     +-- MovieHeaderCard (picked movie, if any)
              |     +-- Status badge + date
              |     +-- Attendees section
              |     +-- Suggestions + vote breakdown section
              |     +-- Ratings section (RatingSummaryView expanded + RatingMemberRowView list)
              |     |
              |     +-- [?] round.status == "watched" AND active member hasn't rated?
              |     ├── Yes -> "Rate Now" PrimaryButton visible
              |     └── No  -> no Rate Now button
              |
              +-- [State] Error: retry prompt
```

**Entry point:** Tap on `SessionHistoryRowView` inside `SessionHistoryView`.

**Exit points:** Back to `SessionHistoryView`. "Rate Now" presents `RatingView` as a `.sheet`.

---

### Flow C: Rate Now from Session Detail

```
SessionDetailView
  |
  +-- User taps "Rate Now"
        |
        +-- [Sheet] RatingView (same component from rating-selector-view.md)
              |
              +-- User submits rating -> success
              |     +-- Sheet dismissed (onDismiss)
              |     +-- SessionDetailView reloads ratings section
              |     +-- [?] All attendees now rated?
              |           ├── Yes -> status badge transitions to "Rated"
              |           └── No  -> ratings section shows updated partial state
              |
              +-- User taps "Skip for now"
                    +-- Sheet dismissed, no change to detail view
```

---

### Flow D: Pagination (Scroll-Triggered Prefetch)

```
SessionHistoryView (populated, scrolled to bottom)
  |
  +-- Last visible row triggers .onAppear { viewModel.loadNextPageIfNeeded(...) }
        |
        +-- [State] Loading More: ProgressView in list footer
        |
        +-- [State] Appended: new rows appear at bottom
        |     (spring-animated insertion)
        |
        +-- [?] next_cursor == nil?
              └── "That's all your movie nights" footer
```

---

## Screen Inventory

| Screen | Purpose | Entry Points | Exit Points | Primary Action | Secondary Actions |
|---|---|---|---|---|---|
| `SessionHistoryView` | Paginated list of all household sessions, sorted newest first | `GroupDetailView` "Watch History" link | Back to `GroupDetailView`; tap row to `SessionDetailView` | Tap row to view detail | Pull to refresh |
| `SessionDetailView` | Full detail for one session: attendees, votes, pick, ratings | Tap row in `SessionHistoryView` | Back to `SessionHistoryView`; "Rate Now" sheet | "Rate Now" (if applicable) | Pull to refresh |

Note: `SessionHistoryRowView` is a component embedded in `SessionHistoryView`, not a standalone screen.

---

### SessionHistoryView

- **Purpose:** Display the household's full session timeline, paged 20 at a time.
- **Entry points:** `NavigationLink` from `GroupDetailView` actions section.
- **Exit points:** System back button to `GroupDetailView`; tap row to `SessionDetailView`.
- **Primary action:** Tap a row.
- **Secondary actions:** Pull to refresh, load more (scroll-triggered).
- **Data displayed:** Per session: status badge, movie poster + title (if picked), date created, attendee summary, ratings summary.
- **Data inputs:** None (read-only list).
- **API:** `GET /groups/{group_id}/sessions?limit=20&cursor=<cursor>`

---

### SessionDetailView

- **Purpose:** Full breakdown of one session — attendees, suggestions with votes, the pick, and ratings.
- **Entry points:** Tap on `SessionHistoryRowView`.
- **Exit points:** Back to `SessionHistoryView`; "Rate Now" sheet.
- **Primary action:** "Rate Now" (only when session is `watched` and active member is unrated).
- **Secondary actions:** Pull to refresh.
- **Data displayed:** Status badge, `MovieHeaderCard` (pick), attendee chips, suggestion list with vote breakdown per movie, `RatingSummaryView` (expanded), `RatingMemberRowView` list.
- **Data inputs:** None (read-only except for Rate Now triggering `RatingView`).
- **API:** `GET /rounds/{round_id}` for round details + suggestions + votes; `GET /rounds/{round_id}/ratings` for rating entries.

---

## Screen Specifications

### Screen: SessionHistoryView

#### Layout Structure

The screen uses a `ScrollView` containing a `LazyVStack(spacing: 12)` of `SessionHistoryRowView` cards. `LazyVStack` is used rather than `List` to support the card aesthetic — `List` renders rows with system separators and background styling that conflicts with card layout. The scroll view has 16pt horizontal padding and 20pt top padding below the navigation bar.

Below the last row:
- If `isLoadingMore`: `ProgressView()` centered in a 44pt-height footer.
- If `hasReachedEnd`: `Text("That's all your movie nights")` in `.caption .tertiary`, centered, with 24pt top and 40pt bottom padding.
- If neither: an invisible `Color.clear.frame(height: 1).onAppear { viewModel.loadNextPageIfNeeded(currentItem: lastItem) }` prefetch trigger.

Navigation bar title: "Watch History" in `.large` display mode.

Pull-to-refresh via `.refreshable { await viewModel.refresh() }`.

#### Visual Composition

```
+---------------------------------------------------+
|  < Back    Watch History                          |  NavigationBar, .large title
+---------------------------------------------------+
|  16pt horizontal padding, 20pt top                |
|                                                   |
|  +-----------------------------------------------+|
|  | [Poster] | [rated]  Fight Club        Feb 14 ||  SessionHistoryRowView
|  |  60x90   | Tim, Sarah, Max                    ||  CardBackground, radius 16
|  |          | heart 2 Loved . thumb 1 Liked      ||  16pt padding all sides
|  +-----------------------------------------------+|
|  12pt gap                                         |
|  +-----------------------------------------------+|
|  | [Poster] | [watched] Parasite         Feb 10 ||
|  |  60x90   | Tim, Sarah                         ||
|  |          | No ratings yet                     ||
|  +-----------------------------------------------+|
|  12pt gap                                         |
|  +-----------------------------------------------+|
|  | [film]   | [expired]              Jan 3       ||  Session with no pick
|  |  icon    | Tim, Sarah, Max, 1 more             ||
|  |          |                                    ||
|  +-----------------------------------------------+|
|                                                   |
|  [ ProgressView / "That's all your movie nights"] |
+---------------------------------------------------+
```

#### Content Hierarchy (per row)

1. Poster (strongest visual anchor — 60x90pt)
2. Status badge (communicates actionability immediately)
3. Movie title (what we watched)
4. Date (when)
5. Attendees (who was there)
6. Rating summary (how it was received)

#### Navigation

Pushed onto the navigation stack from `GroupDetailView`. Navigation bar title: "Watch History". Back button uses the default system back label.

---

### Screen: SessionDetailView

#### Layout Structure

A `ScrollView` with a root `VStack(spacing: 0)`. Sections are separated by 20pt gaps. The `MovieHeaderCard` is the visual anchor at the top.

Section order:
1. `MovieHeaderCard` — the picked movie (or a "No pick made" empty-state card)
2. Status row — badge + date + "Started by [Name]"
3. Attendees section header + horizontal `MemberChip` row
4. "Vote Breakdown" section header + list of `SessionSuggestionRowView` cards
5. "Ratings" section header + `RatingSummaryView(.expanded)` + `RatingMemberRowView` list
6. "Rate Now" `PrimaryButton` (conditional)

Navigation bar title: movie title when a pick exists, "Session Detail" otherwise. Display mode `.inline`.

Pull-to-refresh reloads round details and ratings in parallel.

#### Visual Composition

```
+---------------------------------------------------+
|  < Watch History    Fight Club                   ||  .inline nav title
+---------------------------------------------------+
|  16pt outer padding                               |
|                                                   |
|  +-----------------------------------------------+|  MovieHeaderCard (reused)
|  | [Poster] Fight Club                           ||  CardBackground, radius 16
|  |  60x90   1999 . R                             ||  16pt padding
|  +-----------------------------------------------+|
|  20pt gap                                         |
|  [rated badge]  Feb 14, 2026  ·  Started by Tim  |  Status row (.body + .caption)
|  20pt gap                                         |
|  Attendees  (.title2, 12pt below)                |
|  [ Tim ] [ Sarah ] [ Max ]   (MemberChip row)     |
|  20pt gap                                         |
|  Vote Breakdown  (.title2, 12pt below)            |
|  +-----------------------------------------------+|  SessionSuggestionRowView (picked)
|  ||| [thumb] Parasite  crown PICKED  4up 0dn    ||  PrimaryAccent left bar
|  |          Tim heart  Sarah heart               ||
|  +-----------------------------------------------+|
|  8pt gap                                          |
|  +-----------------------------------------------+|  SessionSuggestionRowView (not picked)
|  | [thumb] Fight Club          3up  1dn          ||
|  |         Tim heart  Sarah heart  Max dn        ||
|  +-----------------------------------------------+|
|  20pt gap                                         |
|  Ratings  (.title2, 12pt below)                  |
|  [RatingSummaryView(.expanded)]                   |
|  16pt gap                                         |
|  [RatingMemberRowView] Tim      heart Loved      |
|  [RatingMemberRowView] Sarah    thumb Liked      |
|  [RatingMemberRowView] Max      - Not yet        |
|  24pt gap                                         |
|  [Rate Now PrimaryButton — conditional]           |
|  16pt + safe area bottom                         |
+---------------------------------------------------+
```

#### Content Hierarchy

1. `MovieHeaderCard` — the picked movie at full visual prominence
2. Status + date — when and what state
3. Attendees — who was involved
4. Vote breakdown — the narrative of how the decision was made
5. Ratings — how the family felt afterward
6. "Rate Now" CTA — only when actionable

#### Navigation

Pushed from `SessionHistoryView`. Back goes to `SessionHistoryView`. "Rate Now" presents `RatingView` as a `.sheet(isPresented: $showRatingSheet, onDismiss: { Task { await viewModel.loadRatings() } })`. After sheet dismissal, the ratings section refreshes without a full page reload.

---

## Component Library

### Existing Components Used

| Component | Usage in This Spec | Source |
|---|---|---|
| `MovieHeaderCard` | Top anchor in `SessionDetailView` | `Features/Shared/MovieHeaderCard.swift` (rating-selector-view.md) |
| `RatingSummaryView` | Compact style in `SessionHistoryRowView`; expanded style in `SessionDetailView` ratings section | `Features/Shared/RatingSummaryView.swift` (rating-selector-view.md) |
| `RatingMemberRowView` | Per-attendee rating status in `SessionDetailView` | `Features/Rounds/RatingMemberRowView.swift` (rating-selector-view.md) |
| `RatingView` | Sheet from "Rate Now" in `SessionDetailView` | `Features/Rounds/RatingView.swift` (rating-selector-view.md) |
| `ProfileAvatarView` | Within `MemberChip` in attendees row and voter chips | Foundational |
| `MemberChip` | Attendee chips in `SessionDetailView` attendees section | Foundational |
| `PrimaryButton` | "Rate Now" button | Foundational |
| `SecondaryButton` | "Try Again" in error states | Foundational |

### New Components Required

#### SessionHistoryRowView

**Purpose:** A single tappable card row representing one session in the history list.

**File:** `ios/FamilyMovieNight/Features/Sessions/SessionHistoryRowView.swift`

**Props:**
```swift
struct SessionHistoryRowView: View {
    let session: SessionSummary
}
```

**Visual Description:**

`HStack(alignment: .top, spacing: 12)` inside a card container (`CardBackground`, `cornerRadius(16)`, `padding(16)`):

Left — `AsyncImage` at 60x90pt, `cornerRadius(8)`, `contentMode: .fill`. Placeholder: `RoundedRectangle(cornerRadius: 8).fill(Color(.systemGray5))` with `Image(systemName: "film")` in `.secondary`. Poster shown when `session.pick != nil`, placeholder otherwise.

Right — `VStack(alignment: .leading, spacing: 6)`:
- Top row: `SessionStatusBadgeView(status: session.status)` + `Spacer()` + `Text(session.formattedDate)` in `.caption .secondary`
- Movie title: `Text(session.pick?.title ?? "No movie selected")` in `.body .semibold`, `.lineLimit(1)`. No pick: `.foregroundStyle(.secondary)`, italic modifier.
- Attendees: `Text(session.attendeeSummary)` in `.caption .secondary`
- Rating: `RatingSummaryView(summary: ratingsSummary, style: .compact)`. Hidden when `session.status` is `draft`, `voting`, or `expired`.

Full-width: `.frame(maxWidth: .infinity)`.

**Status to content mapping:**

| Status | Poster | Title style | Rating row |
|---|---|---|---|
| `draft` | Placeholder | Italic, secondary | Hidden |
| `voting` | Placeholder | Italic, secondary | Hidden |
| `selected` | Poster (if pick) | Semibold, primary | Hidden |
| `watched` | Poster | Semibold, primary | Compact, partial/none |
| `rated` | Poster | Semibold, primary | Compact, full or partial |
| `expired` / `discarded` | Placeholder | Italic, secondary | Hidden |

**Interaction:**
- Entire card is tappable via `.contentShape(Rectangle())`
- On press: scale to 0.97 with `.spring(response: 0.2, dampingFraction: 0.7)`
- Haptic: `UIImpactFeedbackGenerator(style: .light).impactOccurred()` on tap

**Accessibility:**
```swift
.accessibilityElement(children: .ignore)
.accessibilityLabel(/* "[Title or 'No movie selected']. [Status]. [Date]. Attended by [names]. [Rating summary or empty]." */)
.accessibilityHint("Double-tap to see full session details.")
.accessibilityAddTraits(.isButton)
```

---

#### SessionStatusBadgeView

**Purpose:** A compact pill badge communicating the session lifecycle state.

**File:** `ios/FamilyMovieNight/Features/Sessions/SessionStatusBadgeView.swift`

**Props:**
```swift
struct SessionStatusBadgeView: View {
    let status: SessionStatus
}
```

**Visual Description:**

`HStack(spacing: 4)`:
- `Circle().fill(status.foregroundToken)` at 6pt
- `Text(status.label)` in `.caption2 .medium`

Wrapped in a `Capsule` with `padding(.horizontal, 8).padding(.vertical, 4)` and `background(Capsule().fill(status.backgroundToken.opacity(colorScheme == .dark ? 0.16 : 0.12)))`. Text and dot at full opacity of `status.foregroundToken`.

**Status tokens:**

| Status value | `label` | `foregroundToken` | `backgroundToken` |
|---|---|---|---|
| `draft` | "Draft" | `.secondary` | `CardBackground` |
| `voting` | "Voting" | `PrimaryAccent` | `PrimaryAccent` |
| `selected` | "Selected" | `PrimaryAccent` | `PrimaryAccent` |
| `watched` | "Watched" | `WarningAccent` | `WarningAccent` |
| `rated` | "Rated" | `SuccessAccent` | `SuccessAccent` |
| `expired` | "Expired" | `.secondary` | `CardBackground` |
| `discarded` | "Expired" | `.secondary` | `CardBackground` |

**Accessibility:**
```swift
.accessibilityLabel("Status: \(status.label)")
```

---

#### SessionSuggestionRowView

**Purpose:** A single movie row in `SessionDetailView`'s vote breakdown section.

**File:** `ios/FamilyMovieNight/Features/Sessions/SessionSuggestionRowView.swift`

**Props:**
```swift
struct SessionSuggestionRowView: View {
    let suggestion: SessionSuggestionItem
    let isPicked:   Bool
}
```

**Visual Description:**

Card container: `CardBackground`, `cornerRadius(16)`, `padding(12)`. When `isPicked`, add a 3pt `PrimaryAccent` accent line on the leading edge via `overlay(alignment: .leading) { Rectangle().fill(Color("PrimaryAccent")).frame(width: 3) }`.

`HStack(alignment: .top, spacing: 10)`:

Left — poster: `AsyncImage` at 45x68pt, `cornerRadius(6)`. Placeholder: grey rectangle with film icon.

Center — `VStack(alignment: .leading, spacing: 4)`:
- Title: `Text(suggestion.title)` in `.body .semibold`, `.lineLimit(1)`
- If `isPicked`: `Label("Picked", systemImage: "crown.fill")` in `.caption .semibold`, `PrimaryAccent`
- Metadata: `Text("\(suggestion.year) · \(suggestion.contentRating ?? "")")` in `.caption .secondary`
- Voter chips: `HStack(spacing: -8)` of up to 5 `ProfileAvatarView(.xsmall)` (20pt) with vote-color rings (1.5pt `SuccessAccent` for up, `WarningAccent` for down). "+N" overflow text in `.caption2 .secondary`.

Right — vote tally `VStack(alignment: .trailing, spacing: 4)`:
- `Image(systemName: "hand.thumbsup.fill")` in `SuccessAccent` + `Text("\(suggestion.votesUp)")` in `.body .semibold`
- `Image(systemName: "hand.thumbsdown.fill")` in `WarningAccent` + `Text("\(suggestion.votesDown)")` in `.body .semibold`

**Accessibility:**
```swift
.accessibilityElement(children: .ignore)
.accessibilityLabel(/* "[Title], [year], [rating]. [N] thumbs up, [N] thumbs down. [Voter names]. [Picked / not picked]." */)
```

---

#### SessionHistoryViewModel

**Purpose:** Manages paginated session list data.

**File:** `ios/FamilyMovieNight/Features/Sessions/SessionHistoryViewModel.swift`

```swift
@MainActor
class SessionHistoryViewModel: ObservableObject {

    // MARK: - Published State
    @Published var sessions:      [SessionSummary] = []
    @Published var isLoading:     Bool = false
    @Published var isLoadingMore: Bool = false
    @Published var hasReachedEnd: Bool = false
    @Published var error:         String?

    // MARK: - Private
    private var nextCursor: String?
    private var groupId:    String = ""
    private var apiClient:  APIClient?
    private var groupMembers: [GroupMember] = []   // for attendee name resolution

    // MARK: - Configuration
    func configure(apiClient: APIClient, groupId: String, groupMembers: [GroupMember])

    // MARK: - API Operations
    func loadInitialPage() async
    func loadNextPage() async
    func refresh() async

    // MARK: - Pagination Trigger
    func loadNextPageIfNeeded(currentItem: SessionSummary)
}
```

---

#### SessionDetailViewModel

**Purpose:** Manages full session detail data.

**File:** `ios/FamilyMovieNight/Features/Sessions/SessionDetailViewModel.swift`

```swift
@MainActor
class SessionDetailViewModel: ObservableObject {

    // MARK: - Published State
    @Published var roundDetails:     SessionDetailData?
    @Published var ratingEntries:    [RatingEntry] = []
    @Published var isLoadingRound:   Bool = false
    @Published var isLoadingRatings: Bool = false
    @Published var error:            String?

    // MARK: - Configuration (set via configure())
    private(set) var roundId:          String = ""
    private(set) var groupId:          String = ""
    private(set) var activeMemberId:   String = ""
    private(set) var isCreator:        Bool = false
    private(set) var activeProfileName: String? = nil

    // MARK: - Derived
    var canRateNow: Bool {
        guard roundDetails?.status == .watched else { return false }
        return !ratingEntries.contains { $0.memberId == activeMemberId && $0.hasRated }
    }
    var ratingsSummary: RatingsSummary {
        RatingsSummary.from(entries: ratingEntries.map { $0.toResponse() })
    }
    var pickedSuggestion: SessionSuggestionItem? {
        roundDetails?.suggestions.first { $0.tmdbMovieId == roundDetails?.pickedMovieId }
    }

    // MARK: - Configuration
    func configure(roundId: String, groupId: String, activeMemberId: String,
                   isCreator: Bool, activeProfileName: String?, apiClient: APIClient)

    // MARK: - API Operations
    func loadAll() async       // parallel: GET /rounds/{id} + GET /rounds/{id}/ratings
    func loadRatings() async   // GET /rounds/{id}/ratings — called on sheet onDismiss
    func refresh() async
}
```

---

### Model Additions

**New file:** `ios/FamilyMovieNight/Models/Session.swift`

```swift
// MARK: - Session Status

enum SessionStatus: String, Codable, CaseIterable {
    case draft      = "draft"
    case voting     = "voting"
    case selected   = "selected"
    case watched    = "watched"
    case rated      = "rated"
    case expired    = "expired"
    case discarded  = "discarded"  // legacy value; displayed as "Expired" per US-45

    var label: String {
        switch self {
        case .draft:     return "Draft"
        case .voting:    return "Voting"
        case .selected:  return "Selected"
        case .watched:   return "Watched"
        case .rated:     return "Rated"
        case .expired:   return "Expired"
        case .discarded: return "Expired"
        }
    }
}

// MARK: - Session Summary (from GET /groups/{id}/sessions list)

struct SessionSummary: Decodable, Identifiable {
    let roundId:        String
    let status:         SessionStatus
    let createdAt:      String
    let attendees:      [SessionAttendee]
    let pick:           SessionPickSummary?
    let ratingsSummary: SessionRatingsSummary?

    var id: String { roundId }
    var formattedDate: String { /* parse ISO8601, format as "Feb 14" or "Feb 14, 2025" */ }
    var attendeeSummary: String { /* "Tim, Sarah, Max" or "Tim, Sarah + 2 more" */ }
}

struct SessionAttendee: Decodable, Identifiable {
    let memberId:    String
    let displayName: String
    let avatarKey:   String?
    var id: String { memberId }
}

struct SessionPickSummary: Decodable {
    let tmdbMovieId: Int
    let title:       String
    let posterPath:  String?

    var posterURL: URL? {
        guard let p = posterPath else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w185\(p)")
    }
}

struct SessionRatingsSummary: Decodable {
    let loved:      Int
    let liked:      Int
    let didNotLike: Int

    func toRatingsSummary(totalAttendees: Int) -> RatingsSummary {
        RatingsSummary(
            loved:          loved,
            liked:          liked,
            didNotLike:     didNotLike,
            totalRated:     loved + liked + didNotLike,
            totalAttendees: totalAttendees
        )
    }
}

struct SessionsListResponse: Decodable {
    let sessions:   [SessionSummary]
    let nextCursor: String?
}

// MARK: - Session Detail Data (from GET /rounds/{id})

struct SessionDetailData: Decodable {
    let roundId:       String
    let groupId:       String
    let status:        SessionStatus
    let startedBy:     String
    let attendees:     [SessionAttendee]
    let createdAt:     String
    let suggestions:   [SessionSuggestionItem]
    let pickedMovieId: Int?

    var formattedDate: String { /* parse ISO8601 */ }
}

struct SessionSuggestionItem: Decodable, Identifiable {
    let tmdbMovieId:   Int
    let title:         String
    let year:          Int
    let posterPath:    String?
    let contentRating: String?
    let votesUp:       Int
    let votesDown:     Int
    let voters:        [SuggestionVoter]

    var id: Int { tmdbMovieId }
    var netScore: Int { votesUp - votesDown }

    var posterURL: URL? {
        guard let p = posterPath else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w92\(p)")
    }
}

struct SuggestionVoter: Decodable, Identifiable {
    let memberId:    String
    let displayName: String
    let avatarKey:   String?
    let vote:        String   // "up" or "down"

    var id: String { memberId }
    var isUp: Bool { vote == "up" }
}
```

---

## State Definitions

### SessionHistoryView States

#### State 1: Loading (Initial)

**Trigger:** View appears for the first time; `loadInitialPage()` is in flight.

**What the user sees:**
- Navigation bar with "Watch History" title
- 4 skeleton `SessionHistoryRowView` placeholders: grey 60x90pt poster block + shimmer text bars for badge, title, attendees, and summary
- Card containers visible immediately at full size with shimmer fill
- Reduce Motion: static grey fills, no shimmer animation

**Available actions:** None (scroll view `allowsHitTesting(false)` during initial load).

**Transition out:** Crossfade (0.3s) to Populated or Empty.

---

#### State 2: Empty

**Trigger:** `loadInitialPage()` returns 0 sessions.

**What the user sees:**
```
(vertically and horizontally centered in content area)

Image(systemName: "film.stack")
48pt, .secondary

"No Movie Nights Yet"
.title2, .primary

"Start a voting round to pick your
 first movie as a household."
.body, .secondary, centered, 16pt horizontal padding
```

**Available actions:** Back navigation.

---

#### State 3: Populated

**Trigger:** `loadInitialPage()` returns 1+ sessions.

**What the user sees:** Full list of `SessionHistoryRowView` cards. Pull-to-refresh available.

**Available actions:** Tap any row, pull to refresh.

---

#### State 4: Loading More

**Trigger:** Scroll-triggered prefetch fires; `loadNextPage()` is in flight.

**What the user sees:** Existing rows unchanged. Footer: `ProgressView()` centered, 16pt vertical padding.

**Available actions:** Continue scrolling, tap any row.

**Transition out:** New rows append with `.transition(.opacity.combined(with: .move(edge: .bottom)))` via `withAnimation(.spring(response: 0.35, dampingFraction: 0.75))`.

---

#### State 5: End of List

**Trigger:** `next_cursor == nil` returned from server.

**What the user sees:** Footer: `Text("That's all your movie nights")` in `.caption .tertiary`, centered, 24pt top / 40pt bottom padding.

**Available actions:** Scroll up, tap rows, pull to refresh.

---

#### State 6: Error

**Trigger:** `loadInitialPage()` or `refresh()` fails.

**What the user sees:**
```
(vertically centered)

Image(systemName: "exclamationmark.circle")
48pt, .secondary

"Couldn't Load History"
.title2, .primary

[context-specific message]
.body, .secondary, centered

[ Try Again ]   SecondaryButton
```

Error messages:
- Network failure: "Check your connection and try again."
- 403: "You don't have access to this household's history."
- 404: "This household wasn't found."
- 500: "Something went wrong on our end. Try again in a moment."

**Haptic:** `UINotificationFeedbackGenerator().notificationOccurred(.error)`

---

#### State 7: Load More Error

**Trigger:** `loadNextPage()` fails.

**What the user sees:** Footer: `Text("Couldn't load more")` in `.caption .secondary` + `Button("Retry")` in `.caption PrimaryAccent`.

**Available actions:** Retry, interact with existing rows.

---

### SessionDetailView States

#### State 1: Loading

**Trigger:** `loadAll()` is in flight on view appear.

**What the user sees:** Skeleton layout: MovieHeaderCard skeleton, status row skeleton, 3 attendee chip skeletons, 3 suggestion card skeletons, 3 rating member row skeletons. All shimmer at 1.2s.

**Available actions:** Back navigation.

---

#### State 2: Populated — No Pending Rate

**Trigger:** `loadAll()` succeeds; `canRateNow == false`.

**What the user sees:** Full layout per screen spec. No "Rate Now" button.

**Available actions:** Pull to refresh, back navigation.

---

#### State 3: Populated — Rate Now Available

**Trigger:** `loadAll()` succeeds; `canRateNow == true`.

**What the user sees:** Full layout with `PrimaryButton("Rate Now")` at the bottom, above safe area. Active member's `RatingMemberRowView` shows "Not yet".

**Available actions:** "Rate Now" (presents `RatingView` sheet), pull to refresh, back navigation.

**Haptic on "Rate Now" tap:** `UIImpactFeedbackGenerator(style: .medium).impactOccurred()`

---

#### State 4: After Rating Submission

**Trigger:** `RatingView` sheet dismissed; `viewModel.loadRatings()` resolves.

**What the user sees:**
- Active member's row now shows their submitted rating
- `RatingSummaryView` updated
- "Rate Now" button crossfades away (`canRateNow` is now `false`)
- If all attendees rated: status badge transitions to "Rated" (0.3s crossfade)

**Haptic:** `UINotificationFeedbackGenerator().notificationOccurred(.success)` when ratings section updates

---

#### State 5: Error (Full Load)

**Trigger:** `loadAll()` fails.

**What the user sees:** Same error layout as `SessionHistoryView` State 6 but with "Couldn't Load Session" headline. `SecondaryButton("Try Again")` calls `viewModel.loadAll()`.

**Haptic:** `UINotificationFeedbackGenerator().notificationOccurred(.error)`

---

#### State 6: Partial Load Error (Ratings Failed)

**Trigger:** Round loaded successfully; ratings request failed.

**What the user sees:** Round data rendered normally. Ratings section shows inline error: `Image(systemName: "exclamationmark.circle")` in `.caption` + "Couldn't load ratings" in `.caption .secondary` + `Button("Retry")` in `.caption PrimaryAccent`. "Rate Now" button hidden until ratings load.

**Available actions:** Retry ratings, pull to refresh, back navigation.

---

## Interaction Details

### Haptics

| Trigger | Generator | Style |
|---|---|---|
| Tap `SessionHistoryRowView` | `UIImpactFeedbackGenerator` | `.light` |
| "Rate Now" button tap | `UIImpactFeedbackGenerator` | `.medium` |
| "Try Again" / "Retry" tap | `UIImpactFeedbackGenerator` | `.light` |
| Error state entered | `UINotificationFeedbackGenerator` | `.error` |
| Ratings section updates after sheet dismissal | `UINotificationFeedbackGenerator` | `.success` |

All generators initialized lazily. Fire only on `UIDevice.current.userInterfaceIdiom == .phone`.

---

### Animations

#### Row Press Feedback

```swift
// In SessionHistoryRowView via ButtonStyle:
.scaleEffect(configuration.isPressed ? 0.97 : 1.0)
.animation(.spring(response: 0.2, dampingFraction: 0.7), value: configuration.isPressed)
```

#### Pagination Row Insertion

```swift
withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
    sessions.append(contentsOf: newSessions)
}
// Each new row:
.transition(.opacity.combined(with: .move(edge: .bottom)))
```

#### Rate Now Button Show / Hide

```swift
.animation(.easeInOut(duration: 0.2), value: viewModel.canRateNow)
.transition(.opacity.combined(with: .move(edge: .bottom)))
```

#### Status Badge Transition (watched -> rated)

```swift
.animation(.easeInOut(duration: 0.3), value: roundDetails?.status)
// Text and color inside badge crossfade via .transition(.opacity)
```

#### Loading Skeleton Shimmer

- Base fill: `Color(.systemGray5)`
- Overlay: `LinearGradient` from `Color(.systemGray4).opacity(0)` → `Color(.systemGray4)` → `Color(.systemGray4).opacity(0)`, offset animated leading to trailing
- Duration: 1.2s `.linear(duration: 1.2).repeatForever(autoreverses: false)`
- Reduce Motion: static grey, no animation

---

## Accessibility

### Dynamic Type

- All text uses semantic font styles — no hardcoded pt sizes
- `SessionHistoryRowView` poster stays fixed at 60x90pt (image, not text)
- At `dynamicTypeSize >= .xxLarge`, movie title in row switches `.lineLimit(1)` to `.lineLimit(2)`:
  ```swift
  @Environment(\.dynamicTypeSize) var typeSize
  .lineLimit(typeSize >= .xxLarge ? 2 : 1)
  ```
- `SessionStatusBadgeView` `.caption2` text: capsule grows with text, never fix height
- `SessionSuggestionRowView` title: `.lineLimit(2)`, poster stays fixed
- `RatingSummaryView(.compact)` in rows: use `ViewThatFits` to switch to `VStack` layout when horizontal overflows (same pattern established in `rating-selector-view.md`)
- `SessionDetailView` attendees `MemberChip` row: switch to `LazyVGrid(columns: [GridItem(.adaptive(minimum: 80))])` at `dynamicTypeSize >= .xxLarge`

### VoiceOver Labels

| Element | Label | Traits |
|---|---|---|
| `SessionHistoryRowView` | `"[Title or 'No movie selected']. [Status]. [Date]. Attended by [names]. [Rating summary or omitted]."` | `.isButton` |
| `SessionStatusBadgeView` | `"Status: [label]"` | `.isStaticText` |
| `SessionSuggestionRowView` (standard) | `"[Title], [year], [rating]. [N] thumbs up, [N] thumbs down."` | `.isStaticText` |
| `SessionSuggestionRowView` (picked) | `"[Title], [year], [rating]. [N] thumbs up, [N] thumbs down. Picked for this session."` | `.isStaticText` |
| "Rate Now" button | `"Rate Now. Double-tap to rate this movie."` | `.isButton` |
| "Watch History" heading | `"Watch History"` | `.isHeader` |
| Empty state | `"No Movie Nights Yet. Start a voting round to pick your first movie as a household."` | `.isStaticText` |
| Loading state | `"Loading sessions"` (single combined element, children hidden) | `.isStaticText` |
| "Try Again" / "Retry" | `"Try Again. Double-tap to reload."` | `.isButton` |
| End-of-list footer | `"That's all your movie nights"` | `.isStaticText` |
| Voter chips | Grouped: `"Voted up: [names]. Voted down: [names]."` | `.isStaticText` |

**Profile context announcement** when `SessionDetailView` appears and `activeProfileName != nil`:
```swift
.onAppear {
    if let name = viewModel.activeProfileName {
        AccessibilityNotification.Announcement("Viewing session as \(name)").post()
    }
}
```

### VoiceOver Focus Order (`SessionDetailView`)

1. Movie header card
2. Status badge then date then "Started by" text
3. "Attendees" section label then each member chip
4. "Vote Breakdown" section label then each suggestion row (sorted by position in round)
5. "Ratings" section label then `RatingSummaryView` then each member row
6. "Rate Now" button (when present) — last, following ratings for context

### Contrast

- `SessionStatusBadgeView` text at 12% tint background: text at full-opacity token. Verify 4.5:1 ratio for each status color against `CardBackground` (both light/dark) during token definition.
- Vote tally text (`.body .semibold .primary`) against `CardBackground`: inherits system contrast, always meets AA.
- Voter ring overlays (decorative): rings are decorative supplementary info. Count text carries semantic information at full contrast.
- `WarningAccent` vote-down icon in `SessionSuggestionRowView`: icon is decorative; count text next to it provides the same information at full contrast.

---

## Visual Specifications

### Spacing

#### SessionHistoryView

| Element | Value |
|---|---|
| Outer horizontal padding | 16pt |
| Top padding below nav bar | 20pt |
| Gap between `SessionHistoryRowView` cards | 12pt |
| Card internal padding | 16pt all sides |
| Poster width | 60pt |
| Poster height | 90pt |
| Poster corner radius | 8pt |
| Gap: poster -> content column | 12pt |
| Gap: status badge row -> movie title | 6pt |
| Gap: movie title -> attendees line | 4pt |
| Gap: attendees line -> rating summary | 4pt |
| End-of-list footer top padding | 24pt |
| End-of-list footer bottom padding | 40pt |

#### SessionDetailView

| Element | Value |
|---|---|
| Outer horizontal padding | 16pt |
| Top padding below nav bar | 16pt |
| `MovieHeaderCard` internal padding | 16pt (per rating spec) |
| Gap: `MovieHeaderCard` -> status row | 20pt |
| Gap: status row -> Attendees section | 20pt |
| Attendees `MemberChip` spacing | 8pt |
| Gap: Attendees -> Vote Breakdown header | 20pt |
| Section header -> first content row | 12pt |
| Gap between `SessionSuggestionRowView` cards | 8pt |
| `SessionSuggestionRowView` internal padding | 12pt |
| Thumbnail (suggestions) width | 45pt |
| Thumbnail (suggestions) height | 68pt |
| Thumbnail corner radius | 6pt |
| Gap: Vote Breakdown -> Ratings header | 20pt |
| Gap: `RatingSummaryView` -> first `RatingMemberRowView` | 16pt |
| `RatingMemberRowView` minimum height | 44pt |
| Gap: last `RatingMemberRowView` -> "Rate Now" button | 24pt |
| "Rate Now" bottom padding (to safe area) | 16pt (via `.safeAreaInset(edge: .bottom)`) |

#### SessionStatusBadgeView

| Element | Value |
|---|---|
| Dot diameter | 6pt |
| Capsule horizontal padding | 8pt |
| Capsule vertical padding | 4pt |
| Dot to label gap | 4pt |
| Minimum badge height | 22pt |

### Typography

| Element | Style | Weight | Color |
|---|---|---|---|
| "Watch History" nav title | `.largeTitle` | System | System |
| Empty / error headline | `.title2` | `.regular` | `.primary` |
| Empty / error body | `.body` | `.regular` | `.secondary` |
| Movie title in `SessionHistoryRowView` | `.body` | `.semibold` | `.primary` (or `.secondary` italic when no pick) |
| Date in `SessionHistoryRowView` | `.caption` | `.regular` | `.secondary` |
| Attendees line in `SessionHistoryRowView` | `.caption` | `.regular` | `.secondary` |
| `SessionStatusBadgeView` label | `.caption2` | `.medium` | status foreground token |
| Section headers in `SessionDetailView` | `.title2` | `.regular` | `.primary` |
| Status detail row (date, started by) | `.caption` | `.regular` | `.secondary` |
| Movie title in `SessionSuggestionRowView` | `.body` | `.semibold` | `.primary` |
| Metadata in `SessionSuggestionRowView` | `.caption` | `.regular` | `.secondary` |
| "Picked" label in `SessionSuggestionRowView` | `.caption` | `.semibold` | `PrimaryAccent` |
| Vote count numbers | `.body` | `.semibold` | `.primary` |
| "That's all your movie nights" footer | `.caption` | `.regular` | `.tertiary` |
| "Couldn't load more" text | `.caption` | `.regular` | `.secondary` |
| "Retry" link | `.caption` | `.regular` | `PrimaryAccent` |

### Colors

| Element | Token / Value | Notes |
|---|---|---|
| Screen backgrounds | `AppBackground` | Both screens |
| Card backgrounds | `CardBackground` | All cards |
| Poster placeholder | `Color(.systemGray5)` | |
| Placeholder icon | `.secondary` | |
| Status badge `voting`/`selected` tint | `PrimaryAccent` at 12% (16% dark) | |
| Status badge `voting`/`selected` text + dot | `PrimaryAccent` | |
| Status badge `watched` tint | `WarningAccent` at 12% (16% dark) | |
| Status badge `watched` text + dot | `WarningAccent` | |
| Status badge `rated` tint | `SuccessAccent` at 12% (16% dark) | |
| Status badge `rated` text + dot | `SuccessAccent` | |
| Status badge `draft`/`expired` tint | `CardBackground` | Flat — no color |
| Status badge `draft`/`expired` text + dot | `.secondary` | |
| `SessionSuggestionRowView` picked accent bar | `PrimaryAccent` | 3pt leading edge |
| Crown / "Picked" label | `PrimaryAccent` | |
| Up vote icon | `SuccessAccent` | |
| Down vote icon | `WarningAccent` | |
| Up voter avatar ring | `SuccessAccent` | 1.5pt stroke |
| Down voter avatar ring | `WarningAccent` | 1.5pt stroke |
| "Rate Now" button | via `PrimaryButton` style | Uses `PrimaryAccent` |
| Shimmer base | `Color(.systemGray5)` | |
| Shimmer highlight | `Color(.systemGray4)` gradient | |

**Dark mode:** All semantic tokens resolve automatically. Increase badge tint opacity to 16% in dark mode using `@Environment(\.colorScheme)` check.

---

## Preview Variants

### SessionHistoryView

| # | Variant | Notes |
|---|---|---|
| 1 | Light mode, populated — rated, watched, selected, expired rows | All badge types visible |
| 2 | Dark mode, populated | Token resolution |
| 3 | Light mode, empty state | |
| 4 | Light mode, loading skeleton | |
| 5 | Light mode, error state | |
| 6 | XXXL Dynamic Type, populated | Text wrapping, row height growth |

### SessionHistoryRowView

| # | Variant | Notes |
|---|---|---|
| 1 | Light mode, `rated`, poster + title + full ratings | Richest state |
| 2 | Dark mode, `rated` | |
| 3 | Light mode, `watched`, partial ratings ("2 of 3 rated") | |
| 4 | Light mode, `voting`, no poster, no ratings | |
| 5 | Light mode, `expired`, placeholder | |
| 6 | Light mode, `selected`, poster + title, no ratings | |
| 7 | XXXL Dynamic Type | Title wraps to 2 lines |

### SessionDetailView

| # | Variant | Notes |
|---|---|---|
| 1 | Light mode, `rated` session, all attendees rated | Full happy path |
| 2 | Dark mode, `rated` session | |
| 3 | Light mode, `watched` + "Rate Now" button | CTA visible |
| 4 | Light mode, `voting` session, no pick, no ratings | Sparse sections |
| 5 | Light mode, `expired` session | |
| 6 | Light mode, loading skeleton | |
| 7 | Light mode, error (full load failure) | |
| 8 | XXXL Dynamic Type, `rated` session | All sections at large type |

### SessionStatusBadgeView

| # | Variant | Notes |
|---|---|---|
| 1 | All 6 status values, light mode | |
| 2 | All 6 status values, dark mode | |
| 3 | XXXL Dynamic Type |
