# Customizing Workflows

Complete guide to customizing CodeMachine workflows, agents, and configurations.

## Overview

CodeMachine workflows are highly customizable through configuration files and workflow templates. This guide covers everything you need to create, customize, and optimize workflows for your specific use cases.

**What You Can Customize:**
- Agent definitions and roles
- Workflow step sequences
- AI engines and models per step
- Loop and trigger behaviors
- Fallback handling
- Execution policies

---

## Configuration Files

All configuration files are located in the `config/` directory at the project root.

### Directory Structure

```
config/
├── main.agents.js      # Primary workflow agents
├── sub.agents.js       # Sub-agents for orchestration
├── modules.js          # Workflow modules (loop/trigger behaviors)
├── placeholders.js     # Path placeholder definitions
└── package.json        # Config package metadata
```

---

## Main Agents Configuration

**File:** `config/main.agents.js`

Main agents represent the primary steps in your workflow execution. These are the agents that appear in workflow templates and execute sequentially.

### Structure

```javascript
export default {
  agents: [
    {
      id: 'agent-identifier',           // Required: Unique ID
      name: 'Human Readable Name',      // Required: Display name
      description: 'Agent role...',     // Required: Purpose description
      promptPath: 'path/to/prompt.md'   // Required: Prompt template path
    }
  ]
};
```

### Real Example: CodeMachine Main Agents

```javascript
export default {
  agents: [
    {
      id: 'arch-agent',
      name: 'Architecture Agent',
      description: 'Defines the system architecture and technical decisions',
      promptPath: 'prompts/templates/codemachine/agents/01-architecture-agent.md'
    },
    {
      id: 'plan-agent',
      name: 'Plan Agent',
      description: 'Generates comprehensive development plans',
      promptPath: 'prompts/templates/codemachine/agents/02-planning-agent.md'
    },
    {
      id: 'task-breakdown',
      name: 'Task Breakdown Agent',
      description: 'Structures work into discrete, executable tasks (JSON format)',
      promptPath: 'prompts/templates/codemachine/agents/03-task-breakdown-agent.md'
    }
  ]
};
```
---

## Sub-Agents Configuration

**File:** `config/sub.agents.js`

Sub-agents are specialized agents that can be invoked by main agents for specific tasks. They're useful for domain-specific expertise and parallel execution patterns.

### Structure

```javascript
export default {
  agents: [
    {
      id: 'sub-agent-id',
      name: 'Display Name',
      description: 'Specialized role description',
      promptPath: 'path/to/prompt.md'
    }
  ]
};
```

### Real Example: CodeMachine Sub-Agents

```javascript
export default {
  agents: [
    {
      id: 'uxui-designer',
      name: 'UX/UI Designer',
      description: 'Specializes in user experience and interface design',
      promptPath: 'prompts/templates/codemachine/sub-agents/uxui-designer.md'
    },
    {
      id: 'frontend-dev',
      name: 'Frontend Developer',
      description: 'Frontend development specialist',
      promptPath: 'prompts/templates/codemachine/sub-agents/frontend-developer.md'
    },
    {
      id: 'backend-dev',
      name: 'Backend Developer',
      description: 'Backend development specialist',
      promptPath: 'prompts/templates/codemachine/sub-agents/backend-developer.md'
    },
    {
      id: 'solution-architect',
      name: 'Solution Architect',
      description: 'Solution architecture specialist',
      promptPath: 'prompts/templates/codemachine/sub-agents/solution-architect.md'
    },
    {
      id: 'technical-writer',
      name: 'Technical Writer',
      description: 'Documentation specialist',
      promptPath: 'prompts/templates/codemachine/sub-agents/technical-writer.md'
    }
  ]
};
```

### When to Use Sub-Agents

- **Specialized expertise:** Domain-specific tasks (frontend, backend, QA)
- **Parallel execution:** Multiple sub-agents working simultaneously
- **Dynamic orchestration:** Main agent decides which sub-agents to invoke
- **Context isolation:** Each sub-agent works in its own context

---

## Workflow Modules Configuration

**File:** `config/modules.js`

Modules are special agents that trigger specific workflow behaviors like loops and conditional agent calls.

### Module Types

#### 1. Loop Behavior

Allows workflows to repeat previous steps based on validation results.

**Structure:**
```javascript
{
  id: 'module-id',
  name: 'Module Name',
  promptPath: 'path/to/prompt.md',
  behavior: {
    type: 'loop',
    action: 'stepBack',
    steps: number,              // How many steps to go back
    maxIterations: number,      // Maximum loop count
    skip: ['agent-id']          // Agent IDs to skip when looping
  }
}
```

