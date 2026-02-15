SHELL := /bin/bash

.PHONY: help setup lint test fmt synth build ios backend

help:
	@echo "Targets:"
	@echo "  setup      - install all dependencies"
	@echo "  lint       - run linters (backend)"
	@echo "  test       - run tests (backend + CDK)"
	@echo "  fmt        - check formatting (backend)"
	@echo "  fmt-fix    - auto-fix formatting (backend)"
	@echo "  synth      - synthesize CDK stacks"
	@echo "  build      - bundle Lambda with esbuild"
	@echo "  ios        - open iOS project (once created)"
	@echo "  backend    - run backend locally (once created)"

setup:
	cd backend && npm ci

lint:
	cd backend && npx eslint . --ext .ts

test:
	cd backend && npx vitest run

fmt:
	cd backend && npx prettier --check '**/*.ts'

fmt-fix:
	cd backend && npx prettier --write '**/*.ts'

synth:
	cd backend/cdk && npx cdk synth --context env=dev --quiet

build:
	cd backend && npm run build

ios:
	@echo "TODO: create ios project first"

backend:
	@echo "TODO: create backend first"
