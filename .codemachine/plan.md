# Architecture Plan

## Executive Summary
- TypeScript/Node CLI orchestrator that bootstraps `.codemachine/` workspaces, generates multi-agent plans, and drives Codex executions across four enforced phases: Planning, Building, Testing, Runtime.
- Architecture centers on modular lifecycle slices (`src/core`, `src/agents`, `src/cli`, `src/infra`) with strict ownership and phase tagging to keep files small, co-located, and purpose-specific.
- Primary patterns: command bus (Commander.js), workflow engine with declarative state machines, contract-first schemas via Zod, adapter pattern for Codex CLI, and idempotent filesystem writers. All design choices scale to 10× workload without restructuring the root.

## Planning Assets
- Branding Guide — Gemini UI: `docs/reference/branding.md`
- Implementation Roadmap — `docs/architecture/implementation-roadmap.md`
- Next Steps Checklist — `docs/operations/next-steps.md`

## Directory Structure (with Phase Mapping)
- [System Boundaries](docs/architecture/system-boundaries.md) — Planning reference kept current by architects.

- `.codemachine/` (Planning) — Stores architecture plan and executor-ready tasks; enforced as single source of truth. `plan.md` (Planning) documents decisions; `tasks.json` (All phases) drives orchestration.
- `docs/architecture/` (Planning) — ADRs, design rationale for architects. `docs/operations/` (Runtime) — Runbooks, incident playbooks. `docs/reference/` (Building→Runtime) — Command/API references curated by technical-writer.
- `inputs/` (Planning) — Seed agent data (cannot move; spec-provided). `prompts/` (Planning) — Core agent prompts mandated by project. `runner-prompts/` (Planning) — Runtime-supplied user input (`user-input.md`) consumed during Planning.
- `scripts/ci/` (Testing) — CI entrypoints (lint, typecheck, test). `scripts/dev/` (Planning→Building) — Developer bootstrap helpers. `scripts/ops/` (Runtime) — Release/publish automation.
- `src/app/` (Planning→Runtime) — CLI bootstrap and lifecycle wiring; thin entrypoint delegating to other modules.
- `src/agents/registry/` (Planning) — Agent metadata ingestion and directory ownership map. `src/agents/memory/` (Testing→Runtime) — Memory sync and replay adapters. `src/agents/runtime/` (Building→Runtime) — Execution pipelines & retries.
- `src/cli/commands/` (Building) — Commander command definitions for `/start`, `/templates`, etc. `src/cli/presentation/` (Building) — Terminal UI components (branding, typewriter). `src/cli/middleware/` (Testing) — Shared guards/logging for commands.
- `src/core/tasks/` (Planning) — Task graph builder and validator. `src/core/workflows/` (Building→Testing) — Phase state machines executed by Master Mind. `src/core/contracts/` (Planning) — Zod/OpenAPI schemas for plans and memory.
- `src/config/loaders/` (Planning) — Config discovery (env, CLI flags, `.codemachine`). `src/config/schema/` (Planning→Runtime) — Validation and defaulting logic.
- `src/infra/codex/` (Building→Runtime) — Codex CLI adapter, streaming, telemetry. `src/infra/fs/` (Planning→Testing) — Deterministic filesystem utilities. `src/infra/process/` (Runtime) — Process orchestration, termination, concurrency controls.
- `src/shared/constants/` (All phases) — Immutable values (paths, phases). `src/shared/errors/` (All phases) — Error taxonomy. `src/shared/logging/` (Runtime) — Logger configurables. `src/shared/types/` (Planning) — Shared TypeScript types.
- `tests/unit/` (Testing) — Module-level specs. `tests/integration/` (Testing) — Orchestration flows. `tests/e2e/` (Testing→Runtime) — CLI walkthroughs. `tests/fixtures/` (Testing) — Mock codex outputs/specs.
- Root contains 12 items (exceeds 10) **by necessity**: global configs (`package.json`, `tsconfig.json`, `.editorconfig`, `.gitignore`, `README.md`) plus mandated `inputs/` and `prompts/`. This exception is documented; all new additions must stay within 10-item cap elsewhere.

