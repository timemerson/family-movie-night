# Architecture Overview

## System Context

Family Movie Night is an iOS app backed by an AWS serverless API. The iOS app communicates with a single REST API endpoint, which handles all business logic. External dependencies are TMDB (movie metadata) and Apple (authentication).

```
┌─────────────────────────────────────────────────────────────┐
│                        iOS App                              │
│  (SwiftUI, URLSession, Keychain)                            │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS (REST/JSON)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    AWS Cloud                                 │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │ API Gateway   │──▶│   Lambda     │──▶│   DynamoDB     │  │
│  │ (HTTP API)    │   │ (Hono/TS)   │   │  (10+ tables)  │  │
│  │ JWT Authorizer│   │              │──▶│                │  │
│  └──────────────┘   │              │   └────────────────┘  │
│                      │              │                       │
│  ┌──────────────┐   │              │   ┌────────────────┐  │
│  │   Cognito     │◀──│              │──▶│     SNS        │  │
│  │ (User Pool)   │   │              │   │  (APNs push)   │  │
│  └──────────────┘   └──────────────┘   └────────────────┘  │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐                       │
│  │  CloudWatch   │   │  Parameter   │                       │
│  │ (Logs/Metrics)│   │   Store     │                       │
│  └──────────────┘   └──────────────┘                       │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼ HTTPS
              ┌─────────────────────┐
              │    TMDB API          │
              │ (Movie metadata,     │
              │  watch providers)    │
              └─────────────────────┘
```

## Component Table

| Component | AWS Service | Purpose | Free Tier Coverage |
|---|---|---|---|
| **API Gateway** | HTTP API (v2) | Routes HTTPS requests to Lambda; JWT authorization | 1M requests/month for 12 months |
| **Lambda** | Lambda (Node.js 20, arm64) | All business logic — single function with Hono router | 1M invocations + 400K GB-s/month (always free) |
| **DynamoDB** | DynamoDB (on-demand) | All application data — multi-table design | 25 GB storage + 25 RCU/WCU (always free) |
| **Cognito** | Cognito User Pools | Authentication — Apple Sign-In + email/password | 50K MAU (always free) |
| **SNS** | SNS (Mobile Push) | Push notifications via APNs | 1M mobile pushes/month (always free) |
| **CloudWatch** | CloudWatch Logs + Metrics | Logging, error tracking, basic dashboards | 5 GB logs, 10 metrics (always free) |
| **Parameter Store** | SSM Parameter Store | Secrets storage (TMDB API key, APNs certs) | Standard params free (always free) |
| **CDK** | CloudFormation (via CDK) | Infrastructure-as-code | Free (you pay only for provisioned resources) |

## Identity Model

A household contains 2–8 **members**, each of which is one of two types:

- **Independent member** — Has their own Cognito account and signs in on their own device. Cannot be impersonated on other devices.
- **Managed member** — No Cognito account. Created by a household admin. Accessible from any device logged into the household.

On a given device, the authenticated Cognito user can **switch active profile** to any managed member they control. The iOS app sends an `X-Acting-As-Member` header on API requests when acting as a managed member. The backend validates that the acting member is managed and owned by the caller.

Managed members use synthetic user IDs (`managed_<uuid>`) that are distinct from Cognito sub UUIDs.

## Core Loop Data Flow

This is the primary user journey through the system:

```
1. AUTHENTICATE
   iOS ──Apple Sign-In──▶ Cognito ──JWT──▶ iOS stores in Keychain

2. SWITCH PROFILE (optional)
   iOS ──ProfileSessionManager──▶ sets activeProfile to managed member
   Subsequent API calls include X-Acting-As-Member header

3. SET PREFERENCES
   iOS ──PUT /groups/{id}/preferences──▶ API GW ──▶ Lambda ──▶ DynamoDB (Preferences)
   (Supports ?member_id= query param for managed member preferences)

4. SELECT ATTENDEES & GET SUGGESTIONS
   iOS ──POST /groups/{id}/rounds──▶ Lambda
     Request includes attendees[] (subset of household members, default all)
     Lambda ──▶ DynamoDB (Preferences) ── read attendee prefs only
     Lambda ──▶ TMDB Discover API ── fetch candidates (or DynamoDB cache hit)
     Lambda ──▶ DynamoDB (Picks, WatchedMovies) ── exclude watched
     Lambda ──▶ TMDB Watch Providers ── streaming availability
     Lambda ──▶ Score & rank ── return top 5-8
     Lambda ──▶ DynamoDB (Rounds, Suggestions) ── persist round with attendees

5. VOTE
   iOS ──POST /rounds/{id}/votes──▶ Lambda ──▶ DynamoDB (Votes)
   Vote attributed to active member_id (authenticated user or managed member)
   Vote progress denominator = attendees.count (not all members)

6. PICK
   iOS ──POST /rounds/{id}/pick──▶ Lambda
     Lambda ──▶ DynamoDB (Picks) ── create pick
     Lambda ──▶ SNS ──▶ APNs ── push "Tonight's movie: Title!"

7. WATCH & RATE
   iOS ──PATCH /rounds/{id}/status──▶ Lambda ──▶ DynamoDB (Rounds) ── transition to watched
   iOS ──POST /rounds/{id}/ratings──▶ Lambda ──▶ DynamoDB (Ratings)
   Rating scale: Loved / Liked / Did Not Like (per attending member)
```

