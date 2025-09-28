# Bot Usage Guide

## CLI Wrapper

```bash
# Run (streams output)
./cli/codex-cli.js run <agent> "your prompt here"

# Status
./cli/codex-cli.js status <agent>
./cli/codex-cli.js status all

# Kill
./cli/codex-cli.js kill <agent>
./cli/codex-cli.js kill all

# Health
./cli/codex-cli.js health
```

### Project Workspace Usage

If you're already inside one of the generated workspaces under `projects/<name>`, the CLI lives two directories up. Invoke it with Node so the relative path resolves correctly:

```bash
node ../../cli/codex-cli.js run <agent> "your prompt here"
node ../../cli/codex-cli.js status <agent>
node ../../cli/codex-cli.js status all
node ../../cli/codex-cli.js kill <agent>
node ../../cli/codex-cli.js kill all
node ../../cli/codex-cli.js health
```

Examples:
```bash
./cli/codex-cli.js run frontend "create a responsive nav bar in React"
./cli/codex-cli.js run backend "create a REST endpoint for /users"
```

## Agents

Agents are configured in `inputs/agents.js`. Each agent has:
- `id`: URL/CLI identifier (e.g., `frontend`, `backend`)
- `promptPath`: path to the prompt template

All agents use global command
- `codex.command` (default: `codex`)
- `codex.workingDir` (set at startup via `--dir`)

## Notes
- Streaming endpoints show real-time Codex output in your terminal.
- Timeouts are currently disabled for long-running tasks.
- Working directory is created automatically under `projects/<dir>`.
