# DynamoDB Data Model

## Design Approach

This schema uses a **multi-table design** — one DynamoDB table per entity. This is intentionally chosen over single-table design for **learnability**: each table has a clear purpose, the key schema is self-documenting, and access patterns are easy to trace. The trade-off is more tables to manage and slightly higher operational overhead, but at v1 scale this is negligible.

All tables use **on-demand** (pay-per-request) capacity mode. At v1 traffic levels, all usage falls within DynamoDB's always-free tier (25 GB storage, 25 WCU, 25 RCU).

---

## Tables

### 1. Users

Stores user profiles. Source of truth for application-level user data. Includes both Independent members (backed by Cognito) and Managed members (no Cognito account).

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `user_id` | S | **PK** | Cognito `sub` (UUID) for independent members; `managed_<uuid>` for managed members |
| `email` | S | | Null for managed members |
| `display_name` | S | | Max 30 chars |
| `avatar_key` | S | | Predefined avatar reference |
| `is_managed` | BOOL | | `true` for managed members, `false` for independent |
| `parent_user_id` | S | | Set for managed members; the Cognito `user_id` of the controlling user |
| `content_rating_ceiling` | S | | Max content rating for this member. Managed members default to `PG`. |
| `created_at` | S | | ISO 8601 |
| `last_active_at` | S | | ISO 8601 |
| `notification_prefs` | M | | `{ vote_nudge, pick_announce, new_round }` — null for managed members |
| `device_token` | S | | APNs push token; null for managed members |

**GSI: `email-index`**
- PK: `email`
- Use: Look up user by email (account dedup, display in invites).

**GSI: `parent-index`**
- PK: `parent_user_id`
- Use: List managed members for a parent user.

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
| `user_id` | S | **SK** | `user_id` for independent; `managed_<uuid>` for managed members |
| `role` | S | | `creator` or `member` |
| `member_type` | S | | `independent` or `managed` |
| `joined_at` | S | | ISO 8601 |

**GSI: `user-groups-index`**
- PK: `user_id`
- Use: Find which group a user belongs to. (In v1, at most one result.)

---

### 4. Preferences

