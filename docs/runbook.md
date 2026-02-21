# Runbook

## Repo Layout
- `ios/` — iOS app (Xcode/SwiftUI)
- `backend/` — backend + IaC (AWS CDK)
- `docs/` — docs
- `adr/` — architecture decision records

## Common Commands
- `make help` — list all targets
- `make setup` — install backend dependencies
- `make test` — run all backend tests
- `make lint` — run linters

## Backend Setup

### Prerequisites
- Node.js 20+
- AWS CLI configured (for deployment)

### Install dependencies
```bash
make setup
# or: cd backend && npm install
```

### Run tests
```bash
make test
# or: cd backend && npx vitest run
```

### Watch mode (development)
```bash
cd backend && npx vitest
```

## Auth Configuration

### Cognito (CDK Context Variables)

The auth stack uses CDK context for Apple Sign-In configuration. These are optional in dev — the stack works without Apple IdP.

| Variable | Description |
|---|---|
| `appleServicesId` | Apple Services ID (from Apple Developer portal) |
| `appleTeamId` | Apple Developer Team ID |
| `appleKeyId` | Apple Sign-In key ID |

To deploy with Apple Sign-In:
```bash
cd backend/cdk && npx cdk deploy '*-Auth' \
  -c appleServicesId=com.example.familymovienight \
  -c appleTeamId=ABCDE12345 \
  -c appleKeyId=KEY123456
```

Without Apple Sign-In (email/password only):
```bash
cd backend/cdk && npx cdk deploy '*-Auth'
```

### Testing Auth Locally

1. **Get a test token** — After deploying the Auth stack, create a test user in the Cognito console and get tokens:
   ```bash
   aws cognito-idp admin-create-user \
     --user-pool-id <UserPoolId> \
     --username test@example.com \
     --temporary-password 'TempPass1'

   aws cognito-idp initiate-auth \
     --client-id <UserPoolClientId> \
     --auth-flow USER_PASSWORD_AUTH \
     --auth-parameters USERNAME=test@example.com,PASSWORD='TempPass1'
   ```

2. **Call the API** with the access token:
   ```bash
   curl -H "Authorization: Bearer <access_token>" \
     https://<api-endpoint>/users/me
   ```

3. **Health check** (no auth required):
   ```bash
   curl https://<api-endpoint>/health
   ```

## API Endpoints

### Users (Task 02)
- `GET /users/me` — get or create current user (JIT provisioning)
- `DELETE /users/me` — delete account

### Groups (Task 03)
- `POST /groups` — create a new group (one group per user in v1)
- `GET /groups/{group_id}` — get group details + members (members only)
- `PATCH /groups/{group_id}` — update group name/streaming services (creator only)
- `DELETE /groups/{group_id}/members/me` — leave the group

### Invites (Task 03)
- `POST /groups/{group_id}/invites` — generate invite link (creator only)
- `GET /groups/{group_id}/invites` — list pending invites (creator only)
- `DELETE /groups/{group_id}/invites/{invite_id}` — revoke invite (creator only)
- `POST /invites/{invite_token}/accept` — accept invite and join group

### Preferences (Task 04)
- `GET /groups/{group_id}/preferences` — get current user's genre/rating preferences (members only)
- `PUT /groups/{group_id}/preferences` — set or replace preferences (members only)

#### Validation
- `genre_likes` must have at least 2 entries
- `genre_likes` and `genre_dislikes` must not overlap
- `max_content_rating` must be one of: `G`, `PG`, `PG-13`, `R`

### Watchlist (Slice A)
- `POST /groups/{group_id}/watchlist` — add a movie to the watchlist (members only, 50-movie cap)
- `GET /groups/{group_id}/watchlist` — list watchlist items reverse-chronologically (members only)
- `DELETE /groups/{group_id}/watchlist/{tmdb_movie_id}` — remove from watchlist (adder or creator only)

### Watched Movies (Slice A)
- `POST /groups/{group_id}/picks/{pick_id}/watched` — mark a pick as watched (members only)
- `POST /groups/{group_id}/watched` — directly mark a movie as watched (members only)
- `DELETE /groups/{group_id}/watched/{tmdb_movie_id}` — undo direct watched mark (within 24h, marker or creator only)
- `GET /groups/{group_id}/watched` — get combined watched movies (picks + direct marks, members only)

### Movie Detail (Slice A)
- `GET /movies/{tmdb_movie_id}?group_id={group_id}` — get movie metadata from TMDB with optional group context overlay (watchlist status, watched status, vote history, active round)

### Suggestions (Task 05)
- `GET /groups/{group_id}/suggestions` — get 3–5 movie suggestions for the group (members only)
  - Optional query param: `exclude_movie_ids` (comma-separated TMDB IDs) for "Show Me More"
  - Requires at least 2 members with preferences set (returns 400 otherwise)
  - Returns `{ suggestions: [...], relaxed_constraints: [...] }`
  - Each suggestion includes: `tmdb_movie_id`, `title`, `year`, `poster_path`, `overview`, `genres`, `content_rating`, `popularity`, `vote_average`, `streaming`, `score`, `reason`
  - Algorithm: ADR-0003 five-stage filter-and-rank pipeline (aggregate prefs → TMDB discover → filter exclusions → score/rank → return top 5)

### Authorization Rules
- **JWT required** on all endpoints except `GET /health`
- **Member check**: GET group, leave group, get/set preferences — user must be in GroupMemberships for that group
- **Creator check**: update group, create/list/revoke invites — membership role must be `creator`
- **One group per user** (v1): creating or joining a group returns 409 if user already belongs to one
- **Group size cap**: 8 members max — accepting an invite returns 409 if full
- **Invite expiry**: invites expire after 7 days; accepting returns 410 if expired/revoked

