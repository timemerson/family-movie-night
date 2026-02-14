# Sync & Offline Strategy

## Overview

Family Movie Night is **online-only for v1** (per OQ-10). The app requires an active internet connection to fetch suggestions, submit votes, and sync group state. This document defines caching, conflict handling, and the offline UX.

## Why Online-Only?

| Factor | Decision |
|---|---|
| Core feature dependency | Suggestions require TMDB API calls and fresh group preference data |
| Group size | 2–8 users; real-time consistency matters more than offline availability |
| Complexity budget | Offline-first (Core Data + sync) would double the iOS implementation effort |
| Usage pattern | Movie night is a planned event — users are at home with Wi-Fi |

## Caching Strategy

The iOS app uses **in-memory caching only** — no Core Data, no SQLite, no on-disk persistence beyond Keychain (for auth tokens) and UserDefaults (for non-sensitive app settings).

### What Is Cached

| Data | Cache Location | Lifetime | Purpose |
|---|---|---|---|
| Auth tokens | iOS Keychain | Until expiry (access: 1h, refresh: 30d) | Persistent auth across app launches |
| Current user profile | In-memory | Until app backgrounded or API refresh | Avoid re-fetching on every screen |
| Group details + members | In-memory | Until app backgrounded or manual refresh | Display group home without a network call on back-navigation |
| Current suggestion round | In-memory | Until round closes or app backgrounded | Display voting screen without re-fetch |
| Movie metadata (detail view) | In-memory + URL cache | Standard HTTP cache (images via URLCache) | Avoid re-fetching movie details during a session |
| TMDB poster images | URLCache (HTTP) | Standard HTTP cache headers | iOS image loading pipeline handles this |

### What Is NOT Cached

- Voting results (always fetched fresh to ensure consistency)
- Other members' preferences (only needed server-side for suggestions)
- Push notification state
- Historical rounds and picks (fetched on demand)

## Conflict Handling

With an online-only app and small group sizes, conflicts are rare. The two operations that could conflict are handled as follows:

### Votes: Last-Write-Wins (Per User)

- Each user can vote once per movie per round (US-14).
- If a user changes their vote, the new vote **overwrites** the previous one.
- DynamoDB uses `PutItem` with the composite key `(round_id, tmdb_movie_id, user_id)` — this is an idempotent upsert.
- There is no real conflict: two different users voting on the same movie are writing to different items (different `user_id`). The same user voting twice just overwrites their own vote.

### Picks: Conditional Write (Exactly-Once)

- Only the group creator can pick a movie (US-16).
- The pick operation uses a **DynamoDB conditional write**:
  ```
  PutItem on Picks table
  ConditionExpression: attribute_not_exists(round_id)
  ```
- This ensures that if two requests race (e.g., double-tap), only the first succeeds. The second gets a `ConditionalCheckFailedException`, and the Lambda returns `409 Conflict`.
- The iOS app handles 409 by refreshing the round state (the pick already happened).

### Round Creation: One Active Round Per Group

- Only one voting round can be active per group at a time (Flow 6 assumption).
- Creating a new round checks for an active round:
  ```
  Query Rounds table GSI: group_id = X AND status = "voting"
  ```
- If an active round exists, the API returns `409 Conflict` with the active round ID. The iOS app can prompt the user to close the existing round first.

## Offline UX

When the device has no internet connection:

1. **Detection:** The iOS app uses `NWPathMonitor` to detect connectivity changes.
2. **Banner:** A non-dismissable banner appears: "No internet connection. Connect to Wi-Fi or cellular to use Family Movie Night."
3. **Graceful degradation:**
   - Cached screens (group home, current round) remain visible but read-only.
   - Action buttons (Vote, Pick, Suggest) are disabled with a tooltip: "Requires internet."
   - Movie detail screens that are already in memory remain viewable (poster images may show placeholders if not in URLCache).
4. **Recovery:** When connectivity returns, the banner dismisses and the app refreshes the current screen automatically.

## Future Considerations (v2+)

- **Core Data cache:** If the app grows to support watch history browsing, offline viewing of past picks, or multi-device sync, introduce Core Data as a local cache with server-as-source-of-truth reconciliation.
- **Optimistic updates:** For actions like voting, show the vote immediately in the UI and sync in the background. Roll back if the server rejects it. Not worth the complexity for v1.
- **Background refresh:** Use `BGAppRefreshTask` to pre-fetch group state so the app feels instant on launch. Low priority for v1.
