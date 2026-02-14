SHELL := /bin/bash

.PHONY: help setup lint test fmt ios backend

help:
	@echo "Targets:"
	@echo "  setup      - install dev deps (placeholder)"
	@echo "  lint       - run linters (backend + ios if configured)"
	@echo "  test       - run tests (backend + ios if configured)"
	@echo "  fmt        - format code (backend + ios if configured)"
	@echo "  ios        - open iOS project (once created)"
	@echo "  backend    - run backend locally (once created)"

setup:
	@echo "TODO: implement setup (brew bundles, npm/pip, etc.)"

lint:
	@echo "TODO: implement lint"

test:
	@echo "TODO: implement test"

fmt:
	@echo "TODO: implement formatting"

ios:
	@echo "TODO: create ios project first"

backend:
	@echo "TODO: create backend first"
