# Test Report: Task 03 — Group Create/Join Flow

**Date:** 2026-02-16
**Branch:** feat/task-03-group
**Tester:** Claude (Tester role)
**Verdict:** **PASS** (with 1 critical bug to fix before deploy)

---

## 1. Test Suite Results

| Suite | Before | After | Status |
|-------|--------|-------|--------|
| Full backend | 89 passing | 102 passing | All green |
| group routes | 13 tests | 26 tests | +13 new |
| group service | 18 tests | 18 tests | Unchanged (already thorough) |
| invite service | 10 tests | 10 tests | Unchanged (already thorough) |
| integration | 13 tests | 13 tests | Unchanged |

## 2. Acceptance Criteria Validation

### US-03: Create a family group (P0)

| AC | Status | Evidence |
|----|--------|----------|
| Group name required (max 40 chars) | PASS | Zod schema `min(1).max(40)`, route tests for empty, 40-char, and 41-char boundary |
| Creator auto-added as first member | PASS | `createGroup()` uses atomic TransactWriteCommand; route test asserts `members[0].role === "creator"` |
| User taken to group home screen | N/A | iOS concern; backend returns full group with members in 201 response |

### US-05: Invite via share link (P0)

| AC | Status | Evidence |
|----|--------|----------|
| Universal Link opens app | N/A | iOS concern |
| Accepting link adds user after sign-in | PASS | `POST /invites/:token/accept` — validates invite, enforces one-group-per-user, adds via transaction |
| Link expires after 7 days | PASS | `validateInvite()` checks `expires_at`; route tests for expired (410) |
| Group cap (8 members) | PASS | `addMember()` transaction enforces `member_count < 8`; route test for full group (409) |

### US-07: See pending invites (P1)

| AC | Status | Evidence |
|----|--------|----------|
| List shows pending invites | PASS | `GET /groups/:id/invites` filters by status=pending; new route test added |
| Revoking invalidates link | PASS | `DELETE /groups/:id/invites/:id` sets status=revoked; `validateInvite` rejects revoked; route tests added |

### US-22: Leave a group (P1)

| AC | Status | Evidence |
|----|--------|----------|
| Confirmation dialog | N/A | iOS concern |
| Preferences removed | N/A | Preferences feature is milestone 4 — expected gap |
| Creator succession | PASS | `leaveGroup()` promotes longest-tenured member via transaction; service tests cover single/multi member scenarios |

## 3. Failure Mode Coverage

| Scenario | Expected | Tested | Result |
|----------|----------|--------|--------|
| Invalid invite token | 404 | NEW | Pass |
| Expired invite | 410 | Existing | Pass |
| Revoked invite | 410 | NEW | Pass |
| Already in a group (create) | 409 | Existing | Pass |
| Already in a group (join) | 409 | Existing | Pass |
| Group full (join) | 409 | NEW | Pass |
| Non-member accesses group | 403 | Existing | Pass |
| Non-creator creates invite | 403 | Existing | Pass |
| Non-creator lists invites | 403 | NEW | Pass |
| Non-creator revokes invite | 403 | NEW | Pass |
| Non-creator updates group | 403 | NEW | Pass |
| Non-member leaves group | 404 | NEW | Pass |
| Invalid group name (empty) | 400 | Existing | Pass |
| Invalid group name (41 chars) | 400 | NEW | Pass |
| Invalid update payload | 400 | NEW | Pass |
| Accept invite for deleted group | 404 | Verified in code review | Pass (getGroup throws NotFoundError) |

## 4. Bugs Filed

### BUG-004: Missing DynamoDB IAM grants (CRITICAL)

**File:** `docs/testing/bugs/BUG-004-missing-dynamodb-iam-grants.md`

`api-stack.ts` only grants `grantReadWriteData` on the Users table. The Groups, GroupMemberships, and Invites tables have no IAM permissions. All group/invite endpoints will fail with `AccessDeniedException` at deploy time.

**Must fix before deploy.** Unit tests pass because DynamoDB is mocked.

## 5. Minor Observations (not bugs)

- **PATCH with no JSON body** returns 500 instead of 400 (Hono's `c.req.json()` throws a generic error). Low priority — all clients will send JSON.
- **Multi-use invites** are intentional (confirmed via code comment in `invite-service.ts:103`). Same invite link works for multiple users until expired, revoked, or group full.
- **BUG-001 (lint no-op)** remains open from previous milestone.
- **BUG-003 (iOS auth stubs)** remains open — expected for this milestone.

## 6. Definition of Done Checklist

| Criterion | Status |
|-----------|--------|
| Code merged to main via PR | Pending (branch ready) |
| Tests added/updated | PASS — 13 new route tests covering all failure modes |
| Runbook updated if needed | N/A |
| No secrets committed | PASS — no secrets found in diff |

## 7. Verdict

**PASS** — The group create/join flow correctly implements all backend acceptance criteria for US-03, US-05, US-07, and US-22. Authorization, validation, atomic transactions, and error handling are solid. Test coverage is now comprehensive at both service and route layers.

**Blocker for deploy:** BUG-004 (missing IAM grants) must be fixed before the stack can be deployed. This is a 3-line CDK fix.
