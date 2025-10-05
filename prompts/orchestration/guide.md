# Agent Orchestration Guide

## Command Pattern

### Single Agent Invocation

Use this command to invoke one agent:

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

**Example:**
```bash
codemachine agent code-generator "Implement the user authentication module"
```

### Sequential Execution

When tasks have dependencies, execute agents one after another:

```bash
codemachine agent arch-agent "Design the database schema"
# Wait for completion, verify output
codemachine agent code-generator "Generate models based on the schema"
# Wait for completion, verify output
codemachine agent test-writer "Write tests for the models"
```

### Parallel Execution

When tasks are independent, invoke multiple agents concurrently using `&`:

```bash
codemachine agent code-generator "Implement feature A" &
codemachine agent code-generator "Implement feature B" &
codemachine agent test-writer "Write tests for module C" &
# All run in parallel since they don't depend on each other
```

## Core Rules

- **MUST** use command pattern: `codemachine agent <agentId> "PROMPT"`
- **MUST** wait for agent response before proceeding in sequential mode
- **MUST** verify agent output meets requirements
- **MUST NOT** write code directly  only orchestrate agents
