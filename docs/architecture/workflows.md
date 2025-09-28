# Architecture Workflows

Codemachine runs through sequential planning, building, testing, and runtime cycles to turn user intents into shippable CLI artifacts. This guide outlines the core responsibilities and hand-offs in each phase so contributors can stay aligned across agents.

## Planning Phase Flow
1. Capture incoming objectives from `.codemachine/inputs/specifications.md` or master-mind briefs, validating assumptions against `docs/architecture/assumptions.md`.
2. Decompose features into agent-scoped tasks, grounding scope with `docs/architecture/system-boundaries.md` and updating interim notes in `memory/`.
3. Align execution plans with solution-architect and related owners, logging deliverables before transitioning work to implementation.

## Building Phase Flow
1. Prepare the workspace (run `npm install` while `scripts/dev/bootstrap.sh` remains a stub) and load agent contexts from `prompts/`.
2. Execute implementation agents to update `src/` code, synchronize architecture docs in `docs/architecture/`, and generate supporting assets.
3. Refresh CLI documentation and usage help under `docs/` and `README.md`, staging code and doc changes together for review.

## Testing Phase Flow
1. Run `scripts/ci/validate.sh` (also available via `npm run validate`) to lint, type-check, and execute automated suites.
2. Extend coverage with targeted specs in `tests/`, collaborating with guidance in `prompts/qa-test-engineer.md` for acceptance expectations.
3. Record QA outcomes and open issues in `docs/operations/` or the task tracker, feeding regressions back into Planning.

## Runtime Phase Flow
1. Package the CLI with `npm run build` to emit `dist/` artifacts and verify binary entry points before release.
2. Coordinate releases through `scripts/ops/publish.sh`, following operations guidelines to promote artifacts and notify stakeholders.
3. Monitor deployed runs via the logging stack documented in `src/shared/logging/README.md`, routing incidents into the Planning backlog for remediation.