### Testing Groups & Invites Locally

1. **Create a group:**
   ```bash
   curl -X POST -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"name": "The Emersons"}' \
     https://<api-endpoint>/groups
   ```

2. **Create an invite:**
   ```bash
   curl -X POST -H "Authorization: Bearer <token>" \
     https://<api-endpoint>/groups/<group_id>/invites
   ```

3. **Accept an invite** (as a different user):
   ```bash
   curl -X POST -H "Authorization: Bearer <other-user-token>" \
     https://<api-endpoint>/invites/<invite_token>/accept
   ```

### Testing Preferences Locally

1. **Set preferences:**
   ```bash
   curl -X PUT -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"genre_likes": ["28", "35", "16"], "genre_dislikes": ["27"], "max_content_rating": "PG-13"}' \
     https://<api-endpoint>/groups/<group_id>/preferences
   ```

2. **Get preferences:**
   ```bash
   curl -H "Authorization: Bearer <token>" \
     https://<api-endpoint>/groups/<group_id>/preferences
   ```

### Testing Suggestions Locally

**Prerequisites:** You need a TMDB API key (free at https://www.themoviedb.org/settings/api). Store it in SSM Parameter Store before deploying:
```bash
aws ssm put-parameter \
  --name "/family-movie-night/tmdb-api-key" \
  --type String \
  --value "<your-tmdb-api-key>"
```
The CDK stack reads this parameter at deploy time and injects it into the Lambda environment.

1. **Ensure at least 2 members have set preferences** (see "Testing Preferences" above).

2. **Get suggestions:**
   ```bash
   curl -H "Authorization: Bearer <token>" \
     https://<api-endpoint>/groups/<group_id>/suggestions
   ```

3. **"Show Me More" — exclude previous batch:**
   ```bash
   curl -H "Authorization: Bearer <token>" \
     "https://<api-endpoint>/groups/<group_id>/suggestions?exclude_movie_ids=550,680,120"
   ```

4. **Verify 400 when <2 members have preferences:**
   ```bash
   # Use a group where only 1 member has set preferences
   curl -H "Authorization: Bearer <token>" \
     https://<api-endpoint>/groups/<group_id>/suggestions
   # Expected: 400 with error message
   ```

5. **Verify 403 for non-member:**
   ```bash
   curl -H "Authorization: Bearer <other-user-token>" \
     https://<api-endpoint>/groups/<group_id>/suggestions
   # Expected: 403
   ```

### Testing Watchlist Locally

1. **Add to watchlist:**
   ```bash
   curl -X POST -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"tmdb_movie_id": 550, "title": "Fight Club", "poster_path": "/pB8BM7pdSp6B6Ih7QI4S2t0POtL.jpg", "year": 1999, "genres": ["Drama"], "content_rating": "R"}' \
     https://<api-endpoint>/groups/<group_id>/watchlist
   ```

2. **List watchlist:**
   ```bash
   curl -H "Authorization: Bearer <token>" \
     https://<api-endpoint>/groups/<group_id>/watchlist
   ```

3. **Remove from watchlist:**
   ```bash
   curl -X DELETE -H "Authorization: Bearer <token>" \
     https://<api-endpoint>/groups/<group_id>/watchlist/550
   ```

### Testing Watched Movies Locally

1. **Mark as watched (direct):**
   ```bash
   curl -X POST -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"tmdb_movie_id": 550, "title": "Fight Club", "poster_path": "/pB8BM7pdSp6B6Ih7QI4S2t0POtL.jpg", "year": 1999}' \
     https://<api-endpoint>/groups/<group_id>/watched
   ```

2. **Get combined watched list:**
   ```bash
   curl -H "Authorization: Bearer <token>" \
     https://<api-endpoint>/groups/<group_id>/watched
   ```

3. **Undo watched (within 24h):**
   ```bash
   curl -X DELETE -H "Authorization: Bearer <token>" \
     https://<api-endpoint>/groups/<group_id>/watched/550
   ```

### Testing Movie Detail Locally

1. **Get movie detail (no group context):**
   ```bash
   curl -H "Authorization: Bearer <token>" \
     https://<api-endpoint>/movies/550
   ```

2. **Get movie detail with group context:**
   ```bash
   curl -H "Authorization: Bearer <token>" \
     "https://<api-endpoint>/movies/550?group_id=<group_id>"
   ```

## CDK Deployment

### Deploy all stacks
```bash
cd backend/cdk && npx cdk deploy --all
```

### Deploy a specific stack
```bash
cd backend/cdk && npx cdk deploy 'dev-FamilyMovieNight-Auth'
```

### Synthesize (check templates without deploying)
```bash
cd backend/cdk && npx cdk synth
```

## Environments
- dev: default CDK context (`env: "dev"`)
- prod: set via `cdk deploy -c env=prod` (enables PITR, RETAIN on DynamoDB tables)

## iOS App

### Prerequisites
- Xcode 15+
- Apple Developer account (for Sign in with Apple)

### Build
The iOS project requires an `.xcodeproj` or `.xcworkspace` file, which must be created via Xcode or xcodegen. The Swift source files are in `ios/FamilyMovieNight/`.

### Configuration
Update `ios/FamilyMovieNight/amplifyconfiguration.json` with the Cognito User Pool values from the deployed Auth stack outputs:
- `PoolId` — from `UserPoolId` output
- `AppClientId` — from `UserPoolClientId` output
- `Region` — your AWS region (e.g., `us-east-1`)
