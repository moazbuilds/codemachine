# Run Command Guide

The `run` command is the unified interface for executing agents in CodeMachine, replacing both `agent` and `orchestrate` commands with enhanced syntax support.

## Basic Usage

```bash
codemachine run "<script>"
```

## Single Agent Execution

### Simple Syntax
```bash
codemachine run "agent-name 'your prompt here'"
```

### Enhanced Syntax

```bash
# With input files
codemachine run "system-analyst[input:.codemachine/agents/analyst.md] 'analyze architecture'"

# With tail limiting (return only last 100 lines)
codemachine run "code-generator[tail:100] 'build feature'"

# Multiple input files (semicolon-separated)
codemachine run "arch-writer[input:design.md;spec.md;requirements.md]"

# Combined options
codemachine run "frontend-dev[input:ui-spec.md,tail:50] 'implement dashboard'"

# No prompt - uses agent template only
codemachine run "system-analyst[input:context.md]"
```

## Multi-Agent Orchestration

### Parallel Execution (`&`)

Run multiple agents simultaneously:

```bash
codemachine run "frontend 'Build UI' & backend 'Build API' & db 'Setup schema'"
```

With enhanced syntax:

```bash
codemachine run "frontend[input:design.md,tail:100] & backend[input:api-spec.md,tail:100] & db[tail:50]"
```

### Sequential Execution (`&&`)

Run agents one after another (stops on failure):

```bash
codemachine run "db 'Setup schema' && backend 'Create models' && api 'Build endpoints'"
```

With enhanced syntax:

```bash
codemachine run "db[tail:50] 'setup schema' && backend[input:schema.md,tail:100] 'create models'"
```

### Mixed Execution

Combine sequential and parallel:

```bash
codemachine run "db 'setup' && frontend 'UI' & backend 'API' && test 'e2e'"
```

## Enhanced Syntax Reference

### Input Files

Load context from one or more files:

```bash
# Single file
agent[input:path/to/file.md]

# Multiple files (semicolon-separated)
agent[input:file1.md;file2.md;file3.md]

# Absolute or relative paths
agent[input:/absolute/path.md;relative/path.md]
```

Input files are prepended to the agent's prompt in the following structure:

```
[INPUT FILES]
=== File: file1.md ===
{contents}
============================================================

=== File: file2.md ===
{contents}
============================================================

[SYSTEM]
{agent template}

[REQUEST]
{your prompt}
```

### Tail Limiting

Limit output to the last N lines:

```bash
# Return only last 100 lines
agent[tail:100]

# Combined with prompt
agent[tail:50] 'your prompt here'

# Combined with input files
agent[input:spec.md,tail:100] 'analyze'
```

**Note:** Full output is still saved in log files (`.codemachine/logs/`), tail limiting only affects the returned output.

### Optional Prompt

The prompt is now optional - agents can use only their template:

```bash
# No prompt - uses agent template + input files
agent[input:context.md]

# With prompt
agent[input:context.md] 'analyze this'

# Prompt in options (alternative syntax)
agent[input:file.md,prompt:"analyze this"]
```

### Combining Options

Options are comma-separated within brackets:

```bash
agent[input:file1.md;file2.md,tail:100,prompt:"analyze"]
```

## Options

- `--model <model>` - Override the model specified in agent config
- `-d, --dir <directory>` - Set working directory (default: current directory)

## Engine-Specific Variants

You can specify which AI engine to use:

```bash
# Use Claude engine
codemachine claude run "agent 'prompt'"

# Use Codex engine
codemachine codex run "agent 'prompt'"

# Use Cursor engine
codemachine cursor run "agent 'prompt'"
```

## Examples

### Basic Agent Execution

```bash
codemachine run "code-generator 'Implement user authentication'"
```

### Agent with Context Files

```bash
codemachine run "system-analyst[input:requirements.md;design.md] 'create system architecture'"
```

### Limited Output

```bash
codemachine run "test-runner[tail:50] 'run unit tests'"
```

### Complex Orchestration

```bash
codemachine run "db[tail:30] 'setup schema' && \
  backend[input:schema.md,tail:100] 'generate models' & \
  frontend[input:api-spec.md,tail:100] 'create API client' && \
  test[tail:50] 'run integration tests'"
```

## Migration from Legacy Commands

### From `agent` command

**Before:**
```bash
codemachine agent code-generator "Build feature"
```

**After:**
```bash
codemachine run "code-generator 'Build feature'"
```

### From `orchestrate` command

**Before:**
```bash
codemachine orchestrate "frontend 'UI' & backend 'API'"
```

**After:**
```bash
codemachine run "frontend 'UI' & backend 'API'"
```

The old commands (`agent` and `orchestrate`) are still available for backward compatibility but are deprecated and will be removed in a future version.

## Shell Escaping

When using special characters in prompts, proper shell escaping is important:

```bash
# Use single quotes to preserve special characters
codemachine run "agent 'prompt with $VAR and \"quotes\"'"

# Or use double quotes with escaping
codemachine run "agent \"prompt with \$VAR and \\\"quotes\\\"\""

# For multi-line prompts
codemachine run "agent '$(cat <<'EOF'
Line 1
Line 2
Line 3
EOF
)'"
```

## Viewing Results

After execution, view agent logs:

```bash
# List all agents
codemachine agents list

# View specific agent log
codemachine agents logs <agent-id>
```

Full output is always saved in `.codemachine/logs/` regardless of tail limiting.
