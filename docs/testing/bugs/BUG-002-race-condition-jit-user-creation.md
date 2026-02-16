# BUG-002: Race condition in JIT user creation (FIXED in this PR)

**Severity:** Medium
**Component:** backend/src/services/user-service.ts
**Status:** Fixed
**Found by:** Tester — PR review for feat/task-02-auth

## Repro

Two concurrent `GET /users/me` requests from the same new user hit the backend at the same time:
1. Both read DynamoDB and find no existing user (GetCommand returns empty).
2. Both attempt PutCommand with `ConditionExpression: "attribute_not_exists(user_id)"`.
3. One succeeds; the other throws `ConditionalCheckFailedException`.
4. The failing request returns a 500 Internal Server Error.

## Expected

Both requests succeed. The second request should catch the `ConditionalCheckFailedException`, re-fetch the user, and return it.

## Actual (before fix)

The `ConditionalCheckFailedException` propagated uncaught, causing a 500 error.

## Fix Applied

Added try/catch around PutCommand in `getOrCreateUser()`. On `ConditionalCheckFailedException`, the service re-fetches the user and returns it. Test added in `test/services/user-service.test.ts`.
