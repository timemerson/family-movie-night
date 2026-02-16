# BUG-001: `make lint` is a no-op

**Severity:** Low (DoD gap)
**Component:** Makefile / CI
**Status:** Open
**Found by:** Tester — PR review for feat/task-02-auth

## Repro

```bash
make lint
```

## Expected

Linter runs (e.g. ESLint for backend TypeScript, SwiftLint for iOS) and reports errors/warnings.

## Actual

Outputs `TODO: implement lint` and exits 0. No linting is performed.

## Impact

- DoD requires "no secrets committed" — a lint step with `eslint-plugin-no-secrets` or a pre-commit hook would help enforce this.
- CI (`ci.yml`) does not include a lint step either, so malformed code could be merged.

## Suggested Fix

1. Add ESLint to `backend/package.json` devDependencies.
2. Configure `.eslintrc` or `eslint.config.js` with TypeScript rules.
3. Update Makefile `lint` target to run `cd backend && npx eslint src/ test/`.
4. Add a lint step to `.github/workflows/ci.yml`.
