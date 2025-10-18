# CLI Reference

Complete command-line interface reference for CodeMachine.

## Overview

CodeMachine provides a command-line interface for managing workflows, executing agents, and configuring your development environment.


**Basic Usage:**
```bash
codemachine [command] [options]
```

**Global Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-d, --dir <path>` | Target workspace directory | `process.cwd()` |
| `--spec <path>` | Path to planning specification file | `.codemachine/inputs/specifications.md` |
| `-h, --help` | Display help for command | - |

**Package Binary:**
- Entry point: `./dist/index.js`
- Command name: `codemachine`

---

## Interactive Mode

When no command is provided, CodeMachine starts in interactive session mode.

**Usage:**
```bash
codemachine
codemachine -d /path/to/workspace
```

**Features:**
- Interactive shell session with keyboard controls
- Real-time workflow execution
- Template selection menu
- Authentication management
- Onboarding for new users

**Session Flow:**
1. CLI checks working directory (`-d` option or current directory)
2. Syncs configuration for all registered engines
3. Bootstraps `.codemachine/` folder if it doesn't exist
4. Enters interactive shell with main menu

**Workspace Structure:**
```
.codemachine/
├── inputs/
│   └── specifications.md     # Default spec file
├── template.json              # Selected template
└── [engine-specific-configs]
```

---

## Workflow Commands

Commands for managing and executing workflows.

### `start`

Run the workflow queue until completion in non-interactive mode.

**Syntax:**
```bash
codemachine start [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--spec <path>` | Path to the planning specification file | `.codemachine/inputs/specifications.md` |

**Behavior:**
- Executes workflow queue sequentially
- Runs in non-interactive mode (no user prompts)
- Exits with status code on completion

**Exit Codes:**
- `0` - Workflow completed successfully
- `1` - Workflow failed

**Output Messages:**
- Success: `✓ Workflow completed successfully`
- Error: `✗ Workflow failed: [error message]`

**Examples:**
```bash
# Run workflow with default spec
codemachine start

# Run workflow with custom spec
codemachine start --spec ./custom/planning.md

# Run in specific directory
codemachine -d /path/to/project start

# Custom directory and spec
codemachine -d /path/to/project start --spec ./specs/feature.md
```

**Use Cases:**
- CI/CD pipeline automation
- Batch workflow execution
- Automated code generation scripts
- Testing workflows

**Technical Details:**
- Source: `src/cli/commands/start.command.ts`
- Non-blocking execution
- Error handling with detailed messages

---

### `templates`

List and select workflow templates interactively.

**Syntax:**
```bash
codemachine templates
```

**Arguments:** None

**Options:** None

**Behavior:**
- Lists all available workflow templates from `templates/workflows/`
- Displays interactive selection menu
- Auto-regenerates agents folder when template changes
- Saves selection to `.codemachine/template.json`

**Template Format:**
- Files ending with `.workflow.js`
- Located in `templates/workflows/` directory
- Export workflow configuration and agent definitions

**Examples:**
```bash
# List and select template interactively
codemachine templates

# Use in specific workspace
codemachine -d /path/to/project templates
```

**Template Storage:**
- Selection saved to: `.codemachine/template.json`
- Default template: `templates/workflows/codemachine.workflow.js`
- Example template: `templates/workflows/_example.workflow.js`

**Use Cases:**
- Switch between different workflow types
- Initialize new projects with specific templates
- Customize agent configurations per project

**Technical Details:**
- Source: `src/cli/commands/templates.command.ts`
- Supports both interactive and programmatic selection
- Triggers agent folder regeneration on template change

---

## Development Commands

Commands for executing agents and workflow steps during development.

### `agent`

Execute an agent directly with specified engine configuration.

**Syntax:**
```bash
codemachine agent [options] <id> <prompt...>
codemachine <engine-name> agent [options] <id> <prompt...>
```

**Arguments:**

| Argument | Required | Description |
|----------|----------|-------------|
| `<id>` | Yes | Agent ID from `config/sub.agents.js` or `config/main.agents.js` |
| `<prompt...>` | Yes | User request to send to the agent (variadic) |

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--model <model>` | Model to use (overrides agent config) | Agent's configured model |

**Behavior:**
- Executes specified agent with default engine configuration
- Supports engine-specific variants (e.g., `codemachine claude agent`)
- Overrides agent config when `--model` provided

**Engine-Specific Commands:**
Each registered engine can be invoked directly:
```bash
codemachine claude agent my-agent "Do something"
codemachine codex agent my-agent "Do something"
codemachine cursor agent my-agent "Do something"
```

**Examples:**
```bash
# Execute agent with default engine
codemachine agent code-generator "Create a login component"

# Execute with specific engine
codemachine claude agent code-generator "Create a login component"

# Override model
codemachine agent code-generator "Create a login component" --model gpt-4

# Multi-word prompt
codemachine agent reviewer "Review the authentication module for security issues"

# In specific workspace
codemachine -d /my/project agent my-agent "Generate tests"
```

**Agent Resolution:**
1. Searches `config/main.agents.js`
2. Searches `config/sub.agents.js`
3. Throws error if agent ID not found

**Use Cases:**
- Quick agent testing during development
- One-off code generation tasks
- Agent behavior validation
- Debugging agent prompts

**Technical Details:**
- Source: `src/cli/commands/agent.command.ts`
- Dynamically registers engine-specific subcommands
- Uses default engine or specified engine variant
- Variadic prompt arguments joined with spaces

---

### `step`

Execute a single workflow step using an agent from the main agents configuration.

**Syntax:**
```bash
codemachine step [options] <id> [prompt...]
```

**Arguments:**

| Argument | Required | Description |
|----------|----------|-------------|
| `<id>` | Yes | Agent ID from `config/main.agents.js` |
| `[prompt...]` | No | Optional additional prompt to append to agent's main prompt |

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--model <model>` | Model to use | Resolved from priority chain |
| `--engine <engine>` | Engine to use | Resolved from priority chain |
| `--reasoning <level>` | Reasoning effort: `low`, `medium`, or `high` | Agent's config or engine default |

**Option Resolution Priority:**

**Engine Resolution:**
1. CLI `--engine` override
2. Agent config `engine` property
3. First authenticated engine
4. Default engine (first registered)

**Model Resolution:**
1. CLI `--model` override
2. Agent config `model` property
3. Engine's default model

**Reasoning Resolution:**
1. CLI `--reasoning` override
2. Agent config `modelReasoningEffort`
3. Engine default reasoning level

**Behavior:**
- Executes main workflow agent in isolated step
- Requires engine authentication
- Displays formatted output with spinning indicators
- Stores last 2000 characters in memory

**Examples:**
```bash
# Execute step with agent's default config
codemachine step planner

# Execute with additional prompt
codemachine step planner "Focus on microservices architecture"

# Override engine
codemachine step planner --engine claude

# Override model
codemachine step planner --model gpt-4-turbo

# Override reasoning level
codemachine step planner --reasoning high

# Combine multiple overrides
codemachine step planner "Design API" --engine codex --model gpt-4 --reasoning high

# Execute in specific workspace
codemachine -d /project step implementation "Add error handling"
```

**Authentication:**
- Requires authenticated engine
- Error message if engine not authenticated:
  ```
  Engine '[engine-name]' requires authentication.
  Run: codemachine auth login
  ```

**Agent Source:**
- Only searches `config/main.agents.js`
- Does not search `config/sub.agents.js`
- Throws error if agent not found in main agents

**Use Cases:**
- Test individual workflow steps
- Debug main agents in isolation
- Experiment with different models/engines
- Run specific workflow phases manually

**Technical Details:**
- Source: `src/cli/commands/step.command.ts`
- Output formatting with typewriter effect
- Memory preservation for session context
- Authentication validation before execution

---

## Configuration Commands

Commands for managing authentication and system configuration.

### `auth`

Authentication management for AI engine providers.

**Subcommands:**
- `auth login` - Authenticate with a provider
- `auth logout` - Logout from a provider

---

#### `auth login`

Authenticate with CodeMachine AI engine services.

**Syntax:**
```bash
codemachine auth login
```

**Arguments:** None

**Options:** None

**Behavior:**
- Displays interactive provider selection menu
- Lists all registered engine providers
- Calls provider's authentication system
- Stores credentials securely per engine

**Provider Selection:**
Interactive menu shows:
- Provider name
- Authentication status (authenticated/not authenticated)

**Already Authenticated:**
If already authenticated, displays:
```
Already authenticated with [Provider].
Use `codemachine auth logout` to sign out.
```

**Examples:**
```bash
# Interactive provider login
codemachine auth login

# Returns to menu after authentication
# Can authenticate multiple providers
```

**Authentication Flow:**
1. Display registered providers
2. User selects provider
3. Provider-specific auth process (API key, OAuth, etc.)
4. Credentials stored in engine config
5. Confirmation message

**Use Cases:**
- Initial setup of AI engines
- Re-authenticate expired sessions
- Switch between different provider accounts
- Enable new engines in workspace

**Technical Details:**
- Source: `src/cli/commands/auth.command.ts`
- Providers loaded from engine registry
- Engine-specific authentication handlers
- Secure credential storage

---

#### `auth logout`

Logout from CodeMachine AI engine services.

**Syntax:**
```bash
codemachine auth logout
```

**Arguments:** None

**Options:** None

**Behavior:**
- Displays interactive provider selection menu
- Shows only authenticated providers
- Clears authentication for selected provider
- Updates engine configuration

**Logout Confirmation:**
```
Signed out from [Provider].
Next action will be `login`.
```

**Examples:**
```bash
# Interactive provider logout
codemachine auth logout

# Select provider from menu
# Credentials cleared
```

**Use Cases:**
- Switch provider accounts
- Remove expired credentials
- Security: clear credentials when sharing machine
- Testing unauthenticated flows

**Technical Details:**
- Source: `src/cli/commands/auth.command.ts`
- Clears provider-specific credentials
- Updates configuration files
- Preserves other provider authentications

---

## Utility Commands

Utility and informational commands.

### `version`

Display the CodeMachine CLI version.

**Syntax:**
```bash
codemachine version
codemachine --version
codemachine -V
```

**Arguments:** None

**Options:** None

**Output:**
```
CodeMachine v[version]
```

**Examples:**
```bash
codemachine version
# Output: CodeMachine v1.0.0
```

**Use Cases:**
- Verify installation
- Check for updates
- Bug reporting
- Compatibility checks

---

## Advanced Topics

### Engine-Specific Commands

CodeMachine dynamically registers engine-specific command variants for each registered AI engine.

**Pattern:**
```bash
codemachine <engine-name> agent <id> <prompt...>
```

**Examples:**
```bash
# Claude-specific agent execution
codemachine claude agent my-agent "Generate code"

# Codex-specific agent execution
codemachine codex agent my-agent "Generate code"

# Cursor engine variant
codemachine cursor agent my-agent "Generate code"
```

**Behavior:**
- Same options and arguments as main `agent` command
- Forces execution with specific engine
- Useful for engine comparison and testing

**Dynamic Registration:**
- Commands registered automatically at startup
- Based on engines in engine registry
- Each engine gets its own subcommand namespace

---

### Startup and Initialization

**CLI Startup Flow:**

1. **Parse Global Options**
   - Check for `-d/--dir` to set working directory
   - Check for `--spec` to override default specification path

2. **Pre-Action Hook**
   - Sync configuration for all registered engines
   - Validate workspace structure

3. **Bootstrap Workspace**
   - If `.codemachine/` doesn't exist:
     - Create directory structure
     - Initialize with default template
     - Create default spec file

4. **Register Commands**
   - Register all standard commands
   - Dynamically register engine-specific commands

5. **Execute Command or Enter Interactive Mode**
   - If command provided: execute and exit
   - If no command: enter interactive session shell

**Default Workspace Bootstrap:**
```
.codemachine/
├── inputs/
│   └── specifications.md     # Created with template
├── template.json              # Set to default template
└── [engine configs]           # Created on first auth
```
---

## Quick Reference

**Most Common Commands:**

```bash
# Start interactive session
codemachine

# Run workflow
codemachine start

# Select template
codemachine templates

# Authenticate
codemachine auth login

# Execute agent
codemachine agent <id> "<prompt>"

# Execute workflow step
codemachine step <id>

# Check version
codemachine version
```

**With Options:**

```bash
# Set workspace
codemachine -d /path/to/project

# Custom spec
codemachine start --spec ./specs/custom.md

# Override model
codemachine step planner --model gpt-4

# Override engine and reasoning
codemachine step planner --engine claude --reasoning high
```