## File Organization Strategy
- Naming: use explicit purpose-based filenames (`start.command.ts`, `task-graph.service.ts`, `codex-runner.adapter.ts`). Avoid generic `index.ts` except entrypoints (`src/app/index.ts`) accompanied by co-located README explaining exports.
- Module boundaries: each folder encapsulates a single concept with ≤3 sub-concepts; cross-module interactions go through TypeScript interfaces defined in `src/core/contracts` or `src/shared/types`.
- File size rule: cap files at ≈200 LOC by splitting into `*.service.ts`, `*.controller.ts`, or `*.view.ts` as appropriate. Provide aggregator files only when exposing a stable API surface (`src/core/tasks/index.ts`).
- Imports: relative within same bounded context (`./task-validator`), absolute via TS path aliases defined later (`@core/tasks`) to avoid brittle paths.
- Tests co-locate under `tests/` mirroring source path (`tests/unit/core/tasks/task-graph.spec.ts`) to maintain traceability.

## Agent Responsibility Mapping
| Directory | Primary Phase | Owners | Collaboration Notes |
|-----------|---------------|--------|---------------------|
| `.codemachine/` | Planning | software-architect | Master Mind reads `tasks.json`; all agents respect immutability except architects.
| `docs/architecture/` | Planning | software-architect, solution-architect | ADR cadence: weekly or on every major structural change.
| `docs/operations/` | Runtime | backend-dev, qa-engineer | Updates require incident report references.
| `docs/reference/` | Building→Runtime | technical-writer | Consumes schema exports from `src/core/contracts`.
| `scripts/ci/` | Testing | qa-engineer | Hooks master pipeline to Vitest + coverage gating.
| `scripts/dev/` | Planning→Building | frontend-dev, backend-dev | Provide deterministic bootstrap aligning with plan.
| `scripts/ops/` | Runtime | backend-dev, solution-architect | Manage npm publish, rollback flows.
| `src/app/` | Planning→Runtime | software-architect (structure), backend-dev (impl) | Accepts only orchestrator-level functions.
| `src/agents/*` | Planning→Runtime | backend-dev, solution-architect, performance-engineer | Memory adapters shared with qa-engineer for fixtures.
| `src/cli/*` | Building | frontend-dev, uxui-designer | Accessibility & UX reviews required before merges.
| `src/core/*` | Planning→Testing | software-architect, solution-architect | Contracts exported to other modules; qa-engineer writes contract tests.
| `src/config/*` | Planning | solution-architect | QA verifies config validation paths.
| `src/infra/*` | Building→Runtime | backend-dev, performance-engineer | Provide mocks under `tests/fixtures`.
| `src/shared/*` | All | software-architect (gatekeeper) | Changes require cross-agent sign-off noted in ADR.
| `tests/*` | Testing | qa-engineer | Module owners contribute targeted specs; results logged per phase in `.codemachine/tasks.json`.

## Data Flow Documentation
High-level lifecycle across phases showing how user input, task planning, and agents interact.

### Phase: Planning
1. CLI bootstrap (`src/app/index.ts`) loads config via `src/config/loaders` and reads specification from `runner-prompts/user-input.md` plus `.codemachine/inputs/specifications.md` (when present).
2. `src/core/tasks` builds `tasks.json` skeleton referencing phase ordering rules; `src/agents/registry` resolves available agent competencies from `inputs/agents.js` and `prompts/` metadata.
3. Outputs persisted through `src/infra/fs` with transactional writes; validations enforce schema via `src/config/schema`.
4. Master Mind ingests plan; `scripts/dev/bootstrap.sh` ensures environment (Node, CODEX_HOME) before handing off to Building.

### Phase: Building
1. `/start` command (future `src/cli/commands/start.command.ts`) selects tasks by phase and hands instructions to `src/core/workflows`.
2. Workflow engine dispatches to `src/agents/runtime` which hydrates prompts (registry + `.codemachine/agents/*`) and invokes Codex via `src/infra/codex`.
3. Results routed through `src/agents/memory` to `.codemachine/memory/*.md`; `src/shared/logging` streams sanitized telemetry to CLI presentation for typewriter effect under `src/cli/presentation`.

### Phase: Testing
1. After each task completion, `src/core/workflows` triggers QA hooks (contract tests). `scripts/ci/lint.sh` and `npm run test` executed automatically for gating.
2. Test suites under `tests/unit|integration|e2e` consume fixtures from `tests/fixtures` and mocks from `src/agents/memory`. Coverage reports stored in `coverage/` and logged back into tasks by Master Mind.
3. Failures recorded in `tasks.json` acceptance criteria; rollback instructions invoked from `src/shared/errors` to guide safe resets.

