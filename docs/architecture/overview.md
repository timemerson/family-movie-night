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

## Core Loop Data Flow

This is the primary user journey through the system:

```
1. AUTHENTICATE
   iOS ──Apple Sign-In──▶ Cognito ──JWT──▶ iOS stores in Keychain

2. SET PREFERENCES
   iOS ──PUT /groups/{id}/preferences──▶ API GW ──▶ Lambda ──▶ DynamoDB (Preferences)

3. GET SUGGESTIONS
   iOS ──POST /groups/{id}/rounds──▶ Lambda
     Lambda ──▶ DynamoDB (Preferences) ── read group prefs
     Lambda ──▶ TMDB Discover API ── fetch candidates (or DynamoDB cache hit)
     Lambda ──▶ DynamoDB (Picks) ── exclude watched
     Lambda ──▶ TMDB Watch Providers ── streaming availability
     Lambda ──▶ Score & rank ── return top 5-8
     Lambda ──▶ DynamoDB (Rounds, Suggestions) ── persist round

4. VOTE
   iOS ──POST /rounds/{id}/votes──▶ Lambda ──▶ DynamoDB (Votes)

5. PICK
   iOS ──POST /rounds/{id}/pick──▶ Lambda
     Lambda ──▶ DynamoDB (Picks) ── create pick
     Lambda ──▶ SNS ──▶ APNs ── push "Tonight's movie: Title!"

6. WATCH & RATE
   iOS ──PATCH /picks/{id}──▶ Lambda ──▶ DynamoDB (Picks) ── mark watched
   iOS ──POST /picks/{id}/ratings──▶ Lambda ──▶ DynamoDB (Ratings)
```

## Key Architecture Decisions

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
