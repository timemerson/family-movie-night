# AWS Deployment Plan

## Services & Free Tier Coverage

| Service | Usage | Free Tier | v1 Estimate | Covered? |
|---|---|---|---|---|
| **API Gateway** (HTTP API) | REST endpoint | 1M requests/mo (12 months) | <10K requests/mo | Yes |
| **Lambda** | Business logic | 1M invocations + 400K GB-s/mo (always free) | <10K invocations/mo | Yes |
| **DynamoDB** (on-demand) | Data storage | 25 GB + 25 RCU + 25 WCU (always free) | <1 GB, minimal throughput | Yes |
| **Cognito** | Authentication | 50K MAU (always free) | <100 MAU | Yes |
| **SNS** (Mobile Push) | Push notifications | 1M publishes/mo (always free) | <1K pushes/mo | Yes |
| **CloudWatch** | Logging | 5 GB ingestion + 10 custom metrics (always free) | <1 GB | Yes |
| **SSM Parameter Store** | Secrets | Free (standard parameters) | 3-5 params | Yes |
| **CloudFormation** | CDK deploys | Free | — | Yes |

**Post-free-tier costs** (after 12 months): <$5/month at v1 scale. DynamoDB, Lambda, Cognito, and SNS have always-free tiers that cover v1 indefinitely. Only API Gateway's free tier expires.

---

## Infrastructure as Code: CDK (TypeScript)

All infrastructure is defined in AWS CDK using TypeScript — the same language as the Lambda function. This means one language across the entire backend stack.

### Project Structure

```
backend/
├── cdk/
│   ├── bin/
│   │   └── app.ts                  # CDK app entry point
│   ├── lib/
│   │   ├── api-stack.ts            # API Gateway + Lambda
│   │   ├── auth-stack.ts           # Cognito User Pool + Apple IdP
│   │   ├── data-stack.ts           # DynamoDB tables + GSIs
│   │   ├── notifications-stack.ts  # SNS platform application
│   │   └── monitoring-stack.ts     # CloudWatch dashboards + alarms
│   ├── cdk.json
│   └── tsconfig.json
├── src/
│   ├── index.ts                    # Lambda entry point (Hono app)
│   ├── routes/
│   │   ├── users.ts
│   │   ├── groups.ts
│   │   ├── invites.ts
│   │   ├── preferences.ts
│   │   ├── rounds.ts
│   │   ├── votes.ts
│   │   ├── picks.ts
│   │   ├── ratings.ts
│   │   ├── movies.ts
│   │   └── account.ts
│   ├── services/
│   │   ├── tmdb.ts                 # TMDB API client + caching
│   │   ├── recommendations.ts      # Suggestion algorithm (ADR-0003)
│   │   ├── notifications.ts        # SNS push notification helper
│   │   └── auth.ts                 # JIT user provisioning
│   ├── middleware/
│   │   ├── group-member.ts         # Verify user is a group member
│   │   └── group-creator.ts        # Verify user is the group creator
│   ├── lib/
│   │   ├── dynamo.ts               # DynamoDB client + table helpers
│   │   └── errors.ts               # HTTP error classes
│   └── schemas/
│       └── *.ts                    # Zod validation schemas per route
├── test/
│   ├── routes/                     # Route handler tests
│   ├── services/                   # Service logic tests
│   └── cdk/                        # CDK snapshot tests
├── package.json
├── tsconfig.json
└── esbuild.config.ts               # Lambda bundling
```

### CDK Stack Organization

Five stacks, deployed together in a single CDK app:

| Stack | Resources | Dependencies |
|---|---|---|
| `DataStack` | DynamoDB tables (11), GSIs (8) | None |
| `AuthStack` | Cognito User Pool, Apple IdP, app client | None |
| `ApiStack` | Lambda function, API Gateway HTTP API, JWT authorizer | DataStack, AuthStack |
| `NotificationsStack` | SNS platform application (APNs) | None |
| `MonitoringStack` | CloudWatch dashboard, error alarms | ApiStack |

### Environment Separation

Use a single AWS account with a **stack name prefix** for environment separation:

```typescript
// bin/app.ts
const env = app.node.tryGetContext('env') || 'dev';

new DataStack(app, `${env}-FamilyMovieNight-Data`);
new AuthStack(app, `${env}-FamilyMovieNight-Auth`);
// ...
```

Deploy with:
```bash
cdk deploy --all --context env=dev
cdk deploy --all --context env=prod
```

This is simpler than multi-account setups for a personal learning project. Resources are isolated by name prefix; IAM policies scope Lambda access to the correct tables.

---

## Security

### API Authentication

- **API Gateway JWT Authorizer** validates every request against the Cognito User Pool.
- Unauthenticated requests receive `401` before reaching Lambda — zero compute cost for invalid requests.
- See [ADR-0002](/adr/0002-auth.md) for the full auth flow.

### Authorization (Application-Level)

The Lambda enforces authorization rules in middleware:

| Rule | Check | Enforcement |
|---|---|---|
| User is a group member | Query GroupMemberships table | `group-member` middleware on all `/groups/{id}/*` routes |
| User is the group creator | Check `role = creator` in membership | `group-creator` middleware on admin-only routes |
| Round belongs to user's group | Look up round, verify group membership | Route handler |

