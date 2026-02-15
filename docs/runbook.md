# Runbook

## Repo Layout
- `backend/`        — Backend: Lambda (Hono/TS) + CDK IaC
  - `src/`          — Lambda application code
  - `cdk/`          — CDK stacks (Data, Auth, Api, Notifications, Monitoring)
  - `test/`         — Vitest tests (routes, services, CDK assertions)
- `ios/`            — iOS app (Xcode/SwiftUI) — not yet created
- `docs/`           — Product specs + architecture docs
- `adr/`            — Architecture decision records

## Prerequisites
- Node.js 20+ (`brew install node`)
- AWS CDK CLI (installed as devDep, used via `npx cdk`)

## Setup
```bash
make setup          # runs npm ci in backend/
```

## Common Commands
```bash
make help           # list all targets
make test           # run all tests (backend + CDK assertions)
make lint           # run ESLint
make fmt            # check Prettier formatting
make fmt-fix        # auto-fix formatting
make synth          # synthesize CDK CloudFormation templates
make build          # bundle Lambda with esbuild
```

## Running Individual Commands
```bash
cd backend
npx vitest run                              # run tests
npx vitest                                  # run tests in watch mode
npx eslint . --ext .ts                      # lint
npx prettier --check '**/*.ts'              # format check
npx prettier --write '**/*.ts'              # format fix
cd cdk && npx cdk synth --context env=dev   # synthesize stacks
cd cdk && npx cdk diff --context env=dev    # preview changes
cd cdk && npx cdk deploy --all --context env=dev  # deploy to dev
```

## CI
GitHub Actions runs on every PR and push to `main`:
1. `npm ci` — install deps
2. ESLint — lint check
3. Prettier — format check
4. Vitest — unit + CDK tests
5. CDK synth — verify templates compile

## Environments
- dev: `cdk deploy --all --context env=dev`
- prod: `cdk deploy --all --context env=prod`

## CDK Stacks
| Stack | Status | Purpose |
|---|---|---|
| `DataStack` | Implemented | 11 DynamoDB tables + 8 GSIs |
| `AuthStack` | Stub | Cognito User Pool + Apple Sign-In |
| `ApiStack` | Stub | Lambda + API Gateway + JWT authorizer |
| `NotificationsStack` | Stub | SNS platform application (APNs) |
| `MonitoringStack` | Stub | CloudWatch dashboards + alarms |