Per-member, per-group preference settings. The SK is the member's `user_id` — for managed members this is their `managed_<uuid>` ID.

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `group_id` | S | **PK** | |
| `user_id` | S | **SK** | `user_id` or `managed_<uuid>` (the member's ID) |
| `genre_likes` | L | | List of TMDB genre ID strings |
| `genre_dislikes` | L | | List of TMDB genre ID strings |
| `max_content_rating` | S | | `G`, `PG`, `PG-13`, or `R` |
| `updated_at` | S | | ISO 8601 |

**Access patterns:**
- **Get one member's prefs:** `PK=group_id, SK=member_id`
- **Get all prefs for a group:** `PK=group_id` (Query, no SK condition)
- **Get prefs for attendees only:** `PK=group_id`, then filter client-side by attendee list

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

### 6. Rounds (Sessions)

Movie night sessions with full lifecycle. Any household member can create a session.

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `round_id` | S | **PK** | UUID |
| `group_id` | S | | |
| `started_by` | S | | `member_id` (acting member who created the session) |
| `status` | S | | `draft`, `voting`, `selected`, `watched`, `rated`, `expired` |
| `attendees` | L | | List of `member_id` strings. Null = all members (backward compat). |
| `created_at` | S | | ISO 8601 |
| `voting_started_at` | S | | ISO 8601 (nullable; set when draft → voting) |
| `selected_at` | S | | ISO 8601 (nullable; set when pick locked in) |
| `watched_at` | S | | ISO 8601 (nullable; set when marked watched) |
| `rated_at` | S | | ISO 8601 (nullable; set when all attendees rated) |
| `relaxed_constraints` | L | | List of strings describing relaxed filters |

**Status lifecycle:**
```
draft → voting → selected → watched → rated
                                    ↘ expired (post-v1 automation)
```
Legacy status values are mapped at read-time: `picked` → `selected`, `closed` → `voting` (round was closed but not yet picked), `discarded` → `expired`.

**GSI: `group-rounds-index`**
- PK: `group_id`
- SK: `created_at`
- Use: List rounds for a group (session history). Also used to check for active rounds (`status = voting`).

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

Individual member votes on suggestions. The vote is attributed to the acting member (the authenticated user's own ID, or a managed member's ID if acting on their behalf).

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `round_id` | S | **PK** | |
| `vote_key` | S | **SK** | `{tmdb_movie_id}#{member_id}` — composite sort key |
| `tmdb_movie_id` | N | | For filtering/projection |
| `member_id` | S | | Acting member (`user_id` or `managed_<uuid>`) |
| `vote` | S | | `up` or `down` |
| `voted_at` | S | | ISO 8601 |

**Access patterns:**
- **Get all votes for a round:** `PK=round_id` (Query)
- **Get/overwrite a specific vote:** `PK=round_id, SK={movie}#{member}` (PutItem — idempotent upsert)
- **Vote progress:** Query `PK=round_id`, count distinct `member_id` values, compare against `round.attendees.length`

The composite SK ensures one vote per member per movie per round. Re-voting is a simple `PutItem` overwrite.

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
| `picked_by` | S | | `member_id` of the member who confirmed the pick |
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

Post-watch ratings by individual attending members. Uses a 3-point scale: Loved / Liked / Did Not Like.

| Attribute | Type | Key | Notes |
|---|---|---|---|
| `round_id` | S | **PK** | The session this rating belongs to |
| `member_id` | S | **SK** | Acting member (`user_id` or `managed_<uuid>`) |
| `rating` | S | | `loved`, `liked`, or `did_not_like` |
| `rated_at` | S | | ISO 8601 |

**Access patterns:**
- **Get all ratings for a session:** `PK=round_id` (Query)
- **Get/set one rating:** `PK=round_id, SK=member_id` (PutItem — upsert)

When all attending members have submitted a rating, the round auto-transitions to `rated` status.

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
| Get managed members for parent | Users | PK = parent_user_id | parent-index |
| Get group by ID | Groups | PK = group_id | — |
| Get members of a group | GroupMemberships | PK = group_id | — |
| Get group for a user | GroupMemberships | PK = user_id | user-groups-index |
| Get member prefs in a group | Preferences | PK = group_id, SK = member_id | — |
| Get all prefs for a group | Preferences | PK = group_id | — |
| Get invite by token | Invites | PK = invite_token | token-index |
| List invites for a group | Invites | PK = group_id | group-invites-index |
| Get round/session by ID | Rounds | PK = round_id | — |
| List sessions for a group | Rounds | PK = group_id | group-rounds-index |
| Get suggestions for a round | Suggestions | PK = round_id | — |
| Get all votes for a round | Votes | PK = round_id | — |
| Get/set one vote | Votes | PK = round_id, SK = movie#member | — |
| Get pick by ID | Picks | PK = pick_id | — |
| Check pick exists for round | Picks | PK = round_id | round-pick-index |
| Watch history for a group | Picks | PK = group_id | group-picks-index |
| Get ratings for a session | Ratings | PK = round_id | — |
| Get/set one rating | Ratings | PK = round_id, SK = member_id | — |
| Cache lookup | TmdbCache | PK = cache_key | — |

**Total: 11 tables, 8 GSIs, 2 TTL-enabled tables.**

---

## Entity Relationship Summary

```
Users (Independent + Managed) ──1:N──▶ GroupMemberships ◀──N:1── Groups
Users ──1:N──▶ Preferences ◀──N:1── Groups
Users ──1:N──▶ Votes (as member_id)
Users ──1:N──▶ Ratings (as member_id)
Users ──1:N──▶ Users (parent → managed members)

Groups ──1:N──▶ Invites
Groups ──1:N──▶ Rounds (Sessions) ──1:N──▶ Suggestions
                Rounds ──1:N──▶ Votes
                Rounds ──1:1──▶ Picks
                Rounds ──1:N──▶ Ratings
```
