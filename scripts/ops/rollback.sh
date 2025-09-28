#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/ops/rollback.sh [options]

Options:
  --dry-run             Perform a dry run (default).
  --no-dry-run          Execute rollback actions.
  --tag <value>         Git tag to remove and npm version to unpublish (default: latest).
  --package <name>      NPM package name to unpublish (default: codemachine).
  -h, --help            Show this help message.
USAGE
}

dry_run=true
tag="latest"
package_name="codemachine"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      dry_run=true
      shift
      ;;
    --no-dry-run)
      dry_run=false
      shift
      ;;
    --tag)
      if [[ $# -lt 2 ]]; then
        echo "[rollback] Error: --tag requires a value." >&2
        exit 1
      fi
      tag="$2"
      shift 2
      ;;
    --package)
      if [[ $# -lt 2 ]]; then
        echo "[rollback] Error: --package requires a value." >&2
        exit 1
      fi
      package_name="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[rollback] Error: Unknown option '$1'." >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "${tag}" ]]; then
  echo "[rollback] Error: tag must be non-empty." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

echo "[rollback] Working directory: ${PROJECT_ROOT}"
echo "[rollback] Dry run: ${dry_run}"
echo "[rollback] Tag: ${tag}"
echo "[rollback] Package: ${package_name}"

echo "[rollback] Verifying git repository..."
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[rollback] Error: Not inside a git repository." >&2
  exit 1
fi

echo "[rollback] Checking for uncommitted changes..."
git_status="$(git status --porcelain)"
if [[ -n "${git_status}" ]]; then
  if [[ "${dry_run}" == "true" ]]; then
    echo "[rollback] Warning: Uncommitted changes detected. Continuing because this is a dry run." >&2
  else
    echo "[rollback] Error: Uncommitted changes detected. Please commit or stash before running rollback." >&2
    exit 1
  fi
fi

if [[ "${dry_run}" == "true" ]]; then
  echo "[rollback] Dry run enabled; the following commands would be executed:"
  echo "[rollback] git rev-parse --is-inside-work-tree"
  echo "[rollback] git fetch --tags"
  echo "[rollback] git tag -d \"${tag}\" (if it exists)"
  echo "[rollback] git reset --hard HEAD~1"
  echo "[rollback] npm unpublish \"${package_name}@${tag}\" --force"
  exit 0
fi

echo "[rollback] Fetching tags..."
git fetch --tags

if git rev-parse -q --verify "refs/tags/${tag}" >/dev/null 2>&1; then
  echo "[rollback] Deleting git tag '${tag}'..."
  git tag -d "${tag}"
else
  echo "[rollback] Git tag '${tag}' does not exist; skipping deletion."
fi

echo "[rollback] Ensuring previous commit exists..."
if ! git rev-parse HEAD~1 >/dev/null 2>&1; then
  echo "[rollback] Error: No previous commit found to reset to." >&2
  exit 1
fi

echo "[rollback] Resetting current branch to HEAD~1..."
git reset --hard HEAD~1

echo "[rollback] Unpublishing npm package '${package_name}@${tag}'..."
npm unpublish "${package_name}@${tag}" --force

echo "[rollback] Rollback completed successfully."
