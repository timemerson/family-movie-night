# DynamoDB Data Model

## Design Approach

This schema uses a **multi-table design** — one DynamoDB table per entity. This is intentionally chosen over single-table design for **learnability**: each table has a clear purpose, the key schema is self-documenting, and access patterns are easy to trace. The trade-off is more tables to manage and slightly higher operational overhead, but at v1 scale this is negligible.

All tables use **on-demand** (pay-per-request) capacity mode. At v1 traffic levels, all usage falls within DynamoDB's always-free tier (25 GB storage, 25 WCU, 25 RCU).

---

## Tables

### 1. Users

Stores user profiles. Source of truth for application-level user data (Cognito handles auth identity).

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `user_id` | S | **PK** | Cognito `sub` (UUID) |
| `email` | S | | |
| `display_name` | S | | Max 30 chars |
| `avatar_key` | S | | Predefined avatar reference |
| `parent_user_id` | S | | Set for child profiles; null for regular users |
| `is_child_profile` | BOOL | | |
| `created_at` | S | | ISO 8601 |
| `last_active_at` | S | | ISO 8601 |
| `notification_prefs` | M | | `{ vote_nudge, pick_announce, new_round }` |
| `device_token` | S | | APNs push token; updated on app launch |

**GSI: `email-index`**
- PK: `email`
- Use: Look up user by email (account dedup, display in invites).

**GSI: `parent-index`**
- PK: `parent_user_id`
- Use: List child profiles for a parent (US-25).

---

### 2. Groups

Stores group metadata.

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `group_id` | S | **PK** | UUID |
| `name` | S | | Max 40 chars |
| `created_by` | S | | `user_id` of creator |
| `streaming_services` | L | | List of strings: `["netflix", "disney_plus"]` |
| `created_at` | S | | ISO 8601 |

No GSIs needed — groups are always accessed by `group_id`.

---

### 3. GroupMemberships

Join table between Users and Groups. Supports "get all members of a group" and "get the group for a user."

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `group_id` | S | **PK** | |
| `user_id` | S | **SK** | |
| `role` | S | | `creator` or `member` |
| `joined_at` | S | | ISO 8601 |
| `is_child_profile` | BOOL | | Denormalized from Users for display |

**GSI: `user-groups-index`**
- PK: `user_id`
- Use: Find which group a user belongs to. (In v1, at most one result.)

---

### 4. Preferences

Per-user, per-group preference settings.

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `group_id` | S | **PK** | |
| `user_id` | S | **SK** | |
| `genre_likes` | L | | List of TMDB genre ID strings |
| `genre_dislikes` | L | | List of TMDB genre ID strings |
| `max_content_rating` | S | | `G`, `PG`, `PG-13`, or `R` |
| `updated_at` | S | | ISO 8601 |

**Access patterns:**
- **Get one user's prefs:** `PK=group_id, SK=user_id`
- **Get all prefs for a group:** `PK=group_id` (Query, no SK condition)

No GSIs needed.

---

### 5. Invites

Group invite links with expiry and status tracking.

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `invite_id` | S | **PK** | UUID |
| `group_id` | S | | |
| `created_by` | S | | `user_id` |
| `invite_token` | S | | Unique token in the invite URL |
| `status` | S | | `pending`, `accepted`, `revoked`, `expired` |
| `created_at` | S | | ISO 8601 |
| `expires_at` | S | | ISO 8601 |
| `ttl` | N | | Unix timestamp for DynamoDB TTL auto-deletion |

**GSI: `token-index`**
- PK: `invite_token`
- Use: Look up invite by token when a user clicks the invite link.

**GSI: `group-invites-index`**
- PK: `group_id`
- SK: `created_at`
- Use: List pending invites for a group (US-07).

**TTL:** `ttl` attribute set to `expires_at` + 24 hours. DynamoDB auto-deletes expired invites. The 24-hour buffer allows the app to show "expired" status before deletion.

---

### 6. Rounds

Suggestion/voting rounds.

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `round_id` | S | **PK** | UUID |
| `group_id` | S | | |
| `started_by` | S | | `user_id` |
| `status` | S | | `voting`, `closed`, `picked`, `discarded` |
| `created_at` | S | | ISO 8601 |
| `closed_at` | S | | ISO 8601 (nullable) |
| `relaxed_constraints` | L | | List of strings describing relaxed filters |

**GSI: `group-rounds-index`**
- PK: `group_id`
- SK: `created_at`
- Use: List rounds for a group (history). Also used to check for active rounds (`status = voting`).

---

### 7. Suggestions

Movies included in a round's shortlist.

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `round_id` | S | **PK** | |
| `tmdb_movie_id` | N | **SK** | |
| `position` | N | | Display order (1-8) |
| `title` | S | | Denormalized for fast display |
| `poster_path` | S | | Denormalized from TMDB |
| `year` | N | | Denormalized |
| `genres` | L | | Denormalized genre names |
| `content_rating` | S | | Denormalized |