### Session Lifecycle

A movie night session (round) has a state machine:

```
draft → voting → selected → watched → rated → expired
```

- `draft` — Session created, attendees selected, suggestions not yet generated.
- `voting` — Suggestions visible, async votes being cast.
- `selected` — Winning movie chosen (pick locked in).
- `watched` — Movie marked as watched.
- `rated` — Post-watch ratings completed by attendees (auto-transitions when all rate, or creator can close ratings manually).
- `expired` — No selection within expiration window (automated expiration deferred to post-v1).

## Key Architecture Decisions

### Independent vs. Managed Member Identity

**Chose: Synthetic user IDs for managed members (`managed_<uuid>`) within the existing Users table.**

Managed members are stored as `User` records with `is_managed: true` and a `parent_user_id` linking to the Cognito user who controls them. This avoids introducing a separate `Member` entity, keeping the existing Users/GroupMemberships tables as the single identity layer. The trade-off is that `user_id` no longer always maps to a Cognito sub — but the `managed_` prefix makes this unambiguous.

The `X-Acting-As-Member` header on API requests enables delegated identity. The auth middleware validates ownership before allowing actions on behalf of a managed member.

### Anyone Can Start a Session

**Chose: Any household member can create a round (removed creator-only restriction).**

The updated product brief specifies that "anyone can create a movie night session." Pick confirmation remains creator-only to maintain a single decision-maker for the final selection.

### Single Lambda vs. One-Per-Endpoint

**Chose: Single Lambda with Hono router.**

A single function keeps the deployment simple (one artifact, one cold start pool) and Hono provides Express-like routing with minimal overhead. At v1 scale (tens of requests per hour), there's no benefit to splitting functions. If individual routes need different memory/timeout settings later, they can be extracted.

### DynamoDB vs. RDS (Aurora Serverless)

**Chose: DynamoDB (multi-table, on-demand).**

DynamoDB's on-demand pricing means zero cost at low traffic, and the always-free tier covers v1 entirely. The app's access patterns are key-value lookups by known IDs — a natural fit for DynamoDB. The multi-table design (one table per entity) trades single-table-design efficiency for approachability and learnability. See `/docs/architecture/data-model.md` for the full schema.

RDS Aurora Serverless v2 was considered but rejected: it has a minimum charge (~$40/month), requires VPC configuration, and the relational model doesn't offer meaningful advantages for this app's data patterns.

### Cognito Rough Edges

Cognito is the weakest link in the stack. Known pain points:

- **Confusing token types** (ID token vs. access token vs. refresh token). Mitigation: use access tokens for API auth consistently.
- **Limited customization** of built-in flows (verification emails, error messages). Mitigation: use Cognito headlessly — all UI is in the iOS app.
- **Apple Sign-In federation requires careful setup** (Service ID, key rotation). Mitigation: document the setup steps in the CDK stack.

Despite these, Cognito is the right choice: it's free up to 50K MAU, integrates natively with API Gateway's JWT authorizer, and avoids building custom auth.

### HTTP API vs. REST API (API Gateway)

**Chose: HTTP API (v2).**

HTTP API is cheaper (50% less), lower latency, and has a built-in JWT authorizer that validates Cognito tokens without a custom Lambda authorizer. REST API's extra features (request validation, API keys, usage plans) aren't needed for v1.

## Cross-References

- **API endpoints:** `/docs/architecture/api.md`
- **Data model:** `/docs/architecture/data-model.md`
- **Auth flow:** `/adr/0002-auth.md`
- **Recommendation algorithm:** `/adr/0003-recommendations-v1.md`
- **Sync/offline strategy:** `/docs/architecture/sync-and-offline.md`
- **AWS deployment plan:** `/docs/architecture/aws-plan.md`
- **Backend choice rationale:** `/adr/0001-backend-choice.md`
