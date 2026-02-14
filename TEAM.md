# Team Workflow (Agentic)

## Roles
- Planner: produces build plan + tasks. No code changes.
- Builder: implements tasks on feature branches and opens PRs.
- Reviewer: reviews PR diffs for correctness, quality, security.
- Tester: runs tests, adds missing tests, files bugs.

## Gates
1) Product gate: /docs/product/* exists and is coherent.
2) Architecture gate: /docs/architecture/* + ADRs exist.
3) Build gate: CI runs lint + tests on every PR.
4) Test gate: test plan exists + smoke tests run locally.

## Branching
- main: always green
- feat/<short-desc>: feature branches
- fix/<short-desc>: bugfix branches
- review/<pr-desc>: optional reviewer patch branch

## PR Rules
- Keep PRs small (1 task or a tight vertical slice increment).
- No secrets committed. Ever.
- Update docs/ADRs when behavior changes.
- Include tests with new behavior.

## Handoff Format (required in PR description)
- Artifacts updated:
- Assumptions made:
- Open questions:
- Next actions:
