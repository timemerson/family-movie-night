# V1 Vertical Slice Plan

Target slice: Auth -> Create/Join Family Group -> Preferences -> Suggestions.

## Milestones
1) Repo + CI + IaC scaffold — **done** (PR #1/#2)
2) Auth working end-to-end — **done** (PR #5)
3) Group create/join — **done** (PR #6)
4) Preferences + watched history (minimal) — **partial** (PR #8: CRUD + iOS UI)
   - 04-A: Group preference summary endpoint (P0, blocks Task 05)
   - 04-B: Pick model + watched history endpoints (P0, blocks Task 05)
   - 04-C: Preference cleanup on group leave (P1)
   - 04-D: TMDB genre ID validation (P2)
5) Suggestions (v1 algorithm) + UI — blocked on 04-A + 04-B

## Definition of Done (per task)
- Code merged to main via PR
- Tests added/updated (service + route + CDK as applicable)
- All existing tests still pass (`vitest run`)
- CDK synth passes
- Runbook updated if needed
- No secrets committed
- Follow-up items documented in backlog if scope was reduced

## Current State (2026-02-16)

The vertical slice is through milestone 4 (partial). Two P0 follow-ups (preference summary + picks/watched) must land before Task 05 can begin. See [task-04-followups.md](task-04-followups.md) for details and [pr-sequence.md](pr-sequence.md) for build order.