**Access patterns:**
- **Get all suggestions for a round:** `PK=round_id` (Query)

No GSIs needed.

---

### 8. Votes

Individual member votes on suggestions.

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `round_id` | S | **PK** | |
| `vote_key` | S | **SK** | `{tmdb_movie_id}#{user_id}` — composite sort key |
| `tmdb_movie_id` | N | | For filtering/projection |
| `user_id` | S | | |
| `vote` | S | | `up` or `down` |
| `voted_at` | S | | ISO 8601 |

**Access patterns:**
- **Get all votes for a round:** `PK=round_id` (Query)
- **Get/overwrite a specific vote:** `PK=round_id, SK={movie}#{user}` (PutItem — idempotent upsert)

The composite SK ensures one vote per user per movie per round. Re-voting is a simple `PutItem` overwrite.

No GSIs needed.

---

### 9. Picks

The final movie choice for a round.

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `pick_id` | S | **PK** | UUID |
| `round_id` | S | | |
| `group_id` | S | | Denormalized for group history queries |
| `tmdb_movie_id` | N | | |
| `title` | S | | Denormalized |
| `poster_path` | S | | Denormalized |
| `picked_by` | S | | `user_id` of the group creator who confirmed |
| `picked_at` | S | | ISO 8601 |
| `watched` | BOOL | | Default: false |
| `watched_at` | S | | ISO 8601 (nullable) |

**GSI: `group-picks-index`**
- PK: `group_id`
- SK: `picked_at`
- Use: Watch history for a group (US-20), ordered by date.

**GSI: `round-pick-index`**
- PK: `round_id`
- Use: Check if a round already has a pick (for conditional write / 409 detection).

---

### 10. Ratings

Post-watch ratings by individual members.

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `pick_id` | S | **PK** | |
| `user_id` | S | **SK** | |
| `stars` | N | | 1–5 |
| `rated_at` | S | | ISO 8601 |

**Access patterns:**
- **Get all ratings for a pick:** `PK=pick_id` (Query)
- **Get/overwrite a user's rating:** `PK=pick_id, SK=user_id` (PutItem)

No GSIs needed.

---

### 11. TmdbCache

Caches TMDB API responses to reduce external API calls and improve latency.

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `cache_key` | S | **PK** | Hash of the request (endpoint + params) |
| `response_data` | S | | JSON string of the TMDB response |
| `cached_at` | S | | ISO 8601 |
| `ttl` | N | | Unix timestamp for DynamoDB TTL |

**TTL values:**
- Movie metadata: 24 hours
- Watch providers (streaming availability): 12 hours
- Discover API results: 24 hours

No GSIs needed.

---

## Access Pattern Matrix

| Access Pattern | Table | Key Condition | Index |
|---|---|---|---|
| Get user by ID | Users | PK = user_id | — |
| Get user by email | Users | PK = email | email-index |
| Get child profiles for parent | Users | PK = parent_user_id | parent-index |
| Get group by ID | Groups | PK = group_id | — |
| Get members of a group | GroupMemberships | PK = group_id | — |
| Get group for a user | GroupMemberships | PK = user_id | user-groups-index |
| Get user prefs in a group | Preferences | PK = group_id, SK = user_id | — |
| Get all prefs for a group | Preferences | PK = group_id | — |
| Get invite by token | Invites | PK = invite_token | token-index |
| List invites for a group | Invites | PK = group_id | group-invites-index |
| Get round by ID | Rounds | PK = round_id | — |
| List rounds for a group | Rounds | PK = group_id | group-rounds-index |
| Get suggestions for a round | Suggestions | PK = round_id | — |
| Get all votes for a round | Votes | PK = round_id | — |
| Get/set one vote | Votes | PK = round_id, SK = movie#user | — |
| Get pick by ID | Picks | PK = pick_id | — |
| Check pick exists for round | Picks | PK = round_id | round-pick-index |
| Watch history for a group | Picks | PK = group_id | group-picks-index |
| Get ratings for a pick | Ratings | PK = pick_id | — |
| Get/set one rating | Ratings | PK = pick_id, SK = user_id | — |
| Cache lookup | TmdbCache | PK = cache_key | — |

**Total: 11 tables, 8 GSIs, 2 TTL-enabled tables.**

---

## Entity Relationship Summary

```
Users ──1:N──▶ GroupMemberships ◀──N:1── Groups
Users ──1:N──▶ Preferences ◀──N:1── Groups
Users ──1:N──▶ Votes
Users ──1:N──▶ Ratings
Users ──1:N──▶ Users (parent → child profiles)

Groups ──1:N──▶ Invites
Groups ──1:N──▶ Rounds ──1:N──▶ Suggestions
                Rounds ──1:N──▶ Votes
                Rounds ──1:1──▶ Picks ──1:N──▶ Ratings
```