### IAM: Least Privilege

Each CDK stack grants only the permissions the Lambda needs:

```typescript
// In DataStack
usersTable.grantReadWriteData(lambdaFunction);
groupsTable.grantReadWriteData(lambdaFunction);
// ... per table
```

The Lambda role has **no wildcard permissions** (`*`). Each DynamoDB table grants `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:Query`, etc., scoped to its ARN.

### Secrets Management

| Secret | Storage | Access |
|---|---|---|
| TMDB API key | SSM Parameter Store (SecureString) | Lambda reads at cold start |
| APNs signing key | SSM Parameter Store (SecureString) | SNS platform app config |
| Cognito app client secret | CDK-generated, passed via env var | Lambda environment variable |

No secrets in code, no `.env` files in deployment artifacts.

### Input Validation

All request bodies are validated with **Zod** schemas before any business logic runs. Invalid requests get a `400` with field-level error details. This prevents injection attacks and ensures data integrity in DynamoDB.

---

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **TMDB API rate limits** | Medium | Suggestions fail | Cache responses in DynamoDB (24h TTL); TMDB free tier allows 40 req/s — more than enough |
| **Cognito complexity** | Medium | Auth delays development | Use minimal config; follow ADR-0002 step by step; test with curl before iOS |
| **DynamoDB data modeling mistakes** | Low | Expensive table scans or missing access patterns | Multi-table design is forgiving; access pattern matrix documented; GSIs can be added |
| **Lambda cold starts** | Low | First request slow (~1-2s) | ARM64 + small bundle (esbuild tree-shaking); provisioned concurrency if needed |
| **CDK learning curve** | Medium | Slow infrastructure iteration | Start with minimal stacks; use `cdk diff` to preview changes; snapshot tests |
| **AWS Free Tier expiry** (API Gateway) | Certain | Small cost increase | Post-free-tier cost is ~$0.01/1K requests; budget $5/month total |
| **APNs certificate expiry** | Low | Push notifications stop working | Use token-based auth (no cert rotation); CloudWatch alarm on SNS delivery failures |
| **TMDB watch-providers data quality** | Medium | Incorrect streaming info | Treat streaming as ranking boost, not hard filter; plan to upgrade to Watchmode if needed (OQ-01) |

---

## Implementation Sequence

### Phase 1: Project Setup
- Initialize CDK app with TypeScript
- Configure `backend/` project structure
- Set up esbuild for Lambda bundling
- Create `DataStack` with all DynamoDB tables
- Deploy to dev environment, verify tables exist

### Phase 2: Authentication
- Create `AuthStack` with Cognito User Pool
- Configure Apple Sign-In as federated identity provider
- Configure email/password sign-up
- Create `ApiStack` with Lambda + API Gateway + JWT authorizer
- Implement `GET /users/me` with JIT provisioning
- Test auth flow with curl / Postman

### Phase 3: Groups & Invites
- Implement group CRUD routes (`POST /groups`, `GET /groups/{id}`, `PATCH /groups/{id}`)
- Implement group membership (`DELETE /groups/{id}/members/me`)
- Implement invite flow (`POST /invites`, `GET /invites`, `DELETE /invites`, `POST /invites/{token}/accept`)
- Add `group-member` and `group-creator` middleware

### Phase 4: Preferences
- Implement `PUT /groups/{id}/preferences` and `GET /groups/{id}/preferences`
- Add Zod validation for genre lists and content rating
- Test preference aggregation logic

### Phase 5: Suggestions & Rounds
- Implement TMDB API client with DynamoDB caching (`TmdbCache` table)
- Implement recommendation algorithm (ADR-0003)
- Implement `POST /groups/{id}/rounds` (generate suggestions + create round)
- Implement `GET /rounds/{id}` and `PATCH /rounds/{id}` (close round)
- Test with various preference combinations

### Phase 6: Voting & Picks
- Implement `POST /rounds/{id}/votes` with idempotent upsert
- Implement `GET /rounds/{id}/results` with ranking logic
- Implement `POST /rounds/{id}/pick` with conditional write
- Implement `PATCH /picks/{id}` (mark watched) and `GET /groups/{id}/picks` (history)

### Phase 7: Ratings & Notifications
- Implement `POST /picks/{id}/ratings`
- Create `NotificationsStack` with SNS platform application
- Implement push notification sending for: round started, pick announced, vote nudge
- Register device tokens via `PATCH /users/me`

### Phase 8: Polish & Hardening
- Implement `DELETE /users/me` (account deletion with cascading cleanup)
- Implement `POST /account/child-profiles`
- Implement `GET /movies/{id}` (detailed movie info endpoint)
- Create `MonitoringStack` (CloudWatch dashboard, error alarms)
- Add integration tests
- Deploy to prod environment

---

## Deployment Commands

```bash
# Install dependencies
cd backend && npm install

# Synthesize CloudFormation templates (preview)
npx cdk synth --context env=dev

# Preview changes
npx cdk diff --context env=dev

# Deploy all stacks
npx cdk deploy --all --context env=dev

# Deploy to production
npx cdk deploy --all --context env=prod

# Run tests
npm test

# Bundle and test Lambda locally
npm run build && node dist/index.js
```
