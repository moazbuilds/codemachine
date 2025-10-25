# Agent Orchestration Guide

## Command Pattern

### Single Agent Invocation

Use the `run` command to execute agents with enhanced syntax:

```bash
codemachine run "<agentId> 'PROMPT'"
# or with enhanced syntax
codemachine run "agent[input:file.md,tail:100] 'PROMPT'"
```

**Legacy command (still supported):**
```bash
codemachine agent <agentId> "PROMPT"
```

**IMPORTANT - Shell Escaping Rules:**

When passing prompts through the shell, you MUST properly escape special characters to prevent issues:

1. **Use printf %q for automatic escaping** (recommended):
```bash
prompt="Your prompt with $variables and 'quotes'"
codemachine agent <agentId> "$(printf %q "$prompt")"
```

2. **Or wrap prompts in single quotes and escape single quotes**:
```bash
# For prompts with special chars: $, `, ", \, etc.
codemachine agent code-generator 'Implement feature with $VAR and "quotes"'

# If prompt contains single quotes, escape them:
codemachine agent code-generator 'It'\''s a test'  # Outputs: It's a test
```

3. **For multi-line prompts, use here-documents**:
```bash
codemachine agent code-generator "$(cat <<'EOF'
Line 1 with $variables
Line 2 with "quotes"
Line 3 with special chars
EOF
)"
```

**Basic Example:**
```bash
codemachine run "code-generator 'Implement the user authentication module'"
```

**Enhanced Syntax Examples:**

```bash
# With input files
codemachine run "system-analyst[input:.codemachine/agents/analyst.md] 'analyze architecture'"

# With tail limiting (return only last 100 lines)
codemachine run "code-generator[tail:100] 'build feature'"

# Multiple input files (semicolon-separated)
codemachine run "arch-writer[input:design.md;spec.md;requirements.md]"

# Combined options
codemachine run "frontend-dev[input:ui-spec.md,tail:50] 'implement dashboard'"
```

### Sequential Execution

Execute agents one after another using `&&`:

```bash
codemachine run "arch-agent 'Design database schema' && code-generator 'Generate models' && test-writer 'Write tests'"
```

**With enhanced syntax:**
```bash
codemachine run "db[tail:50] 'setup schema' && backend[input:schema.md,tail:100] 'create models'"
```

### Parallel Execution

Execute multiple agents concurrently using `&`:

```bash
codemachine run "frontend 'Build UI' & backend 'Build API' & db 'Setup schema'"
```

**With enhanced syntax:**
```bash
codemachine run "frontend[input:design.md,tail:100] & backend[input:api-spec.md,tail:100] & db[tail:50]"
```

### Mixed Execution

Combine sequential and parallel execution:

```bash
codemachine run "db 'setup' && frontend 'UI' & backend 'API' && test 'e2e'"
```

## Core Rules

- **MUST** use command pattern: `codemachine agent <agentId> "PROMPT"`
- **MUST** wait for agent response before proceeding in sequential mode
- **MUST** verify agent output meets requirements
- **MUST NOT** write code directly  only orchestrate agents
