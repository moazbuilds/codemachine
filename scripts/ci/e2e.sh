#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PACKAGE_NAME="codemachine"

echo "[codemachine:e2e] Installing dependencies with pnpm --filter ${PACKAGE_NAME}"
pnpm --dir "${PROJECT_ROOT}" --filter "${PACKAGE_NAME}" install --frozen-lockfile

echo "[codemachine:e2e] Building CLI before smoke tests"
pnpm --dir "${PROJECT_ROOT}" --filter "${PACKAGE_NAME}" build

echo "[codemachine:e2e] Running Vitest smoke suite"
CODEMACHINE_FIXTURES_DIR="${PROJECT_ROOT}/tests/fixtures" pnpm --dir "${PROJECT_ROOT}" --filter "${PACKAGE_NAME}" vitest run tests/e2e/start-cli.spec.ts
