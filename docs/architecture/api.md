# API Reference

All endpoints are served by a single Lambda function with a [Hono](https://hono.dev/) router behind API Gateway HTTP API. Authentication is via Cognito JWT in the `Authorization: Bearer <token>` header. The JWT authorizer rejects unauthenticated requests before they reach Lambda.

**Base URL:** `https://{api-id}.execute-api.{region}.amazonaws.com`
(Custom domain can be added later via Route 53 + ACM.)

**Common Headers:**
```
Authorization: Bearer <cognito-access-token>
Content-Type: application/json
X-Acting-As-Member: <member_id>   (optional; for managed member delegation)
```

**Acting-As-Member Header:**
When an authenticated user acts on behalf of a managed member, include the `X-Acting-As-Member` header with the managed member's `member_id` (`managed_<uuid>`). The backend validates that:
1. The member exists and has `is_managed: true`.
2. The member's `parent_user_id` matches the JWT caller's `user_id`.
3. The member belongs to the same group as the request target.

If the header is absent, the authenticated user acts as themselves.

**Common Error Responses:**
| Status | Meaning |
|---|---|
| 400 | Validation error (Zod) — body includes field-level errors |
| 401 | Missing or invalid JWT |
| 403 | Authenticated but not authorized (e.g., not a group member) |
| 404 | Resource not found |
| 409 | Conflict (e.g., pick already exists, active round exists) |
| 429 | Rate limited |
| 500 | Internal server error |

---

## Auth

Authentication is handled by Cognito directly (not through this API). The iOS app uses the AWS SDK / Amplify Auth to call Cognito for sign-up, sign-in, and token refresh. The API only needs the resulting JWT.

See [ADR-0002](/adr/0002-auth.md) for the full auth flow.

---

## Users

### `GET /users/me`
Get the current user's profile. Creates a User record via JIT provisioning if one doesn't exist yet.

**Response 200:**
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "display_name": "Tim",
  "avatar_key": "avatar_bear",
  "created_at": "2026-02-14T00:00:00Z",
  "notification_prefs": {
    "vote_nudge": true,
    "pick_announce": true,
    "new_round": true
  }
}
```

### `PATCH /users/me`
Update display name, avatar, or notification preferences. (US-21, US-24)

**Request:**
```json
{
  "display_name": "Timmy",
  "avatar_key": "avatar_fox",
  "notification_prefs": {
    "vote_nudge": false
  }
}
```

**Response 200:** Updated user object.

### `DELETE /users/me`
Delete the user's account and all associated data. Removes them from any group. (US-23)

**Response 204:** No content.

---

## Groups

### `POST /groups`
Create a new group. The authenticated user becomes the creator and first member. (US-03)

**Request:**
```json
{
  "name": "The Emersons"
}
```

**Response 201:**
```json
{
  "group_id": "uuid",
  "name": "The Emersons",
  "created_by": "uuid",
  "streaming_services": [],
  "created_at": "2026-02-14T00:00:00Z",
  "members": [
    {
      "user_id": "uuid",
      "display_name": "Tim",
      "avatar_key": "avatar_bear",
      "role": "creator",
      "joined_at": "2026-02-14T00:00:00Z"
    }
  ]
}
```

### `GET /groups/{group_id}`
Get group details including member list.

**Response 200:** Group object with `members` array.

### `PATCH /groups/{group_id}`
Update group name or streaming services. Creator only. (US-10)

**Request:**
```json
{
  "streaming_services": ["netflix", "disney_plus", "hulu"]
}
```

**Response 200:** Updated group object.

### `DELETE /groups/{group_id}/members/me`
Leave the group. If the creator leaves, the longest-tenured member becomes creator. (US-22)

**Response 204:** No content.

### `POST /groups/{group_id}/members/managed`
Create a managed member profile within the household. The authenticated user becomes the managed member's parent. (US-25)

**Request:**
```json
{
  "display_name": "Max",
  "avatar_key": "avatar_dino"
}
```

**Response 201:**
```json
{
  "user_id": "managed_<uuid>",
  "display_name": "Max",
  "avatar_key": "avatar_dino",
  "is_managed": true,
  "parent_user_id": "uuid",
  "content_rating_ceiling": "PG",
  "member_type": "managed"
}
```

Managed members automatically get `content_rating_ceiling: "PG"` and are added to the group as a `member`.

**COPPA note:** The response includes `child_profile_disclosure: "This profile is managed by you on behalf of a household member. No data is collected directly from this member."`

### `DELETE /groups/{group_id}/members/{member_id}`
Remove a member from the group. Creator can remove any managed member. Independent members can only remove themselves (use `DELETE /groups/{group_id}/members/me`).

**Response 204:** No content.

**Error 403:** Not authorized to remove this member.

---

## Invites

### `POST /groups/{group_id}/invites`
Generate an invite for the group. Creator only. (US-05)

**Response 201:**
```json
{
  "invite_id": "uuid",
  "invite_token": "abc123xyz",
  "invite_url": "https://familymovienight.app/invite/abc123xyz",
  "status": "pending",
  "expires_at": "2026-02-21T00:00:00Z"
}
```

### `GET /groups/{group_id}/invites`
List pending invites for the group. Creator only. (US-07)

**Response 200:**
```json
{
  "invites": [
    {
      "invite_id": "uuid",
      "status": "pending",
      "created_at": "2026-02-14T00:00:00Z",
      "expires_at": "2026-02-21T00:00:00Z"
    }
  ]
}
```

### `DELETE /groups/{group_id}/invites/{invite_id}`
Revoke a pending invite. Creator only. (US-07)

**Response 204:** No content.

### `POST /invites/{invite_token}/accept`
Accept an invite and join the group. The authenticated user is added as a member. (US-05)

**Response 200:**
```json
{
  "group_id": "uuid",
  "group_name": "The Emersons",
  "role": "member"
}
```

**Error 410:** Invite expired or revoked.
**Error 409:** Group is full (8 members).

---

## Preferences

### `GET /groups/{group_id}/preferences`
Get preferences for the current user (or a managed member) in this group. (US-08, US-09)

**Query params:**
- `member_id` (optional) — If provided, returns preferences for the specified managed member. The caller must be the managed member's parent.

**Response 200:**
```json
{
  "member_id": "uuid",
  "group_id": "uuid",
  "genre_likes": ["28", "35", "16"],
  "genre_dislikes": ["27"],
  "max_content_rating": "PG-13",
  "updated_at": "2026-02-14T00:00:00Z"
}
```

### `PUT /groups/{group_id}/preferences`
Set or replace preferences for the current user (or a managed member) in this group. (US-08, US-09)

**Query params:**
- `member_id` (optional) — If provided, sets preferences for the specified managed member. The caller must be the managed member's parent.

**Request:**
```json
{
  "genre_likes": ["28", "35", "16"],
  "genre_dislikes": ["27"],
  "max_content_rating": "PG-13"
}
```

**Validation:**
- `genre_likes` must have ≥ 2 entries (Flow 3 requirement).
- `genre_likes` and `genre_dislikes` must not overlap.
- `max_content_rating` must be one of: `G`, `PG`, `PG-13`, `R`.

**Response 200:** Updated preferences object.

---

## Rounds

### `POST /groups/{group_id}/rounds`
Start a new session. Any household member can create a session. Runs the recommendation algorithm using attendees' preferences and creates a voting round with 5–8 suggestions. (US-11, Flow 5+6)

**Request:**
```json
{
  "attendees": ["uuid-1", "uuid-2", "managed_uuid-3"],
  "exclude_movie_ids": [550, 680]
}
```
- `attendees` (optional) — Array of member IDs who are participating. Must be a subset of group members. Min 2. Defaults to all group members if omitted.
- `exclude_movie_ids` is used for "Show Me More" (US-13) — pass the IDs from the previous batch.

**Response 201:**
```json
{
  "round_id": "uuid",
  "group_id": "uuid",
  "status": "voting",
  "started_by": "uuid",
  "attendees": ["uuid-1", "uuid-2", "managed_uuid-3"],
  "created_at": "2026-02-14T20:00:00Z",
  "suggestions": [
    {
      "tmdb_movie_id": 550,
      "position": 1,
      "title": "Fight Club",
      "year": 1999,
      "poster_path": "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
      "overview": "A ticking-Loss clerk...",
      "genres": ["Drama", "Thriller"],
      "content_rating": "R",
      "runtime": 139,
      "popularity": 61.4,
      "streaming": [
        { "provider": "Hulu", "logo_path": "/...", "link": "https://..." }
      ]
    }
  ],
  "relaxed_constraints": []
}
```

**Error 409:** An active round already exists. Response includes the active `round_id`.
**Error 422:** Fewer than 2 attendees have set preferences.

### `GET /rounds/{round_id}`
Get round details including suggestions, vote counts, attendees, and status.

**Response 200:**
```json
{
  "round_id": "uuid",
  "group_id": "uuid",
  "status": "voting",
  "started_by": "uuid",
  "attendees": ["uuid-1", "uuid-2", "managed_uuid-3"],
  "created_at": "2026-02-14T20:00:00Z",
  "suggestions": [
    {
      "tmdb_movie_id": 550,
      "position": 1,
      "title": "Fight Club",
      "votes": { "up": 2, "down": 1 },
      "voters": [
        { "member_id": "uuid-1", "display_name": "Tim", "vote": "up" },
        { "member_id": "uuid-2", "display_name": "Sarah", "vote": "up" },
        { "member_id": "managed_uuid-3", "display_name": "Max", "vote": "down" }
      ]
    }
  ],
  "vote_progress": { "voted": 3, "total": 3 }
}
```

Status values: `draft`, `voting`, `selected`, `watched`, `rated`, `expired`.
Vote progress `total` = number of attendees (not all group members).

### `PATCH /rounds/{round_id}`
Transition a round through its lifecycle. A single endpoint handles all status transitions with validation. (US-14, US-18, US-19)

**Request:**
```json
{
  "status": "closed"
}
```

**Valid transitions and permissions:**

| From | To | Who | Notes |
|---|---|---|---|
| `voting` | `closed` | Creator only | Close voting early |
| `selected` | `watched` | Any member | Mark movie as watched; sets `watched_at` |
| `watched` | `rated` | Creator only | Close ratings (when not all attendees have rated) |

The `selected` status is set automatically by `POST /rounds/{round_id}/pick`. The `rated` status is set automatically when all attendees have submitted ratings, but can also be set manually via this endpoint to close ratings early.

**Response 200:** Updated round object with relevant timestamp (`watched_at`, `rated_at`, etc.).

---

## Votes

### `POST /rounds/{round_id}/votes`
Submit a vote on a movie in the round. Overwrites any previous vote by this member on this movie. Vote is attributed to the active member (the authenticated user, or a managed member if `X-Acting-As-Member` is set). (US-14)

**Request:**
```json
{
  "tmdb_movie_id": 550,
  "vote": "up"
}
```

**Validation:**
- `vote` must be `"up"` or `"down"`.
- Round must have `status: "voting"`.
- Acting member must be an attendee of this round.
- `tmdb_movie_id` must be in the round's suggestions.

**Response 200:**
```json
{
  "round_id": "uuid",
  "tmdb_movie_id": 550,
  "member_id": "uuid",
  "vote": "up",
  "voted_at": "2026-02-14T20:15:00Z"
}
```

### `GET /rounds/{round_id}/results`
Get voting results ranked by net score. (US-15)

**Response 200:**
```json
{
  "round_id": "uuid",
  "status": "closed",
  "results": [
    {
      "tmdb_movie_id": 550,
      "title": "Fight Club",
      "net_score": 1,
      "votes_up": 2,
      "votes_down": 1,
      "voters": [
        { "member_id": "uuid", "display_name": "Tim", "vote": "up" }
      ],
      "rank": 1
    }
  ]
}
```

---

## Picks

### `POST /rounds/{round_id}/pick`
Lock in the movie pick for this round. Creator only. Sends push notification to all members. (US-16)

**Request:**
```json
{
  "tmdb_movie_id": 550
}
```

**Validation:**
- `tmdb_movie_id` must be in the round's suggestions.
- Round must not already have a pick (conditional write).

**Response 201:**
```json
{
  "pick_id": "uuid",
  "round_id": "uuid",
  "tmdb_movie_id": 550,
  "title": "Fight Club",
  "picked_by": "uuid",
  "picked_at": "2026-02-14T21:00:00Z",
  "watched": false
}
```

**Error 409:** A pick already exists for this round.

### `PATCH /picks/{pick_id}`
Mark a pick as watched. Any group member can do this. (US-18)

**Request:**
```json
{
  "watched": true
}
```

**Response 200:** Updated pick object with `watched_at` timestamp.

### `GET /groups/{group_id}/picks`
Get the group's pick history (watch history). (US-20)

**Response 200:**
```json
{
  "picks": [
    {
      "pick_id": "uuid",
      "tmdb_movie_id": 550,
      "title": "Fight Club",
      "poster_path": "/...",
      "picked_at": "2026-02-14T21:00:00Z",
      "watched": true,
      "watched_at": "2026-02-15T02:00:00Z",
      "ratings_summary": { "loved": 2, "liked": 1, "did_not_like": 0 },
      "rating_count": 3
    }
  ]
}
```

---

## Ratings

### `POST /rounds/{round_id}/ratings`
Rate a watched movie for a session. One rating per member per session; overwrites if called again. Rating is attributed to the active member (authenticated user or managed member via `X-Acting-As-Member`). (US-19)

**Request:**
```json
{
  "rating": "loved"
}
```

**Validation:**
- `rating` must be `"loved"`, `"liked"`, or `"did_not_like"`.
- Round must be in `selected` or `watched` status.
- Acting member must be an attendee of this round.

**Response 201:**
```json
{
  "round_id": "uuid",
  "member_id": "uuid",
  "rating": "loved",
  "rated_at": "2026-02-15T10:00:00Z"
}
```

The round auto-transitions to `rated` when all attending members have submitted a rating. If some attendees never rate, the creator can manually close ratings via `PATCH /rounds/{round_id}` with `{"status": "rated"}`.

### `GET /rounds/{round_id}/ratings`
Get all ratings for a session. (US-19)

**Response 200:**
```json
{
  "round_id": "uuid",
  "ratings": [
    {
      "member_id": "uuid",
      "display_name": "Tim",
      "rating": "loved",
      "rated_at": "2026-02-15T10:00:00Z"
    }
  ]
}
```

---

## Movies

### `GET /movies/{tmdb_movie_id}`
Get full movie details from TMDB (cached). (US-12)

**Response 200:**
```json
{
  "tmdb_movie_id": 550,
  "title": "Fight Club",
  "year": 1999,
  "poster_path": "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
  "overview": "A ticking-time-bomb insomniac...",
  "runtime": 139,
  "genres": ["Drama", "Thriller"],
  "content_rating": "R",
  "cast": [
    { "name": "Brad Pitt", "character": "Tyler Durden" },
    { "name": "Edward Norton", "character": "The Narrator" }
  ],
  "popularity": 61.4,
  "vote_average": 8.4,
  "streaming": [
    { "provider": "Hulu", "logo_path": "/...", "link": "https://..." }
  ],
  "trailer_url": "https://www.youtube.com/watch?v=SUXWAEX2jlg"
}
```

---

## Sessions (History)

### `GET /groups/{group_id}/sessions`
Get paginated list of all sessions (rounds) for the group. (US-20)

**Query params:**
- `limit` (optional, default 20) — Number of sessions to return.
- `cursor` (optional) — Pagination cursor from previous response.

**Response 200:**
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
        "poster_path": "/..."
      },
      "ratings_summary": { "loved": 2, "liked": 1, "did_not_like": 0 }
    }
  ],
  "next_cursor": "..."
}
```