**Real Example:**
```javascript
{
  id: 'check-task',
  name: 'Check Task',
  promptPath: 'prompts/templates/codemachine/workflows/task-verification-workflow.md',
  behavior: {
    type: 'loop',
    action: 'stepBack',
    steps: 6,                   // Go back 6 steps
    maxIterations: 20,          // Maximum 20 iterations
    skip: ['runtime-prep']      // Skip runtime-prep when looping
  }
}
```

**Use Cases:**
- Task validation with retry logic
- Code review loops until approval
- Iterative refinement workflows
- Quality gates with re-execution

#### 2. Trigger Behavior

Allows workflows to dynamically call specific agents based on runtime conditions.

**Structure:**
```javascript
{
  id: 'module-id',
  name: 'Module Name',
  promptPath: 'path/to/prompt.md',
  behavior: {
    type: 'trigger',
    action: 'mainAgentCall',
    triggerAgentId: 'default-agent-id'  // Default agent to trigger
  }
}
```

**Real Example:**
```javascript
{
  id: 'iteration-checker',
  name: 'Iteration Checker',
  promptPath: 'prompts/templates/codemachine/workflows/iteration-verification-workflow.md',
  behavior: {
    type: 'trigger',
    action: 'mainAgentCall',
    triggerAgentId: 'context-manager'   // Default trigger
  }
}
```

**Use Cases:**
- Conditional workflow branching
- Dynamic agent selection
- Context-aware routing
- Adaptive workflows

---

## Path Placeholders Configuration

**File:** `config/placeholders.js`

Defines reusable path placeholders for prompt templates and workflow artifacts.

### User Directory Paths

Paths within the user's `.codemachine/` workspace:

```javascript
export const userDir = {
  specifications: '.codemachine/inputs/specifications.md',
  architecture: '.codemachine/artifacts/architecture/*.md',
  architecture_manifest_json: '.codemachine/artifacts/architecture/architecture_manifest.json',
  plan: '.codemachine/artifacts/plan/*.md',
  plan_manifest_json: '.codemachine/artifacts/plan/plan_manifest.json',
  plan_fallback: '.codemachine/prompts/plan_fallback.md',
  tasks: '.codemachine/artifacts/tasks.json',
  all_tasks_json: '.codemachine/artifacts/tasks/*.json',
  task_fallback: '.codemachine/prompts/task_fallback.md',
  context: '.codemachine/prompts/context.md',
  code_fallback: '.codemachine/prompts/code_fallback.md'
};
```

### Package Directory Paths

Paths within the CodeMachine package:

```javascript
export const packageDir = {
  orchestration_guide: 'prompts/orchestration/guide.md',
  arch_output_format: 'prompts/templates/codemachine/output-formats/architecture-output.md',
  plan_output_format: 'prompts/templates/codemachine/output-formats/planning-output.md',
  task_output_format: 'prompts/templates/codemachine/output-formats/task-breakdown-output.md',
  context_output_format: 'prompts/templates/codemachine/output-formats/context-output.md',
  task_validation_output_format: 'prompts/templates/codemachine/output-formats/task-validation-output.md'
};
```

### Using Placeholders in Prompts

Placeholders are automatically resolved when prompts are loaded:

```markdown
<!-- In your prompt template -->
Read the specifications from: {{userDir.specifications}}
Follow the format in: {{packageDir.plan_output_format}}
```

---

## Workflow Templates

**Location:** `templates/workflows/`

Workflow templates define the sequence of agent steps and their configurations.

### Template Structure

```javascript
export default {
  name: 'Workflow Name',      // Required: Display name

  steps: [                    // Required: Array of workflow steps
    // Step definitions...
  ],

  subAgentIds: [              // Optional: Available sub-agents
    'sub-agent-id'
  ]
};
```

### Step Resolution Functions

#### `resolveStep(agentId, overrides?)`

Resolves a single agent step with optional configuration overrides.

**Basic Usage:**
```javascript
resolveStep('arch-agent')
```

**With Overrides:**
```javascript
resolveStep('plan-agent', {
  executeOnce: true,
  engine: 'claude',
  model: 'opus',
  modelReasoningEffort: 'high',
  agentName: 'Senior Architect',
  promptPath: './custom/prompt.md',
  notCompletedFallback: 'plan-fallback'
})
```

#### `resolveModule(moduleId, overrides?)`

Resolves a workflow module with behavior configuration.

