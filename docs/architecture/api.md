# API Reference

All endpoints are served by a single Lambda function with a [Hono](https://hono.dev/) router behind API Gateway HTTP API. Authentication is via Cognito JWT in the `Authorization: Bearer <token>` header. The JWT authorizer rejects unauthenticated requests before they reach Lambda.

**Base URL:** `https://{api-id}.execute-api.{region}.amazonaws.com`
(Custom domain can be added later via Route 53 + ACM.)

**Common Headers:**
```
Authorization: Bearer <cognito-access-token>
Content-Type: application/json
```

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
Get the current user's preferences for this group. (US-08, US-09)

**Response 200:**
```json
{
  "user_id": "uuid",
  "group_id": "uuid",
  "genre_likes": ["28", "35", "16"],
  "genre_dislikes": ["27"],
  "max_content_rating": "PG-13",
  "updated_at": "2026-02-14T00:00:00Z"
}
```

### `PUT /groups/{group_id}/preferences`
Set or replace the current user's preferences for this group. (US-08, US-09)

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
Start a new suggestion round. Runs the recommendation algorithm and creates a voting round with 5–8 suggestions. (US-11, Flow 5+6)

**Request (optional):**
```json
{
  "exclude_movie_ids": [550, 680]
}
```
`exclude_movie_ids` is used for "Show Me More" (US-13) — pass the IDs from the previous batch.

**Response 201:**
```json
{
  "round_id": "uuid",
  "group_id": "uuid",
  "status": "voting",
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
**Error 422:** Fewer than 2 members have set preferences.

### `GET /rounds/{round_id}`
Get round details including suggestions, vote counts, and status.

**Response 200:**
```json
{
  "round_id": "uuid",
  "group_id": "uuid",
  "status": "voting",
  "created_at": "2026-02-14T20:00:00Z",
  "suggestions": [
    {
      "tmdb_movie_id": 550,
      "position": 1,
      "title": "Fight Club",
      "votes": { "up": 2, "down": 1 },
      "voters": [
        { "user_id": "uuid", "display_name": "Tim", "vote": "up" },
        { "user_id": "uuid", "display_name": "Sarah", "vote": "up" },
        { "user_id": "uuid", "display_name": "Max", "vote": "down" }
      ]
    }
  ],
  "vote_progress": { "voted": 3, "total": 4 }
}
```

### `PATCH /rounds/{round_id}`
Close a voting round early. Creator only. (US-14, Flow 6 step 3)

**Request:**
```json
{
  "status": "closed"
}
```

**Response 200:** Updated round object.

---

## Votes

### `POST /rounds/{round_id}/votes`
Submit a vote on a movie in the round. Overwrites any previous vote by this user on this movie. (US-14)

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
- User must be a member of the round's group.
- `tmdb_movie_id` must be in the round's suggestions.

**Response 200:**
```json
{
  "round_id": "uuid",
  "tmdb_movie_id": 550,
  "user_id": "uuid",
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
        { "user_id": "uuid", "display_name": "Tim", "vote": "up" }
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
      "avg_rating": 4.2,
      "rating_count": 3
    }
  ]
}
```

---

## Ratings

### `POST /picks/{pick_id}/ratings`
Rate a watched movie. One rating per user per pick; overwrites if called again. (US-19)

**Request:**
```json
{
  "stars": 4
}
```

**Validation:**
- `stars` must be 1–5.
- The pick must be marked as watched.

**Response 201:**
```json
{
  "pick_id": "uuid",
  "user_id": "uuid",
  "stars": 4,
  "rated_at": "2026-02-15T10:00:00Z"
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

## Account

### `POST /account/child-profiles`
Create a child profile under the current user's account. (US-25)

**Request:**
```json
{
  "display_name": "Max",
  "avatar_key": "avatar_dino",
  "group_id": "uuid"
}
```

**Response 201:**
```json
{
  "user_id": "uuid (child profile ID)",
  "display_name": "Max",
  "avatar_key": "avatar_dino",
  "is_child_profile": true,
  "parent_user_id": "uuid",
  "max_content_rating": "PG"
}
```

Child profiles automatically get `max_content_rating: "PG"` and are added to the specified group.

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
| POST | `/groups/{group_id}/invites` | Create invite | JWT + creator | US-05 |
| GET | `/groups/{group_id}/invites` | List invites | JWT + creator | US-07 |
| DELETE | `/groups/{group_id}/invites/{invite_id}` | Revoke invite | JWT + creator | US-07 |
| POST | `/invites/{invite_token}/accept` | Accept invite | JWT | US-05 |
| GET | `/groups/{group_id}/preferences` | Get my preferences | JWT + member | US-08 |
| PUT | `/groups/{group_id}/preferences` | Set preferences | JWT + member | US-08, US-09 |
| POST | `/groups/{group_id}/rounds` | Start round | JWT + member | US-11 |
| GET | `/rounds/{round_id}` | Get round | JWT + member | — |
| PATCH | `/rounds/{round_id}` | Close round | JWT + creator | US-14 |
| POST | `/rounds/{round_id}/votes` | Submit vote | JWT + member | US-14 |
| GET | `/rounds/{round_id}/results` | Get results | JWT + member | US-15 |
| POST | `/rounds/{round_id}/pick` | Lock in pick | JWT + creator | US-16 |
| PATCH | `/picks/{pick_id}` | Mark watched | JWT + member | US-18 |
| GET | `/groups/{group_id}/picks` | Pick history | JWT + member | US-20 |
| POST | `/picks/{pick_id}/ratings` | Rate movie | JWT + member | US-19 |
| GET | `/movies/{tmdb_movie_id}` | Movie details | JWT | US-12 |
| POST | `/account/child-profiles` | Create child profile | JWT | US-25 |

**Total: 24 endpoints** covering all P0 and P1 user stories.
