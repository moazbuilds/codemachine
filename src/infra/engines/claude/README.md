# Claude Engine

Claude Code CLI integration for CodeMachine, providing similar functionality to the Codex engine.

## Features

- **Profile-based execution**: Each agent gets its own Claude config directory
- **Model mapping**: Automatically maps generic model names (like `gpt-5-codex`) to Claude models
- **Cross-platform**: Works on Linux, macOS, and Windows
- **Same infrastructure**: Uses the same runner, executor, and memory systems as Codex
- **Authentication management**: Handles login/logout via Claude's `setup-token`

## Usage

### Basic Execution

```typescript
import { runAgent } from './infra/engines/claude/index.js';

const output = await runAgent(
  'my-agent',
  'Write a hello world function',
  process.cwd(),
  {
    model: 'sonnet', // optional
    timeout: 600000,
  }
);
```

### Authentication

```typescript
import { ensureAuth, clearAuth, isAuthenticated } from './infra/engines/claude/index.js';

// Check if authenticated
const authed = await isAuthenticated({ profile: 'my-agent' });

// Ensure authentication (runs setup-token if needed)
await ensureAuth({ profile: 'my-agent' });

// Logout / clear credentials
await clearAuth({ profile: 'my-agent' });
```

### Model Mapping

The engine automatically maps generic model names to Claude models:

```typescript
// Config with 'gpt-5-codex' will use Claude Sonnet
const config = {
  model: 'gpt-5-codex', // Maps to 'sonnet'
};

// Supported mappings:
// - gpt-5-codex → sonnet
// - gpt-4 → sonnet
// - gpt-3.5-turbo → haiku
// - o1-preview → opus
```

## Configuration

### Environment Variables

- `CLAUDE_CONFIG_DIR`: Override the config directory (default: `~/.codemachine/claude/{profile}`)
- `CODEMACHINE_SKIP_CLAUDE`: Skip Claude execution (dry-run mode, set to `1`)
- `CODEMACHINE_SKIP_AUTH`: Skip authentication prompts (set to `1`)
- `CODEMACHINE_PLAIN_LOGS`: Strip ANSI colors from output (set to `1`)

### Profile Directories

Each profile gets its own config directory:
- `~/.codemachine/claude/{profile}/.claude/.credentials.json`
- `~/.codemachine/claude/{profile}/.claude.json`
- `~/.codemachine/claude/{profile}/.claude.json.backup`

## Command Line Usage

### Login

```bash
CLAUDE_CONFIG_DIR=~/.codemachine/claude/{profile} claude setup-token
```

### Logout

Delete the following files:
- `~/.codemachine/claude/{profile}/.credentials.json`
- `~/.codemachine/claude/{profile}/.claude.json`
- `~/.codemachine/claude/{profile}/.claude.json.backup`
- `~/.codemachine/claude/{profile}/.claude/.credentials.json`

### Execute

```bash
cd /working/dir && \
  CLAUDE_CONFIG_DIR=~/.codemachine/claude/{profile} \
  claude --print \
  --model sonnet \
  --dangerously-skip-permissions \
  --permission-mode bypassPermissions \
  "your prompt"
```

## Architecture

The Claude engine follows the same structure as the Codex engine:

```
src/infra/engines/claude/
├── auth.ts                    # Authentication management
├── config.ts                  # Model mapping and configuration
├── execution/
│   ├── commands.ts           # Command builder
│   ├── executor.ts           # High-level execution interface
│   ├── runner.ts             # Low-level runner with spawn
│   └── index.ts              # Exports
├── index.ts                   # Main exports
└── README.md                  # This file
```

## Integration

The Claude engine integrates with the same infrastructure as Codex:

- **Process spawning**: `src/infra/process/spawn.ts`
- **Memory system**: `src/agents/memory/`
- **Logging**: `src/shared/logging/`
- **Path utilities**: `src/infra/engines/codex/path.ts`
