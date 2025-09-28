# System Boundaries

## In Scope
- Deliver a cross-platform Codemachine CLI distributed through npm and runnable on macOS, Linux, and Windows shells.
- Parse `.codemachine/tasks.json` to queue, prioritize, and persist multi-agent task execution states.
- Orchestrate the Master Mind and specialized agents to translate user input into production-ready project assets across the plan/build/test lifecycle.
- Apply packaging, testing, and compliance gates defined in `.codemachine/inputs/specifications.md` before finalizing generated outputs.

## Out of Scope
- Hosting generated projects or offering managed/SaaS runtime environments.
- Building graphical or web-based interfaces for agent coordination.
- Relying on external cloud services beyond Codex-managed infrastructure for core execution.

## External Integrations
- Codex API for agent session execution and streaming outputs.
- npm registry for publishing and distributing the Codemachine CLI package.
- Local Git tooling and repository metadata for diffs, commits, and version control hooks.
- Host operating system filesystem APIs for reading configuration, scaffolding workspaces, and writing generated artifacts.

## Notes
- Source reference: `.codemachine/inputs/specifications.md`; execution checkpoints mirror `.codemachine/tasks.json` expectations.
- Requirements synchronized on 2025-09-27T07:01:39+03:00 (ISO 8601).
