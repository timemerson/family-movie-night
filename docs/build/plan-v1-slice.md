# V1 Vertical Slice Plan

Target slice: Auth -> Create/Join Family Group -> Preferences -> Suggestions.

## Milestones
1) Repo + CI + IaC scaffold — **done** (PR #1/#2)
2) Auth working end-to-end — **done** (PR #5)
3) Group create/join — **done** (PR #6)
4) Preferences + watched history (minimal) — **done** (PR #8, #9, #10)
5) Suggestions (v1 algorithm) + UI — **done** (PR #11)

## Post-Vertical-Slice Progress

| Slice | Scope | Status |
|---|---|---|
| **Slice A** | Watchlists + Movie Details + Mark Watched | **done** |
| **Slice B** | Tonight Queue + Voting + Select Winner | **done** (PR #17, #18) |
| **Slice C** | Multi-User Household / Member Model | **up next** — see [plan-slice-c-multi-user.md](plan-slice-c-multi-user.md) |

## Definition of Done (per task)
- Code merged to main via PR
- Tests added/updated (service + route + CDK as applicable)
- All existing tests still pass (`vitest run`)
- CDK synth passes
- Runbook updated if needed
- No secrets committed
- Follow-up items documented in backlog if scope was reduced

## Current State (2026-02-21)

The initial vertical slice (milestones 1–5) and Slices A and B are complete. The core loop — auth, household creation, preferences, suggestions, watchlists, movie details, voting rounds, and pick lock-in — is fully functional end-to-end. Slice C (multi-user household model with managed members, profile switching, attendee selection, ratings, and session history) is up next. See [pr-sequence.md](pr-sequence.md) for build order and [backlog.md](backlog.md) for outstanding follow-ups.
