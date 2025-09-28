# Next Steps — Execution Checklist

Source: runner-prompts/user-input.md (section: Next Steps)

Use this checklist to drive near-term execution across owners. Link to scripts/tests helps verify progress.

| Status | Step | Owner | References |
|--------|------|-------|------------|
| [ ] | Set up TypeScript project structure | software-architect | `tsconfig.json`, `eslint.config.js`, `src/` |
| [ ] | Implement CLI framework | backend-dev | `tests/unit/cli/register-cli.spec.ts`, `tests/e2e/start-cli.spec.ts`, `scripts/e2e-smoke.sh` |
| [ ] | Create agent prompt templates | technical-writer | `prompts/`, `src/cli/commands/agent.command.ts`, `tests/unit/cli/agent-wrapper.spec.ts` |
| [ ] | Build Master Mind orchestration engine | solution-architect | `src/core/workflows/master-mind.ts`, `tests/integration/workflows/master-mind.spec.ts` |
| [ ] | Integrate Codex API | backend-dev | `src/infra/codex/codex-runner.ts`, `scripts/ci/run-e2e.sh`, `tests/e2e/start-cli.spec.ts` |
| [ ] | Test with sample projects | qa-engineer | `tests/fixtures/`, `scripts/ci/e2e.sh`, `scripts/e2e-smoke.sh` |
| [ ] | Iterate based on results | master-mind | `docs/architecture/implementation-roadmap.md`, `tests/integration/workflows/recovery.spec.ts` |

Notes
- Keep updates synchronized with `.codemachine/tasks.json` statuses.
- Record outcomes and adjustments in `docs/architecture/implementation-roadmap.md` when scope changes.

