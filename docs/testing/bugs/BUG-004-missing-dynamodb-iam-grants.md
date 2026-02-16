# BUG-004: Lambda missing DynamoDB IAM grants for Groups, GroupMemberships, and Invites tables

**Severity:** Critical (deployment blocker)
**Component:** backend/cdk/lib/api-stack.ts
**Status:** Open
**Found by:** Tester — test review for feat/task-03-group

## Description

The API stack only grants `grantReadWriteData` on the Users table (line 48). The Lambda environment variables reference the Groups, GroupMemberships, and Invites tables, but the handler has no IAM permissions to read/write them.

## Repro

Deploy the stack and call any group endpoint (e.g., `POST /groups`). The Lambda will fail with an `AccessDeniedException` from DynamoDB.

## Expected

Lambda has read/write permissions on all tables it accesses: Users, Groups, GroupMemberships, and Invites.

## Actual

Only `dataStack.usersTable.grantReadWriteData(this.handler)` is called. Missing:
- `dataStack.groupsTable.grantReadWriteData(this.handler)`
- `dataStack.groupMembershipsTable.grantReadWriteData(this.handler)`
- `dataStack.invitesTable.grantReadWriteData(this.handler)`

## Suggested Fix

Add the three missing `grantReadWriteData` calls in `api-stack.ts` after line 48:

```typescript
dataStack.groupsTable.grantReadWriteData(this.handler);
dataStack.groupMembershipsTable.grantReadWriteData(this.handler);
dataStack.invitesTable.grantReadWriteData(this.handler);
```

## Impact

All group and invite API endpoints will fail at runtime with 500 errors. Unit/route tests pass because they mock DynamoDB — this bug is only caught during integration/deployment testing.
