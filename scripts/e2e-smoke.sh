#!/usr/bin/env bash
set -euo pipefail

echo '▶ Building Codemachine CLI...'
pnpm build

echo '▶ Running E2E smoke test...'
pnpm vitest run tests/e2e/start-cli.spec.ts
