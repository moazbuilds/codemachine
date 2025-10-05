# Agent Orchestration Guide

## Command Pattern

### Single Agent Invocation

Use this command to invoke one agent:

```bash
codemachine agent <agentId> "PROMPT"
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
