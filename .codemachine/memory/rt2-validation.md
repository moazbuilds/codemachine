# Runtime Phase 2 — Validation Report (/start & Initialization)

**Acceptance Criteria**
- Executed from fresh launch with real-time, human-like operation; `/start` prompts for specifications; NO branch returns to menu; YES branch proceeds to team building; agent prompt files created; `.codemachine/plan/tasks.json` generated; streaming UI works; no isolated or skipped steps.

**Environment Setup**
- From repo root: `cd projects/codemachine`
- Clean state (optional): `rm -rf .codemachine && mkdir -p .codemachine`

**Step-by-Step Verification**
- Specifications confirmation
  - Expected: Prompt or log confirming `runner-prompts/user-input.md` detected.
- NO branch
  - Expected: Selecting NO returns to menu; session remains open.
- YES branch & team building
  - Command (non-interactive): `pnpm -s build && node dist/index.js start`
  - Expected: Logs show agents-builder executed; agent prompts written under `.codemachine/agents`.
- Plan generation
  - Check: `test -f .codemachine/plan/tasks.json && echo OK && jq -e '.tasks|type=="array"' .codemachine/plan/tasks.json >/dev/null && echo OK`
- Auth first-time flow
  - Expected: If missing auth, `codex login` invoked once; auth artifacts present under `~/.codemachine/codex/`.
- Streaming UI & controls
  - Expected: Typewriter or live logs; Ctrl+C modifies plan; Ctrl+E expands logs (manual).
- Idempotency
  - Re-run: `node dist/index.js start`
  - Expected: No duplicate files; safe updates only.

**Results Summary**
- Specifications confirmation: PARTIAL (observed via logs in non-interactive run)
- NO branch return: Not Executed (manual)
- YES branch & agents-builder: PASS (logs confirm; artifacts present)
- Plan generation: PASS (file exists and parses)
- Auth first-time flow: Not Executed (manual)
- Streaming UI & controls: Not Executed (manual)
- Idempotency: PASS (re-run safe; no duplicates observed)

**Issues & Remediation**
- Interactive branching not validated here.
  - Remediation: Manual interactive session walkthrough required.
- Auth flow depends on external `codex` installation.
  - Remediation: Add fallback guidance if `codex` not found; mock in CI.
- Streaming controls not automated.
  - Remediation: Add Playwright-based terminal automation or PTY harness.
