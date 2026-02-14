# Family Movie Night — Data Model & Privacy (v1)

> This document describes *what* data we store and our privacy posture. It is intentionally backend-agnostic.

---

## Data Entities

### 1. User

| Field | Type | Notes |
|---|---|---|
| `user_id` | UUID | Primary identifier |
| `email` | string | Unique; used for email sign-up |
| `apple_id_sub` | string (nullable) | Apple ID subject identifier; used for Sign in with Apple |
| `display_name` | string (max 30) | Shown to other group members |
| `avatar_key` | string | Key referencing a predefined avatar illustration |
| `created_at` | timestamp | Account creation time |
| `last_active_at` | timestamp | Last app open / API call |
| `notification_prefs` | JSON | `{ vote_nudge: bool, pick_announce: bool, new_round: bool }` |

**Privacy note:** We do not store real names beyond what the user enters as `display_name`. If using Sign in with Apple's "Hide My Email," we store the relay address only.

### 2. Group

| Field | Type | Notes |
|---|---|---|
| `group_id` | UUID | Primary identifier |
| `name` | string (max 40) | Group display name |
| `created_by` | UUID → User | Group creator (admin) |
| `streaming_services` | string[] | e.g., `["netflix", "disney_plus", "hulu"]` |
| `created_at` | timestamp | |

### 3. Group Membership

| Field | Type | Notes |
|---|---|---|
| `group_id` | UUID → Group | |
| `user_id` | UUID → User | |
| `role` | enum: `creator`, `member` | |
| `joined_at` | timestamp | |
| `is_child_profile` | bool | If true, this profile is managed by the parent (`user_id` is the parent's) |

### 4. Preferences

| Field | Type | Notes |
|---|---|---|
| `user_id` | UUID → User | |
| `group_id` | UUID → Group | Preferences are scoped to a group (allows future multi-group support) |
| `genre_likes` | string[] | Genre IDs from TMDB |
| `genre_dislikes` | string[] | Genre IDs from TMDB |
| `max_content_rating` | enum: `G`, `PG`, `PG-13`, `R` | Default: `PG-13` |
| `updated_at` | timestamp | |

### 5. Invite

| Field | Type | Notes |
|---|---|---|
| `invite_id` | UUID | |
| `group_id` | UUID → Group | |
| `created_by` | UUID → User | |
| `invite_token` | string | Unique token embedded in the invite URL |
| `status` | enum: `pending`, `accepted`, `revoked`, `expired` | |
| `created_at` | timestamp | |
| `expires_at` | timestamp | Default: created_at + 7 days |

### 6. Suggestion Round

| Field | Type | Notes |
|---|---|---|
| `round_id` | UUID | |
| `group_id` | UUID → Group | |
| `started_by` | UUID → User | |
| `status` | enum: `voting`, `closed`, `picked`, `discarded` | |
| `created_at` | timestamp | |
| `closed_at` | timestamp (nullable) | |

### 7. Suggestion (movies in a round)

| Field | Type | Notes |
|---|---|---|
| `round_id` | UUID → Suggestion Round | |
| `tmdb_movie_id` | int | External movie ID from TMDB |
| `position` | int | Display order in the shortlist |

### 8. Vote

| Field | Type | Notes |
|---|---|---|
| `round_id` | UUID → Suggestion Round | |
| `tmdb_movie_id` | int | |
| `user_id` | UUID → User | |
| `vote` | enum: `up`, `down` | |
| `voted_at` | timestamp | |

**Constraint:** One vote per (round, movie, user). Changing a vote overwrites the previous one.

### 9. Pick

| Field | Type | Notes |
|---|---|---|
| `pick_id` | UUID | |
| `round_id` | UUID → Suggestion Round | |
| `tmdb_movie_id` | int | The chosen movie |
| `picked_by` | UUID → User | Group creator who confirmed |
| `picked_at` | timestamp | |
| `watched` | bool | Default: false |
| `watched_at` | timestamp (nullable) | |

### 10. Rating

| Field | Type | Notes |
|---|---|---|
| `pick_id` | UUID → Pick | |
| `user_id` | UUID → User | |
| `stars` | int (1–5) | |
| `rated_at` | timestamp | |

---

## Data We Do NOT Store

- **Passwords in plaintext** — hashed with bcrypt/scrypt/argon2 (implementation detail for backend).
- **Precise location** — not needed; no location features in v1.
- **Contacts / address book** — the invite-via-text flow uses the native SMS composer; we never read the user's contacts.
- **Viewing history from streaming services** — we only know what the user explicitly marks as watched in our app.
- **Payment information** — no monetization in v1.

---

## Privacy Principles

1. **Minimal collection:** We only collect data required for the core loop. No analytics PII (device fingerprinting, IDFA) in v1.
2. **Family-visible, not public:** A user's preferences, votes, and ratings are visible to their group members only. Nothing is public.
3. **Kids' data:** Child profiles (managed by a parent) are subject to COPPA considerations. We do not collect email or identifiers for children — the parent's account owns the child profile. We should consult legal counsel before launch (see open-questions.md).
4. **Third-party data:** Movie metadata comes from TMDB. We cache it locally but do not send user data to TMDB beyond standard API requests (movie lookups). No user PII is shared with third parties.
5. **Apple App Privacy:** We will declare the following data types in the App Store privacy label:
   - Contact Info (email) — used for account creation
   - Identifiers (user ID) — used for app functionality
   - Usage Data (votes, preferences) — used for app functionality
   - None of the above are used for tracking.

---

## Retention Policy

| Data | Retention | Deletion trigger |
|---|---|---|
| Active user account | Indefinite while active | Account deletion request |
| Inactive user account | 24 months after `last_active_at` | Automated cleanup; user notified 30 days before |
| Group data | Retained while ≥ 1 active member exists | Last member leaves or deletes account |
| Invite tokens | 7 days (auto-expire) | Expiry or revocation |
| Suggestion rounds & votes | Retained as group history | Group deletion |
| Watched list & ratings | Retained as group history | Group deletion or account deletion |
| Push notification tokens | Refreshed on app launch; cleared on sign-out | Sign-out or account deletion |

### Account Deletion

Per Apple App Store requirements and privacy regulations:
- Users can request full account deletion from Settings.
- All personal data (email, display name, preferences, votes, ratings) is deleted within **30 days** of the request.
- An anonymized record of votes/ratings may be retained for aggregate analytics (e.g., "4 members rated this movie 4.2 stars" → the individual attribution is removed). This is TBD pending legal review.
- The user is removed from their group immediately; their historical votes/ratings in the group show as "[Deleted User]".

---

## Cached / Derived Data

| Data | Source | Cache strategy |
|---|---|---|
| Movie metadata (title, synopsis, genres, cast, poster URL) | TMDB API | Cache locally with 24-hour TTL |
| Streaming availability | Third-party API (TBD) | Cache locally with 12-hour TTL (availability changes frequently) |
| Poster images | TMDB image CDN | Standard HTTP cache; also cached on-device by the image loader |

---

## Future Considerations (not v1)

- **Analytics events** — if we add analytics, define a separate event schema and ensure no PII leaks.
- **Export my data** — GDPR-style data export is a v2 feature.
- **Encryption at rest** — depends on backend choice. Document requirements when backend is selected.