---

## Endpoint Summary

| Method | Path | Description | Auth | User Story |
|---|---|---|---|---|
| GET | `/users/me` | Get current user | JWT | — |
| PATCH | `/users/me` | Update profile/prefs | JWT | US-21, US-24 |
| DELETE | `/users/me` | Delete account | JWT | US-23 |
| POST | `/groups` | Create group | JWT | US-03 |
| GET | `/groups/{group_id}` | Get group details | JWT + member | — |
| PATCH | `/groups/{group_id}` | Update group | JWT + creator | US-10 |
| DELETE | `/groups/{group_id}/members/me` | Leave group | JWT + member | US-22 |
| POST | `/groups/{group_id}/members/managed` | Create managed member | JWT + member | US-25 |
| DELETE | `/groups/{group_id}/members/{member_id}` | Remove member | JWT + creator | — |
| POST | `/groups/{group_id}/invites` | Create invite | JWT + creator | US-05 |
| GET | `/groups/{group_id}/invites` | List invites | JWT + creator | US-07 |
| DELETE | `/groups/{group_id}/invites/{invite_id}` | Revoke invite | JWT + creator | US-07 |
| POST | `/invites/{invite_token}/accept` | Accept invite | JWT | US-05 |
| GET | `/groups/{group_id}/preferences` | Get preferences | JWT + member | US-08 |
| PUT | `/groups/{group_id}/preferences` | Set preferences | JWT + member | US-08, US-09 |
| POST | `/groups/{group_id}/rounds` | Start session | JWT + member | US-11 |
| GET | `/groups/{group_id}/sessions` | Session history | JWT + member | US-20 |
| GET | `/rounds/{round_id}` | Get round | JWT + member | — |
| PATCH | `/rounds/{round_id}` | Transition status | JWT + varies | US-14, US-18, US-19 |
| POST | `/rounds/{round_id}/votes` | Submit vote | JWT + member | US-14 |
| GET | `/rounds/{round_id}/results` | Get results | JWT + member | US-15 |
| POST | `/rounds/{round_id}/pick` | Lock in pick | JWT + creator | US-16 |
| PATCH | `/picks/{pick_id}` | Mark watched | JWT + member | US-18 |
| GET | `/groups/{group_id}/picks` | Pick history | JWT + member | US-20 |
| POST | `/rounds/{round_id}/ratings` | Rate movie | JWT + member | US-19 |
| GET | `/rounds/{round_id}/ratings` | Get ratings | JWT + member | US-19 |
| GET | `/movies/{tmdb_movie_id}` | Movie details | JWT | US-12 |

**Total: 27 endpoints** covering all P0 and P1 user stories.

Notes:
- `X-Acting-As-Member` header is accepted on all endpoints that attribute actions to a member (votes, ratings, preferences). The backend resolves the acting member from the header or falls back to the authenticated user.
- `POST /groups/{group_id}/rounds` — any member can start a session (not creator-only).
- Rating uses 3-point scale (`loved`, `liked`, `did_not_like`) not 1-5 stars.
