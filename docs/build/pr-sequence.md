# PR Sequence — V1 Vertical Slice

Recommended merge order. Each PR maps to one task. PRs within the same wave can be merged in any order (no dependencies between them).

---

## Wave 1 — Foundation (no dependencies)

| PR | Task | Branch | What merges |
|----|------|--------|-------------|
| PR-1 | T01 | `feat/backend-init` | backend/ project skeleton, Hono hello-world, eslint |
| PR-2 | T02 | `feat/data-stack` | CDK app + DataStack (8 DynamoDB tables, 8 GSIs) |
| PR-3 | T17 | `feat/ios-skeleton` | Xcode project, SwiftUI app shell, navigation stack |

**Gate:** All three merge before Wave 2.

---

## Wave 2 — Infra + Shared Libraries

| PR | Task | Branch | Depends on | What merges |
|----|------|--------|------------|-------------|
| PR-4 | T03 | `feat/auth-stack` | PR-2 | Cognito User Pool + Apple IdP placeholder |
| PR-5 | T05 | `feat/backend-ci` | PR-1 | GitHub Actions: lint → test → cdk synth |
| PR-6 | T06 | `feat/dynamo-helpers` | PR-1 | DynamoDB document client wrapper + helpers |

**Gate:** PR-4 merges before Wave 3 (ApiStack needs it). PR-6 merges before any route handler PR.

---

## Wave 3 — API Gateway + Auth Route

| PR | Task | Branch | Depends on | What merges |
|----|------|--------|------------|-------------|
| PR-7 | T04 | `feat/api-stack` | PR-2, PR-4 | Lambda + API Gateway + JWT authorizer |
| PR-8 | T07 | `feat/users-me` | PR-6, PR-7 | GET /users/me with JIT provisioning |

**Note:** PR-7 and PR-8 are sequential — PR-8 needs the ApiStack to define Lambda env vars. However, PR-8's route handler code can be developed in parallel with PR-7 by mocking env vars in tests.

---

## Wave 4 — User Profile + Groups (backend) + iOS Auth

| PR | Task | Branch | Depends on | What merges |
|----|------|--------|------------|-------------|
| PR-9 | T08 | `feat/users-patch` | PR-8 | PATCH /users/me |
| PR-10 | T09 | `feat/create-group` | PR-8 | POST /groups (transact write) |
| PR-11 | T18 | `feat/ios-auth` | PR-3, PR-4 | iOS Sign in with Apple + Cognito SDK |
| PR-12 | T14 | `feat/tmdb-client` | PR-6 | TMDB API client + DynamoDB caching |

**Parallelism:** All four PRs are independent of each other. PR-12 (TMDB client) can proceed on its own track since it only depends on the DynamoDB helpers.

---

## Wave 5 — Group Details + Invites + iOS API Client

| PR | Task | Branch | Depends on | What merges |
|----|------|--------|------------|-------------|
| PR-13 | T10 | `feat/get-group` | PR-10 | GET /groups/{id} + group-member middleware |
| PR-14 | T19 | `feat/ios-api-client` | PR-11 | URLSession client, Codable models, auth injection |

---

## Wave 6 — Group Management + Preferences + iOS Screens

| PR | Task | Branch | Depends on | What merges |
|----|------|--------|------------|-------------|
| PR-15 | T11 | `feat/patch-group` | PR-13 | PATCH /groups/{id} + group-creator middleware |
| PR-16 | T12 | `feat/invites` | PR-13 | Invite CRUD: create, accept, list, revoke |
| PR-17 | T13 | `feat/preferences` | PR-13 | PUT & GET preferences with Zod validation |
| PR-18 | T20 | `feat/ios-group-home` | PR-14, PR-10 | Create Group + Group Home screens |

**Parallelism:** PR-15, PR-16, PR-17 are independent of each other (all depend on PR-13). PR-18 depends on both the iOS API client and the create-group backend endpoint.

---

## Wave 7 — Recommendation Engine + iOS Invite/Prefs

| PR | Task | Branch | Depends on | What merges |
|----|------|--------|------------|-------------|
| PR-19 | T15 | `feat/recommendations` | PR-17, PR-12 | 5-stage recommendation pipeline |
| PR-20 | T21 | `feat/ios-invites` | PR-18, PR-16 | iOS invite share sheet + deep links |
| PR-21 | T22 | `feat/ios-preferences` | PR-18, PR-17 | iOS genre grid + content rating picker |

---

## Wave 8 — Rounds + iOS Suggestions (slice complete)

| PR | Task | Branch | Depends on | What merges |
|----|------|--------|------------|-------------|
| PR-22 | T16 | `feat/rounds` | PR-19 | POST /groups/{id}/rounds + GET /rounds/{id} |
| PR-23 | T23 | `feat/ios-suggestions` | PR-21, PR-22 | Suggestion list + movie detail screen |

**Gate:** PR-23 merging completes the V1 vertical slice.

---

## Summary

```
Wave 1:  PR-1   PR-2   PR-3                          (3 PRs, parallel)
Wave 2:  PR-4   PR-5   PR-6                          (3 PRs, parallel)
Wave 3:  PR-7 → PR-8                                 (2 PRs, sequential)
Wave 4:  PR-9   PR-10  PR-11  PR-12                  (4 PRs, parallel)
Wave 5:  PR-13  PR-14                                 (2 PRs, parallel)
Wave 6:  PR-15  PR-16  PR-17  PR-18                  (4 PRs, parallel)
Wave 7:  PR-19  PR-20  PR-21                          (3 PRs, parallel)
Wave 8:  PR-22 → PR-23                               (2 PRs, sequential)
                                                ──────────────────
                                                Total: 23 PRs in 8 waves
```

**Critical path:** T01 → T06 → T07 → T09 → T10 → T13 → T15 → T16 → T23

This is the longest chain (9 tasks). Everything else can be parallelized around it.

---

## Branch Naming Convention

```
feat/<feature-name>    — new functionality
fix/<bug-name>         — bug fixes
chore/<task>           — CI, config, refactoring
```

All branches are based off `main`. Merge via squash-and-merge to keep history linear.
