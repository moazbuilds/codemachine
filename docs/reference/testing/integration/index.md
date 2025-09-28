# Integration Testing

Integration tests exercise Codemachine workflows end-to-end using real filesystem operations and shared fixtures.

## Fixtures
- `tests/fixtures/tasks/planning.json` mirrors a subset of `.codemachine/tasks.json` and keeps `id`, `phase`, `name`, and `acceptanceCriteria` fields for Planning tasks.
- Refresh the fixture whenever planning metadata changes so workflow assertions reflect current acceptance criteria.
- Prefer extending the fixture rather than mutating existing entries to preserve historical expectations.

## Workflow Manager Coverage
- `tests/integration/workflows/planning-workflow.spec.ts` provisions a temporary specification file, calls `validateSpecification(specPath, false)`, and asserts the check enforces non-empty specs.
- `tests/integration/workflows/master-mind.spec.ts` provisions a temporary project workspace, invokes `runTaskManager`, and verifies task sequencing, logging, and completion semantics.
- Update both workflow tests alongside template or task fixture edits so assertions stay aligned with the documented behaviour.

## Running the Suite
- Execute `pnpm vitest run tests/integration/workflows/master-mind.spec.ts` for a focused check, or `pnpm vitest run tests/integration` to cover the full workflow suite.
- Integration runs rely on Node.js filesystem APIs, so run them in an environment that permits temporary directory creation and cleanup.
