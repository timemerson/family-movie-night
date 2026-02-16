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