**Usage:**
```javascript
resolveModule('check-task', {
  loopSteps: 6,
  loopMaxIterations: 20,
  loopSkip: ['runtime-prep'],
  engine: 'cursor'
})
```

#### `resolveFolder(folderName, overrides?)`

Loads multiple numbered agent files from a folder.

**Usage:**
```javascript
...resolveFolder('codemachine', {
  engine: 'claude',
  model: 'opus',
  modelReasoningEffort: 'medium'
})
```

**Folder Structure:**
```
prompts/templates/codemachine/agents/
├── 01-architecture-agent.md
├── 02-planning-agent.md
├── 03-task-breakdown-agent.md
└── ...
```

Files are loaded in numerical order (0-*, 1-*, 2-*, etc.).

---

## Complete Override Options Reference

### Step Overrides

All overrides available for `resolveStep()` and `resolveModule()`:

| Option | Type | Description | Example |
|--------|------|-------------|---------|
| `executeOnce` | `boolean` | Run step only once per workflow | `true` |
| `engine` | `string` | AI engine to use | `'claude'`, `'codex'`, `'cursor'`, `'ccr'`, `'opencode'` |
| `model` | `string` | Specific AI model | `'gpt-5-codex'`, `'opus'`, `'gpt-4'` |
| `modelReasoningEffort` | `string` | Reasoning depth level | `'low'`, `'medium'`, `'high'` |
| `agentName` | `string` | Custom display name | `'Senior Architect'` |
| `promptPath` | `string` | Custom prompt template path | `'./prompts/custom.md'` |
| `notCompletedFallback` | `string` | Fallback agent ID on failure | `'plan-fallback'` |

### Module-Specific Overrides

Additional options for `resolveModule()`:

| Option | Type | Description | Example |
|--------|------|-------------|---------|
| `loopSteps` | `number` | Steps to go back when looping | `6` |
| `loopMaxIterations` | `number` | Maximum loop iterations | `20` |
| `loopSkip` | `string[]` | Agent IDs to skip in loop | `['runtime-prep']` |

---

## Engine & Model Configuration

### Available Engines

CodeMachine supports the following AI engines:

1. **claude** - Anthropic Claude models
2. **codex** - OpenAI Codex models
3. **cursor** - Cursor AI models
4. **ccr** - Claude Code Router CLI (brings your locally configured providers)
5. **opencode** - OpenCode CLI (provider-agnostic; supply `provider/model` strings such as `anthropic/claude-3.7-sonnet`)

### Engine Selection Strategy

**By Task Type:**
```javascript
steps: [
  resolveStep('planning', { engine: 'claude' }),      // Strategic thinking
  resolveStep('code-gen', { engine: 'codex' }),       // Code generation
  resolveStep('review', { engine: 'claude' }),        // Analysis & review
  resolveStep('docs', { engine: 'claude' }),          // Documentation
  resolveStep('commit', { engine: 'cursor' })         // Git operations
]
```

**Mixed Engine Workflow:**
```javascript
steps: [
  resolveStep('arch-agent', { engine: 'claude', model: 'opus' }),
  resolveStep('code-generation', { engine: 'codex', model: 'gpt-5-codex' }),
  resolveStep('task-sanity-check', { engine: 'codex', model: 'gpt-5' }),
  resolveStep('git-commit', { engine: 'cursor' })
]
```

### Model Options

**Claude Models:**
- `opus` - Most capable, best for complex reasoning
- `sonnet` - Balanced performance
- `haiku` - Fast, efficient

**Codex Models:**
- `gpt-5-codex` - Latest code-specialized model
- `gpt-5` - General purpose GPT-5
- `gpt-4` - Stable, reliable

**Cursor Models:**
- Engine-specific models (check Cursor documentation)

**OpenCode Models:**
- Provide the CLI-formatted `provider/model` name directly (e.g., `anthropic/claude-3.7-sonnet`, `openai/gpt-4.1`); CodeMachine passes the value through so you can mirror your OpenCode config.

### Reasoning Effort Levels

Controls how much "thinking" the model does:

- `'low'` - Fast, direct responses
- `'medium'` - Balanced thinking and speed (default)
- `'high'` - Deep reasoning, longer processing

**Example:**
```javascript
resolveStep('complex-analysis', {
  engine: 'claude',
  model: 'sonnet',
  modelReasoningEffort: 'high'  // Maximum reasoning depth
})
```
---

### Engine Selection

```javascript
// Planning & Analysis
{ engine: 'claude', model: 'sonnet' }

// Code Generation
{ engine: 'codex', model: 'gpt-5-codex' }

// Git Operations
{ engine: 'cursor' }
```
