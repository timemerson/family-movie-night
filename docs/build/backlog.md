# Backlog

Use this as a lightweight issue tracker if not using GitHub Issues yet.

## States (labels)
- ready
- in-progress
- needs-review
- needs-test
- blocked
- done

## Tasks

### Task 01 — Setup AWS dev environment + IaC skeleton
- [x] (done) Setup AWS dev environment + IaC skeleton
  - Merged 2026-02-15 (PR #1/#2). Delivered: 5 CDK stacks (Data, Auth, Api, Notifications, Monitoring), DynamoDB tables with GSIs, Hono Lambda skeleton (`/health`), error class hierarchy, CDK snapshot + assertion tests, CI workflow.

---

### Task 02 — iOS app skeleton + auth wiring
- [x] (done) iOS app skeleton + auth wiring
  - Merged 2026-02-15 (PR #5). Delivered: Cognito User Pool + Apple IdP federation, HTTP API Gateway with JWT Authorizer, `POST /auth/me` (JIT provisioning) + `DELETE /auth/account`, iOS project scaffold with Amplify Auth, Sign in with Apple + email/password flows, auth state management.

---

### Task 03 — Create/join family group
- [x] (done) Create/join family group
  - Merged 2026-02-16 (PR #6). Delivered: group CRUD (`POST /groups`, `GET /groups/:id`, `PATCH /groups/:id`), membership management (`GET /groups/me`, `DELETE /groups/:id/members/me` with creator promotion), invite flow (`POST /groups/:id/invites`, `GET /groups/:id/invites`, `DELETE /groups/:id/invites/:invite_id`, `POST /invites/:token/accept`), multi-use invites with 7-day TTL, atomic DynamoDB transactions, group-service + invite-service, comprehensive route + service tests.

---

### Task 04 — Preferences + watched history (minimal)
- [x] (done — partial) Preferences CRUD + iOS UI
  - Merged 2026-02-16 (PR #8). Delivered: preference model (Zod), preference-service (get/put), preference routes (GET/PUT `/groups/:id/preferences`), IAM grant for preferencesTable, preference service + route tests, iOS preferences UI (PreferencesView, ViewModel, Model).
- [ ] (ready) **04-A: Group preference summary endpoint** — P0, blocks Task 05
- [ ] (ready) **04-B: Pick model + watched history endpoints** — P0, blocks Task 05
- [ ] (ready) **04-C: Preference cleanup on group leave** — P1
- [ ] (ready) **04-D: TMDB genre ID validation** — P2

See [task-04-followups.md](task-04-followups.md) for full details on each follow-up.

---

### Task 05 — Suggestions endpoint + UI
- [ ] (blocked — waiting on 04-A + 04-B) Suggestions endpoint + UI
  - TMDB integration, suggestion algorithm, voting flow, iOS suggestion + voting UI
  - Blocked by: preference summary endpoint (04-A) and watched movie exclusion (04-B)

---

## Dependency Graph

```
04-A (pref summary) ──┐
                       ├──► Task 05 (suggestions)
04-B (picks/watched) ──┘

04-C (cleanup on leave) ──► independent, do anytime
04-D (genre validation) ──► independent, do anytime
```
