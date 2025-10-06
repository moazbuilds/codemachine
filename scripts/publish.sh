#!/usr/bin/env bash
set -euo pipefail

dry_run=true
tag="latest"

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
        echo "[publish] --tag requires a value" >&2
        exit 1
      fi
      tag="$2"
      shift 2
      ;;
    *)
      echo "[publish] Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

echo "[publish] Dry run: $dry_run"
echo "[publish] Using tag: $tag"

echo "[publish] Verifying clean git worktree"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "[publish] Worktree is not clean; commit or stash changes before publishing." >&2
  exit 1
fi

echo "[publish] Verifying npm authentication"
npm whoami >/dev/null

echo "[publish] Running npm run build"
npm run build

echo "[publish] Running npm run test"
npm run test

echo "[publish] Running npm run lint"
npm run lint

publish_cmd=(npm publish --tag "$tag")

if [[ "$dry_run" == true ]]; then
  echo "[publish] Dry run enabled; publish command:"
  echo "[publish] ${publish_cmd[*]}"
else
  echo "[publish] Publishing to npm"
  "${publish_cmd[@]}"
fi

echo "[publish] Release complete"
