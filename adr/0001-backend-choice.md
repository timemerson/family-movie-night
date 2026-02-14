# ADR-0001: Backend Stack — AWS Serverless

**Status:** Accepted
**Date:** 2026-02-14
**Deciders:** Project team

## Context

The app needs a backend to store user data, manage groups, run the suggestion algorithm, and send push notifications. The product spec (OQ-15) lists four candidates: Firebase, Supabase, CloudKit, and a custom API. A primary non-functional goal is **learning AWS patterns** — the developer wants hands-on experience with canonical AWS services.

### Options Evaluated

| Criterion | Firebase | Supabase | CloudKit | AWS Serverless |
|---|---|---|---|---|
| **Learning value** | Firebase-specific (GCP, not transferable) | PostgreSQL skills transfer; limited infra learning | Apple-only; not transferable | High — IAM, Lambda, DynamoDB, API Gateway, CDK are resume-grade skills |
| **Serverless / managed** | Yes (fully managed) | Yes (managed Postgres + Edge Functions) | Yes (fully managed) | Yes (Lambda + DynamoDB = zero servers) |
| **Cost at v1 scale** | Free tier covers it | Free tier covers it | Free (2 GB public, 10 GB private) | Free tier covers it (see aws-plan.md) |
| **iOS integration** | Good (Firebase SDK) | Decent (REST + swift client) | Best (native CloudKit framework) | REST-based; standard URLSession / Alamofire |
| **Flexibility** | Limited to Firebase paradigms | Good (Postgres is flexible) | Limited to Apple ecosystem | Full control over API shape, data model, and deployment |
| **Auth** | Firebase Auth (mature) | GoTrue (Supabase Auth) | Apple ID only | Cognito (Apple Sign-In + email/password) |
| **Push notifications** | FCM | Third-party needed | CloudKit subscriptions (limited) | SNS + APNs |
| **Real-time** | Firestore listeners | Postgres LISTEN/NOTIFY + Realtime | CKSubscription | Not needed for v1 (polling is fine) |

## Decision

**Use AWS Serverless:** API Gateway (HTTP API) + Lambda (Node.js/TypeScript, single function with Hono router) + DynamoDB (multi-table, on-demand) + Cognito + SNS + CDK for IaC.

### Rationale

1. **Learning value is the primary goal.** AWS skills (IAM policies, Lambda cold starts, DynamoDB data modeling, CDK constructs) are directly transferable to professional work. Firebase/CloudKit knowledge is narrower.
2. **Serverless matches the scale.** With 2–8 users per group, Lambda + DynamoDB on-demand pricing means near-zero cost — well within AWS Free Tier for the first 12 months.
3. **Full control.** A REST API with explicit endpoints is easier to reason about and debug than Firestore's client-side query model or CloudKit's opaque syncing.
4. **CDK for IaC.** Infrastructure-as-code in TypeScript (same language as the Lambda) is a valuable skill and ensures reproducible deployments.

### Why Not the Others?

- **Firebase:** Great DX, but the learning transfers poorly outside Google's ecosystem. Firestore's data model (document/subcollection) would also fight against some of our access patterns (e.g., "all votes in a round across users").
- **Supabase:** Strong choice technically (Postgres is excellent), but offers less infra-level learning. The managed service abstracts away the things the developer wants to learn.
- **CloudKit:** Tightest iOS integration, but locks out non-Apple clients forever and offers almost no transferable backend knowledge. Limited query flexibility for the suggestion algorithm.

## Consequences

### Positive

- Developer gains practical AWS experience across 6+ services.
- Full control over API design, auth flow, and data model.
- Free tier covers all v1 costs (see `/docs/architecture/aws-plan.md` for details).
- CDK enables reproducible, version-controlled infrastructure.
- Easy to add services later (S3, SQS, Step Functions) as needs grow.

### Negative

- More boilerplate than Firebase/Supabase (auth setup, IAM policies, API Gateway config).
- Cognito has rough edges (limited UI customization, confusing token flows) — mitigated by using it as a headless JWT issuer behind Apple Sign-In.
- No built-in real-time sync — not needed for v1, but would require WebSocket API Gateway or AppSync if added later.
- DynamoDB requires upfront access pattern design — mitigated by multi-table design (see ADR discussion in data-model.md).

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Cognito complexity delays auth implementation | Medium | Use minimal Cognito config: Apple Sign-In federation + email/password. No hosted UI, no advanced flows. |
| DynamoDB access patterns prove insufficient | Low | Multi-table design is forgiving; can add GSIs. Worst case, migrate to Aurora Serverless v2. |
| Cold start latency on Lambda | Low | Single function stays warm with regular traffic. Provisioned concurrency available if needed (~$0). |
| AWS Free Tier expires after 12 months | Certain | At v1 scale, post-free-tier costs are <$5/month. Budget is not a concern. |
