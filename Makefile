SHELL := /bin/bash

.PHONY: help setup lint test fmt ios backend

help:
	@echo "Targets:"
	@echo "  setup      - install dev deps"
	@echo "  lint       - run linters (backend + ios if configured)"
	@echo "  test       - run tests (backend + ios if configured)"
	@echo "  fmt        - format code (backend + ios if configured)"
	@echo "  ios        - open iOS project (once created)"
	@echo "  backend    - run backend locally (once created)"

setup:
	cd backend && npm install

lint:
	@echo "TODO: implement lint"

test:
	cd backend && npx vitest run

fmt:
	@echo "TODO: implement formatting"

ios:
	@echo "TODO: create ios project first (requires .xcodeproj via Xcode or xcodegen)"

backend:
	@echo "TODO: create backend first"
