#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../.." && pwd)"
fixtures_dir="${project_root}/tests/fixtures/codex"

echo "==> Building CLI dist"
(
  cd "${project_root}"
  npm run build
)

echo "==> Running CLI smoke test"
(
  cd "${project_root}"
  CODEX_HOME="${fixtures_dir}" npx vitest run tests/e2e/start-cli.spec.ts
)