### Phase: Runtime
1. Deployment packaging (future `src/cli/commands/version.command.ts` + `scripts/ops/publish.sh`) ensures built artifacts in `dist/` with hashed version.
2. Runtime telemetry captured via `src/infra/process` + `src/shared/logging`; health checks expose command statuses for `/health` endpoint.
3. Rollbacks executed via `scripts/ops/publish.sh` and plan updates recorded in `.codemachine/plan.md` under Validation Checklist for traceability.

## Scalability Roadmap
- **MVP (0-3 months)** — Single local execution, deterministic planning, manual Codex invocation. Focus on Planning/Building directories, ensure CLI wrappers stable.
- **6 Months** — Support concurrent agent runs, remote workspace support, caching of prompts. Expand `src/infra/process` with worker pools, add instrumentation in `src/shared/logging` to feed metrics dashboards.
- **Long-Term (12+ months)** — Pluggable agent marketplace, distributed execution, template packs. Introduce microservice boundaries by splitting `src/infra` into packages while preserving Directory depth; maintain plan-driven tasks to keep four phases enforceable.

## Development Guidelines
- Enforce 5-3-10 rule: new directories require ADR justification; per-folder item counts tracked in Validation Checklist. Root exception already documented.
- Follow small-file discipline; split features into `command`, `service`, `view` triples as needed. Keep pure logic in `src/core` with dependencies injected.
- Use feature flags for risky runtime features stored under `src/config/schema/feature-flags.schema.ts` (future), toggled via environment.
- All new code must include associated tests in matching `tests/` path and update `.codemachine/tasks.json` acceptance criteria.
- ADR process: record decision in `docs/architecture` before implementing cross-cutting changes; link ADR ID in commit message and tasks.

## Security & Compliance
- Secrets: never commit; rely on `.env` (listed in `.gitignore`) and environment variables validated via `src/config/schema` (Zod). Provide `.env.example` later under Planning tasks.
- Auth: CLI verifies presence of `~/.codemachine/codex/auth/auth.json`; no credentials stored in repo. `src/infra/codex` sanitizes command arguments to prevent shell injection.
- Logging: Pino logger ensures sensitive data redaction by default; runtime logs stored locally respecting user opt-in settings.
- Compliance: Provide audit trail via `tasks.json` statuses and `docs/operations` release notes. Tests enforce no PII persistence.

## Assumptions & Open Questions
- `user_input.md` provided under `runner-prompts/user-input.md`; treat as canonical spec until tooling standardizes path.
- Codex CLI availability assumed; if offline, fallback stub service required (documented as future task).
- Exact requirements for streaming UI durations unspecified; propose 60fps typewriter default with ability to throttle—confirm with product.
- Need confirmation on Node package manager (`npm` vs `pnpm`); defaulting to npm per installation instructions.

## Validation Checklist
- [ ] `.codemachine/plan.md` maintained with four-phase anchors and all sections.
- [ ] `.codemachine/tasks.json` valid JSON with ≥15 main tasks, each 3–6 subtasks (exceptions documented here if needed).
- [ ] Directory additions respect 5-3-10 rule; root exception logged above.
- [ ] Each module exports contracts via `src/core/contracts` or `src/shared/types` before implementation.
- [ ] Tests mirror source tree and achieve coverage thresholds (90% critical, 80% overall).
- [ ] Security checks: `.env` absent from repo, Codex commands sanitized, no secrets in plan/tasks.
- [ ] Scalability hooks (telemetry, modular adapters) reviewed every milestone and recorded in ADRs.

## Task Plan Summary
- `.codemachine/tasks.json` will contain ≥15 executor-grade tasks mapped to Planning (scaffold/config), Building (feature implementation), Testing (automations & coverage), Runtime (packaging/ops).
- Each task references explicit directories above, with acceptance criteria aligning to Verification steps (lint/test outputs, file existence, command exit codes).
- Dependencies expressed using `dependsOn` to maintain four-phase sequencing (Planning → Building → Testing → Runtime). Subtasks per main task kept at 3–6; any deviation will be justified in this plan and annotated within the task file.
- Validation commands (`npm run validate`, `scripts/ci/lint.sh`) used throughout tasks to keep plan enforceable and reproducible.
