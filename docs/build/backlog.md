# Backlog — V1 Vertical Slice

Use this as a lightweight issue tracker. Move tasks through states as work progresses.

## States

| Label | Meaning |
|-------|---------|
| `ready` | All dependencies met, can start |
| `in-progress` | Currently being worked on |
| `needs-review` | PR open, awaiting review |
| `blocked` | Waiting on a dependency or decision |
| `done` | Merged to main |

## Labels

| Label | Meaning |
|-------|---------|
| `backend` | Backend TypeScript / Lambda |
| `infra` | CDK / AWS infrastructure |
| `ios` | iOS / SwiftUI |
| `ci` | CI/CD pipeline |

---

## M0 — Backend Scaffold + CI

- [ ] **(ready)** `infra` `backend` **T01** — Initialize backend project (package.json, TS config, Hono hello-world)
- [ ] **(ready)** `infra` **T02** — CDK app + DataStack (DynamoDB tables + GSIs)
- [ ] **(blocked→T02)** `infra` **T03** — AuthStack (Cognito User Pool + Apple Sign-In placeholder)
- [ ] **(blocked→T02,T03)** `infra` **T04** — ApiStack (Lambda + API Gateway + JWT authorizer)
- [ ] **(blocked→T01)** `ci` **T05** — CI pipeline for backend (lint → test → cdk synth)

## M1 — Auth End-to-End

- [ ] **(blocked→T01)** `backend` **T06** — DynamoDB client + typed table helpers
- [ ] **(blocked→T04,T06)** `backend` **T07** — GET /users/me with JIT provisioning
- [ ] **(blocked→T07)** `backend` **T08** — PATCH /users/me (display name, avatar)

## M2 — Groups + Invites

- [ ] **(blocked→T07)** `backend` **T09** — POST /groups (create group + transact membership)
- [ ] **(blocked→T09)** `backend` **T10** — GET /groups/{id} + group-member middleware
- [ ] **(blocked→T10)** `backend` **T11** — PATCH /groups/{id} + group-creator middleware
- [ ] **(blocked→T10)** `backend` **T12** — Invite flow (create, accept, list, revoke)

## M3 — Preferences

- [ ] **(blocked→T10)** `backend` **T13** — PUT & GET /groups/{id}/preferences (Zod validation)

## M4 — Suggestions

- [ ] **(blocked→T06)** `backend` **T14** — TMDB API client with DynamoDB caching
- [ ] **(blocked→T13,T14)** `backend` **T15** — Recommendation algorithm (5-stage pipeline)
- [ ] **(blocked→T15)** `backend` **T16** — POST /groups/{id}/rounds + GET /rounds/{id}

## M5 — iOS Thin Slice

- [ ] **(ready)** `ios` **T17** — iOS project skeleton (Xcode, SwiftUI, navigation)
- [ ] **(blocked→T03,T17)** `ios` **T18** — iOS auth (Sign in with Apple + Cognito)
- [ ] **(blocked→T18)** `ios` **T19** — iOS API client (URLSession, Codable models, auth injection)
- [ ] **(blocked→T19,T09)** `ios` **T20** — Create Group + Group Home screens
- [ ] **(blocked→T20,T12)** `ios` **T21** — Invite flow (share sheet, deep link handling)
- [ ] **(blocked→T20,T13)** `ios` **T22** — Preferences screen (genre grid, content rating)
- [ ] **(blocked→T22,T16)** `ios` **T23** — Suggestions screen + Movie detail

---

## Dependency Graph

```
T01 ──┬── T05 (CI)
      ├── T06 ──┬── T07 ──┬── T08
      │         │         ├── T09 ── T10 ──┬── T11
      │         │         │                ├── T12
      │         │         │                └── T13
      │         └── T14 ──┘                     │
      │                    T15 ◀── T13 + T14    │
      │                    T16 ◀── T15          │
T02 ── T03 ── T04 ◀── T02 + T03                │
                                                │
T17 ── T18 ◀── T03    (iOS parallel track)      │
       T19 ◀── T18                              │
       T20 ◀── T19 + T09                        │
       T21 ◀── T20 + T12                        │
       T22 ◀── T20 + T13                        │
       T23 ◀── T22 + T16                        │
```

**Parallelism opportunities:**
- T01 (backend init) and T17 (iOS skeleton) can start simultaneously
- T02 and T03 are independent of each other (both depend on nothing)
- T05 (CI) can go in parallel with T06 once T01 is done
- T14 (TMDB client) can start as soon as T06 is done, parallel with T09–T12
- iOS track (T17–T23) runs in parallel with backend after T03 is done

---

## Progress Tracker

| Milestone | Total | Done | % |
|-----------|-------|------|---|
| M0 — Scaffold + CI | 5 | 0 | 0% |
| M1 — Auth | 3 | 0 | 0% |
| M2 — Groups + Invites | 4 | 0 | 0% |
| M3 — Preferences | 1 | 0 | 0% |
| M4 — Suggestions | 3 | 0 | 0% |
| M5 — iOS | 7 | 0 | 0% |
| **Total** | **23** | **0** | **0%** |
