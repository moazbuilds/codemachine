# CodeMachine CLI

Codemachine is a multi‑agent CLI coding assistant that plans, builds, and validates projects from structured specifications using Codex models. This repo contains the TypeScript CLI, orchestrator, and agent runtime.

## Quickstart

Requirements:
- Node.js >= 20.10
- One of: pnpm (recommended) or npm
- Codex CLI available (for `auth` and agent execution)

Install and run:
- With pnpm
  - `pnpm install`
  - `pnpm build`
  - `pnpm exec node dist/index.js start`
- With npm
  - `npm install`
  - `npm run build`
  - `node dist/index.js start`

That launches the planning workflow using `.codemachine/inputs/specifications.md` by default and scaffolds `.codemachine/` in your workspace.

Tip: Add `--dir <path>` to target a different workspace directory, e.g. `node dist/index.js --dir ./my-project start`.

## First Run Checklist
- Ensure Codex CLI is installed and on PATH (used by `auth` and agent execution). If you have a local dev CLI, set it up as `cli/codex-cli.js` relative to your working directory.
- Prepare your project spec in `.codemachine/inputs/specifications.md` (auto‑created on first run; you can also point `--spec` to any file).
- Optionally set `CODEX_HOME` to customize where Codex stores config/auth (defaults to `~/.codemachine/codex`).

## Global Options
- `--dir <path>`: Target workspace directory (default: current dir). Sets `CODEMACHINE_CWD` internally.

## Commands

- `version`
  - Prints the CLI version (e.g., `CodeMachine v0.1.0`).

- `mcp`
  - Placeholder for Model Context Protocol integration (prints a coming‑soon message).

- `start` [--force] [--spec <path>]
  - Starts the planning workflow.
  - Seeds project‑specific agents and plan, then runs the planner.
  - Options:
    - `--force`: Overwrite existing planning outputs.
    - `--spec <path>`: Path to the planning spec file. Default: `.codemachine/inputs/specifications.md`.
  - Example: `node dist/index.js start --force --spec docs/my-spec.md`

- `ui` [--typewriter]
  - Renders the TUI home screen to stdout.
  - Options:
    - `--typewriter`: Animate the output using a typewriter effect.
  - Example: `node dist/index.js ui --typewriter`

- `session` [--spec <path>]
  - Starts an interactive REPL session that accepts slash commands and keeps you inside the CLI.
  - Commands inside session: `/start`, `/ui`, `/login`, `/logout`, `/version`, `/help`, `/exit`.
  - Options:
    - `--spec <path>`: Planning spec for `/start`. Default: `.codemachine/inputs/specifications.md`.
  - Example: `node dist/index.js session`

- `templates`
  - Placeholder for managing templates (prints a not‑implemented message).

- `auth login`
  - Interactive authentication via Codex CLI with `CODEX_HOME` applied.
  - On success, credentials live at `~/.codemachine/codex/auth.json` (by default).

- `auth logout`
  - Removes local credentials at `~/.codemachine/codex/auth.json`.

- `agent <id> <prompt...>` [--profile <name>]
  - Executes a single agent request via Codex with memory support.
  - `id` must match an entry in `config/agents.js`.
  - Options:
    - `--profile <name>`: Codex profile to use (default: `default`). Profiles are generated from agents at `~/.codemachine/codex/config.toml`.
  - Example: `node dist/index.js agent frontend-dev "Implement a responsive Button component" --profile frontend-dev`

- `project-manager` (alias: `pm`) [--parallel] [--tasks <path>] [--logs <path>]
  - RFC‑2119‑compliant project orchestrator. Drives tasks, summarizes after each pass, retries until complete, then runs E2E validation.
  - Options:
    - `--parallel`: Allow parallel execution when dependencies permit.
    - `--tasks <path>`: Override tasks file (default: `.codemachine/plan/tasks.json` or `.codemachine/tasks.json`).
    - `--logs <path>`: Override logs output (default: `.codemachine/logs.jsonl`).
  - Outputs:
    - Writes project summary to `.codemachine/project-summary.md`.
    - Writes E2E results to `.codemachine/e2e-results.txt`.
  - Example: `node dist/index.js pm --parallel`

## Workspace Files
On startup the CLI ensures `.codemachine/` exists and mirrors available agents:
- `.codemachine/agents/agents-config.json`: Synchronized from `config/agents.js`.
- `.codemachine/inputs/specifications.md`: Created if missing.
- `.codemachine/plan/`: Planning artifacts (e.g., `plan.md`, `tasks.json`).
- `.codemachine/memory/`: Memory written by the `agent` command.

Agent definitions live in:
- `config/agents.js`: Array of agent configs `{ id, name, promptPath, ... }`.
  - The companion `config/package.json` keeps this directory in CommonJS mode so runtime code can require the module.
  - These also drive profile entries in `~/.codemachine/codex/config.toml`.

## Environment Variables
- `CODEMACHINE_CWD`: Working directory for the current CLI session (auto-set from `--dir`).
- `CODEX_HOME`: Codex config root (default: `~/.codemachine/codex`).
- `NODE_ENV`: `development` | `test` | `production` (default: `development`).
- `LOG_LEVEL`: `debug` | `info` | `warn` | `error` (default: `info`).
- `TELEMETRY_ENABLED`: When `true`, enables anonymous telemetry.

See docs for more: `docs/reference/environment.md`.

## Dev Scripts
- `npm run dev`: Watch mode for local development.
- `npm run build`: Build to `dist/`.
- `npm start`: Builds then runs `start` (requires `pnpm` to be installed because the script calls `pnpm -s build`). If you don’t use pnpm, run `npm run build` then `node dist/index.js start`.

## Troubleshooting
- Authentication issues: ensure `codex` is on PATH and `CODEX_HOME` is writable. Run `codemachine auth login` again.
- Codex health failures in `project-manager`: start/verify the Codex API and ensure the local CLI is available. E2E results are saved to `.codemachine/e2e-results.txt`.
- Agents not found: verify `config/agents.js` includes the expected `id` and `promptPath`.

## Additional Docs
- Architecture: `docs/architecture/README.md`
- CLI UI: `docs/reference/cli-ui.md`
- Agents: `docs/reference/agents.md`, `src/agents/README.md`
- Infra: `src/infra/README.md`
