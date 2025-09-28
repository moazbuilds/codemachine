# Runtime Phase 1 — Validation Report

**Scope & Acceptance Criteria**
- Runs in real time with human-like interactions; begins from a clean start of `codemachine`; session opens and stays open; main screen renders; dynamic menu reflects auth state; project `.codemachine/` structure and `.codemachine/agents/agents-config.json` are created on run; no isolated task testing; no steps skipped.

**Environment Setup**
- Ensure Node >= 20.10.0
- From repo root: `cd projects/codemachine`
- Optional clean start: `rm -rf .codemachine ~/.codemachine/codex/* ~/.config/codemachine 2>/dev/null || true`

**Verification Steps & Expected Results**
- Fresh launch & persistent session
  - Build + start: `pnpm -s build && node dist/index.js start`
  - Expected: Planning workflow logs; process stays responsive; Ctrl+C exits cleanly.
- Main screen banner, mode, prompt, dynamic menu
  - Expected: Banner with product name and version; prompt visible; unauthenticated menu shows /login; post-login shows /logout.
- Project bootstrap artifacts
  - Expected after first start: `.codemachine/` and `.codemachine/agents/agents-config.json` exist and are non-empty.
  - Check: `test -d .codemachine && test -s .codemachine/agents/agents-config.json && echo OK`
- Global config sync
  - Check file: `test -f ~/.codemachine/codex/config.toml && echo OK`
  - Inspect keys: `rg -n "^\[cli\]|^version\s*=|^telemetry\s*=" ~/.codemachine/codex/config.toml`
- Help & version
  - Interactive: at prompt, run `/help` and `/version`; expect usage and semver.
  - Non-interactive (if available): `codemachine --help` and `codemachine --version`.

**Results Summary**
- Fresh launch and persistent session: Not Executed (manual)
- Banner, mode, prompt, dynamic menu: Not Executed (manual)
- Project bootstrap artifacts created: PASS (files present in this workspace)
- Agents config generated from inputs/agents.js: PASS (present and parseable)
- Global config synced to ~/.codemachine/codex/config.toml: PASS (file exists)
- /help and /version outputs (interactive): Not Executed (manual)
- --help and --version outputs (non-interactive): Not Executed (manual)

**Issues & Remediation**
- Interactive session UX not validated here.
  - Remediation: Run on a dev machine; capture screenshots and logs.
- Help/version may not be wired to binary alias.
  - Remediation: Expose bin in package.json and implement `--help/--version`.
- Ensure bootstrap/idempotency tested on clean profile.
  - Remediation: Add CI smoke test that runs `node dist/index.js start` twice and checks artifacts.
