# CodeMachine - CLI Coding Agent Specification

## 🎯 Project Overview

### Problem Statement
Developers waste significant time generating large, complex codebases. Current AI coding agents handle small to medium tasks well but fail with large projects, leaving gaps and missing components. No efficient tool exists to generate, test, and deliver production-ready complex projects from a single prompt or documentation.

### Solution
A cross-platform CLI coding agent that runs locally and generates complete, tested, production-ready codebases from structured specifications.

### Target Users
- Professional developers
- Code enthusiasts ("vibecoders")
- Teams needing rapid prototyping

---

## 🚀 Core Features

### Installation & Usage
- **Install**: `npm install -g codemachine`
- **Run**: `codemachine`
- **Platform Support**: macOS, Linux, Windows (CMD & PowerShell)
- **License**: Open Source

### Technology Stack
- **Language**: TypeScript (Node.js)
- **AI Models**: Codex models
- **Architecture**: Multi-agent orchestration system

---

## 🏗️ System Architecture

### Agent Hierarchy

#### 1. Main Agents (Core System)

| Agent Name | Role | Responsibility | Location |
|------------|------|----------------|----------|
| `agents-builder` | Team Builder | Creates specialized agents based on project; generates `tasks.json` | `prompts/agents/agents-builder.md` |
| `master-mind` | Project Manager/Scrum Master | Orchestrates agents via `tasks.json`; evaluates results; marks tasks done | `prompts/agents/master-mind.md` |
| `project-summarizer` | Project Summarizer | Auto-runs when Master Mind stops; delivers final summary to the user | `prompts/agents/project-summarizer.md` |

#### 2. Specialized Agents (Dynamic - Configured via config/sub.agents.js)

| Agent Name | Role | Responsibility | Model | Reasoning |
|------------|------|----------------|-------|-----------|
| `uxui-designer` | UX/UI Designer | Handles design system and UI components | `gpt-5-codex` | `medium` |
| `frontend-dev` | Frontend Developer | Implements client-side code | `gpt-5-codex` | `medium` |
| `backend-dev` | Backend Developer | Develops server-side logic and APIs | `gpt-5-codex` | `high` |
| `solution-architect` | Solution Architect | Designs system architecture | `gpt-5-codex` | `high` |
| `software-architect` | Software Architect | Plans directory structure | `gpt-5-codex` | `medium` |
| `technical-writer` | Documentation Specialist | Creates documentation | `gpt-5-codex` | `low` |
| `qa-engineer` | QA/Test Engineer | Writes tests and ensures quality | `gpt-5-codex` | `medium` |
| `performance-engineer` | Performance Engineer | Optimizes code performance | `gpt-5-codex` | `high` |

#### 3. Control Agents

| Agent Name | Role | Responsibility | Function |
|------------|------|----------------|----------|
| `retry` | Retry Controller | Runs when tasks incomplete; restarts Master Mind with summary | Continues from last completed task |
| `end` | Completion Handler | Runs when all tasks done; confirms completion to user | Displays success message in CLI |
| `memory` | Memory Manager | Adds context to every agent call | Provides memory location in composite prompts |

---

## 📁 Project Structure

### Global Installation Package Structure
The main codemachine package installed globally via npm:

```
codemachine/
├── config/
│   ├── main.agents.js           # Core workflow agent definitions
│   ├── sub.agents.js            # Specialized agent catalog (tunable model/effort)
│   └── package.json             # CommonJS mode for agent modules
├── settings.js                    # Main app configuration (port, logging, mode)
├── prompts/
│   ├── agents/
│   │   ├── agents-builder.md     # Team building prompts
│   │   ├── master-mind.md        # Orchestration prompts
│   │   ├── project-summarizer.md # Summary generation prompts
│   ├── controls/
│   │   ├── retry.md               # Retry logic prompts
│   │   ├── end.md                 # Termination prompts
│   │   └── memory.md              # Context management prompts
└── [other CLI code files]        # TO BE CREATED BY BUILDERS
```

**IMPORTANT NOTE FOR BUILDERS**: The `[other CLI code files]` must be created to implement the CLI functionality, but the directory structure and files listed above are strict requirements that cannot be modified.

### User Home Configuration
Global configuration in user's home directory:

```
~/.codemachine/
├── codex/
│   ├── config.toml               # Codex API configuration
│   └── auth.json                # Authentication credentials
```

### Project Working Directory Structure
Generated in each project where codemachine is run:

```
[project-directory]/
├── .codemachine/
│   ├── agents/                   # Project-specific agent prompts
│   │   ├── ux-ui-designer.md
│   │   ├── frontend-developer.md
│   │   ├── backend-developer.md
│   │   ├── solution-architect.md
│   │   ├── software-architect.md
│   │   ├── technical-writer.md
│   │   ├── qa-test-engineer.md
│   │   └── performance-engineer.md
│   ├── inputs/                   # User-provided context files
│   │   └── specifications.md     # Project specifications
│   ├── plan/                     # Execution plans
│   │   └── tasks.json           # Task list with status tracking
│   ├── memory/                   # Agent memory files
│   │   ├── .frontend-memory.md   # Frontend agent's memory
│   │   ├── .backend-memory.md    # Backend agent's memory
│   │   └── .qa-memory.md         # QA agent's memory
└── [generated project files]
```

### tasks.json Structure
```json
{
  "tasks": [
    {
      "id": "T1",
      "name": "Setup project structure",
      "details": "Create initial directory structure and configuration files",
      "acceptanceCriteria": "All folders created, package.json initialized",
      "phase": "Planning",
      "done": false,
      "subtasks": [
        {
          "id": "T1.1",
          "name": "Initialize package.json",
          "details": "Create package.json with project metadata and dependencies"
        },
        {
          "id": "T1.2",
          "name": "Create folder structure",
          "details": "Set up src, public, and config directories"
        }
      ]
    },
    {
      "id": "T2",
      "name": "Create homepage component",
      "details": "Implement homepage with navigation and hero section",
      "acceptanceCriteria": "Homepage renders, navigation works, responsive design",
      "phase": "Building",
      "done": false,
      "subtasks": [
        {
          "id": "T2.1",
          "name": "Design homepage layout",
          "details": "Create wireframe and component structure"
        },
        {
          "id": "T2.2",
          "name": "Implement navigation",
          "details": "Build responsive navigation component"
        },
        {
          "id": "T2.3",
          "name": "Add hero section",
          "details": "Create hero banner with call-to-action"
        }
      ]
    }
    // ... more tasks
  ]
}
```

---

## 🔄 Workflow Process

### Every CodeMachine Run (Any Directory)
When user runs `codemachine` in any directory:

1. **Config.toml Update (Always)**
   - Navigates to `~/.codemachine/codex/`
   - Reads the current `config/sub.agents.js` configuration
   - Overwrites `config.toml` with latest agent profiles
   - Ensures profiles are always synchronized

2. **Project Directory Setup (Always)**
   - Creates `.codemachine/` structure in current directory if not exists:
   ```
   .codemachine/
   ├── agents/
   │   └── agents-config.json    # Mock file with agents data from config/main.agents.js and config/sub.agents.js
   ├── inputs/
   │   └── specifications.md
   ├── memory/
   └── plan/
   ```
   - **Creates `agents-config.json`**: A mock file containing agent data retrieved from `config/main.agents.js` and `config/sub.agents.js`
   - This allows agents-builder to access agent configurations without accessing global files
   - This happens immediately on run, not just on `/start`

3. **Authentication Check**
  - Checks for `~/.codemachine/codex/auth.json`
   - If not found: Shows `/login` option
   - If found: Shows `/logout` option and proceeds to main menu

### First-Time Setup
When auth.json is not found:

1. **Authentication**
   - Executes: `CODEX_HOME="$HOME/.codemachine/codex" codex login`
   - Opens OpenAI login page in browser
   - Codex automatically creates directory structure upon successful login:
  ```
  ~/.codemachine/
  ├── codex/
  │   ├── config.toml    # Created by Codex
  │   └── auth.json      # Created by Codex
   ```

2. **Config Modification**
   - After login success, CodeMachine navigates to `~/.codemachine/codex/`
   - Overwrites `config.toml` with agent profiles from `config/main.agents.js` and `config/sub.agents.js`
   - Respects each agent's `model` and `modelReasoningEffort`, so editing `config/sub.agents.js` tunes the generated profiles
   - Marks login as completed

3. **Main Menu**
   After login, displays options:
   - `/start` - Begin project generation
   - `/templates` - Select project template (currently: build)
   - `/login` or `/logout` - Displayed based on auth.json presence
   - `/version` - Show CodeMachine version
   - `/help` - Display help information
   - `/mcp` - Model Context Protocol (coming soon)

### Project Generation Workflow

#### Phase 1: Project Initialization
When user selects `/start`:

1. **Specification Confirmation**
   - Prompts: "Have you written the full specification in `.codemachine/inputs/specifications.md` and added all necessary context files?"
   - If YES: Proceed to team building
   - If NO: Return to main menu

2. **Team Building**
   - Opens Codex session
   - Executes `agents-builder.md` prompt (main agent, defined in `config/main.agents.js`)
   - Reads `config/sub.agents.js` to understand available specialized agents
   - Creates agent-specific prompts in `.codemachine/agents/` based on project needs
   - Populates agent files with project-specific instructions
   - **Creates `tasks.json` in `.codemachine/plan/` folder with all project tasks**

#### Phase 2: Orchestration
1. **Master Mind** agent analyzes specifications from `inputs/specifications.md`
2. Follows instructions from `templates/build.md` prompt for execution strategy
3. **Master Mind uses CLI wrapper commands:**
   - Reads tasks from `plan/tasks.json`
   - Decides which agent to call for each task
   - **Executes via CLI wrapper:** `codemachine --agent frontend-dev "<task prompt>"`
   - CLI wrapper internally handles the full Codex execution
4. **Follows 4-phase plan from build template:**
   - Phase 1: Planning
   - Phase 2: Building
   - Phase 3: Testing
   - Phase 4: Runtime
5. **Execution flow:**
   ```
   Master Mind reads task from tasks.json
   → Decides agent needed (e.g., frontend-dev)
   → Calls CLI wrapper: codemachine --agent frontend-dev "create button component..."
   → CLI wrapper internally:
     - Constructs composite prompt: [agent-prompt.md] + [memory.md] + [task request]
     - Executes full Codex command:
       CODEX_HOME="$HOME/.codemachine/codex" codex exec \
         --profile frontend-dev \
         --skip-git-repo-check \
         --sandbox danger-full-access \
         --dangerously-bypass-approvals-and-sandbox \
         -C <workingDir> "<composite prompt>"
     - Tracks instance: frontend-dev-<timestamp>
     - Sanitizes output and stores in memory/.frontend-memory.md
   → Master Mind receives result
   → Evaluates against acceptance criteria
   → If not fulfilled: calls agent again to complete/fix
   → If fulfilled: calls qa-engineer to test
   → Updates task status in tasks.json
   → Moves to next task
   ```
6. **CLI Wrapper Abstraction:**
   - Master Mind only knows simple commands: `codemachine --agent <name> "<prompt>"`
   - CLI wrapper handles all complexity internally
   - Provides clean interface for Master Mind to orchestrate
7. **Automatic recovery:**
   - If Master Mind stops → **Project Summarizer** automatically runs
   - Provides final status summary to the user
   - System checks `tasks.json` completion status:
     - If all tasks done → Run **End Agent** (confirms completion)
     - If tasks pending → Run **Retry Agent** (restarts Master Mind with context)

#### Phase 3: Execution
- Each specialized agent receives composite prompts:
  - System prompt (e.g., `frontend-developer.md`)
  - Memory prompt (`memory.md` - provides context location)
  - User request (from Master Mind)
- Agents execute assigned tasks using Codex
- Results validated against acceptance criteria
- Idempotent operations allow modification of existing codebases

#### Phase 4: Delivery
- **End Agent** activates when all tasks in `tasks.json` are done
- Provides completion message to CLI
- Complete, tested codebase ready for deployment
- Final project summary available

---

## 💻 User Interface

### CLI Design - Main Screen
```
╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║     ██████╗  ██████╗ ██████╗ ███████╗                           ║
║    ██╔════╝██╔═══██╗██╔══██╗██╔════╝                           ║
║    ██║     ██║   ██║██║  ██║█████╗                             ║
║    ██║     ██║   ██║██║  ██║██╔══╝                             ║
║    ╚██████╗╚██████╔╝██████╔╝███████╗                           ║
║     ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝                           ║
║                                                                    ║
║    ███╗   ███╗ █████╗  ██████╗██╗  ██╗██╗███╗   ██╗███████╗    ║
║    ████╗ ████║██╔══██╗██╔════╝██║  ██║██║████╗  ██║██╔════╝    ║
║    ██╔████╔██║███████║██║     ███████║██║██╔██╗ ██║█████╗      ║
║    ██║╚██╔╝██║██╔══██║██║     ██╔══██║██║██║╚██╗██║██╔══╝      ║
║    ██║ ╚═╝ ██║██║  ██║╚██████╗██║  ██║██║██║ ╚████║███████╗    ║
║    ╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝╚══════╝    ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝

Mode: build

/start

> Please check if you have complete specifications.md and inputs
```

### CLI Design - During Execution
```
┌──────────────────────┐
│   CODE MACHINE       │
└──────────────────────┘

Task T2/T15: Create homepage component
Phase: Building Phase
⏱ Time: 00:15:32

[Typewriter effect text appears here as Codex writes...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ctrl+C: Interrupt | Ctrl+E: Expand logs
```

### User Controls
- **Ctrl+C (first press)**: "Do you want to modify the plan?" → Free text input → Master Mind edits plan → Ask to start or modify again
- **Ctrl+C (second press)**: Close application
- **Ctrl+E**: Toggle expanded view to see full CLI process logs

### Typewriter Effect
- Real-time text display as Codex generates output
- Streaming character-by-character display
- Maintains readability while showing progress

**Branding**: Blue gradient theme (inspired by Gemini UI)

### Commands

#### `/start`
- Initiates project generation
- Shows confirmation prompt for specifications.md
- Begins agent orchestration with progress display

#### `/templates`
- Select project templates
- Currently available: `build` (default)
- More templates coming soon

#### `/login` or `/logout`
- Dynamic display based on auth.json presence
- `/login`: Triggers `codex login` flow
- `/logout`: Removes authentication

#### `/version`
- Displays CodeMachine version information

#### `/help` or `codemachine --help`
- Shows available commands and usage information

#### `/mcp` 
- *Coming Soon* - Model Context Protocol integration

---

## 🔧 Configuration & Architecture

### CLI Orchestration Layer
The CodeMachine CLI provides a **wrapper interface** for Master Mind and other agents:

1. **Simple Command Interface**: 
   - Master Mind uses: `codemachine --agent <name> "<prompt>"`
   - CLI wrapper handles all complexity internally

2. **Internal Processing**:
   When Master Mind calls `codemachine --agent frontend-dev "create button"`:
   - CLI loads `frontend-developer.md` prompt
   - Adds `memory.md` for context
   - Appends the task request
   - Executes full Codex command:
   ```bash
   CODEX_HOME="$HOME/.codemachine/codex" codex exec \
     --profile frontend-dev \
     --skip-git-repo-check \
     --sandbox danger-full-access \
     --dangerously-bypass-approvals-and-sandbox \
     -C <workingDir> "<composite prompt>"
   ```

3. **Abstraction Benefits**:
   - Master Mind doesn't need to know Codex details
   - Simple, clean commands for orchestration
   - All complexity hidden in CLI wrapper
   - Easy to modify implementation without changing agent prompts

### Execution Modes

#### Non-Streaming Execution
1. Builds instance ID: `<agent>-<timestamp>`
2. Validates working directory
3. Assembles shell command
4. Tracks instance in memory map
5. On success: sanitizes output, updates memory, returns formatted result
6. On failure: marks as error, logs failure

#### Streaming Execution
- Buffers until `User Request:` marker detected
- Streams sanitized output (no system prompts/metadata)
- Provides live Terminal UI updates
- Writes to memory files on completion

### Instance & Process Management
- **Instance Tracking**: Map of active instances with metadata
- **States**: `running`, `completed`, `error`, `terminated`
- **Process Control**: SIGTERM for graceful termination
- **Memory Storage**: Agent-specific files (`.frontend-memory.md`, etc.)
- **Output Sanitization**: Removes Codex boilerplate before storage

### settings.js
```javascript
module.exports = {
  port: 3000,
  logging: {
    level: 'info' // 'info' | 'debug'
  },
  mode: 'build' // Default mode (previously 'template')
}
```

### agents.js
```javascript
module.exports = [
  {
    name: 'frontend-dev',
    displayName: 'Frontend Developer',
    description: 'Execute Codex for frontend development tasks',
    promptPath: require('path').join(__dirname, '..', 'prompts', 'frontend-developer.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'medium',
    enabled: true
  },
  {
    name: 'backend-dev',
    displayName: 'Backend Developer',
    description: 'Execute Codex for backend development tasks',
    promptPath: require('path').join(__dirname, '..', 'prompts', 'backend-developer.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'high',
    enabled: true
  },
  {
    name: 'uxui-designer',
    displayName: 'UX/UI Designer',
    description: 'Execute Codex for UX and UI design tasks',
    promptPath: require('path').join(__dirname, '..', 'prompts', 'ux-ui-designer.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'medium',
    enabled: true
  },
  {
    name: 'solution-architect',
    displayName: 'Solution Architect',
    description: 'Execute Codex for solution architecture tasks',
    promptPath: require('path').join(__dirname, '..', 'prompts', 'solution-architect.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'high',
    enabled: true
  },
  {
    name: 'software-architect',
    displayName: 'Software Architect',
    description: 'Execute Codex for software architecture and directory planning',
    promptPath: require('path').join(__dirname, '..', 'prompts', 'software-architect.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'high',
    enabled: true
  },
  {
    name: 'technical-writer',
    displayName: 'Technical Writer',
    description: 'Execute Codex for documentation and writing tasks',
    promptPath: require('path').join(__dirname, '..', 'prompts', 'technical-writer.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'low',
    enabled: true
  },
  {
    name: 'qa-engineer',
    displayName: 'QA/Test Engineer',
    description: 'Execute Codex for testing and QA tasks',
    promptPath: require('path').join(__dirname, '..', 'prompts', 'qa-test-engineer.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'medium',
    enabled: true
  },
  {
    name: 'performance-engineer',
    displayName: 'Performance Engineer',
    description: 'Execute Codex for performance optimization tasks',
    promptPath: require('path').join(__dirname, '..', 'prompts', 'performance-engineer.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'high',
    enabled: true
  }
]
```

### config.toml (Overwritten after login)
```toml
# Model configuration
model = "gpt-5-codex"
model_reasoning_effort = "high"

# Profile configurations (dynamically generated from agents.js)
[profiles.frontend-dev]
model = "gpt-5-codex"
model_reasoning_effort = "medium"

[profiles.backend-dev]
model = "gpt-5-codex"
model_reasoning_effort = "high"

[profiles.uxui-designer]
model = "gpt-5-codex"
model_reasoning_effort = "medium"

[profiles.solution-architect]
model = "gpt-5-codex"
model_reasoning_effort = "high"

[profiles.software-architect]
model = "gpt-5-codex"
model_reasoning_effort = "high"

[profiles.technical-writer]
model = "gpt-5-codex"
model_reasoning_effort = "low"

[profiles.qa-engineer]
model = "gpt-5-codex"
model_reasoning_effort = "medium"

[profiles.performance-engineer]
model = "gpt-5-codex"
model_reasoning_effort = "high"
```

---

## 🚦 Implementation Priorities

### Phase 1: Core Foundation
- [ ] Basic CLI interface with branding
- [ ] Agent loading and configuration system
- [ ] Master Mind orchestration logic
- [ ] Basic file I/O operations

### Phase 2: Agent Implementation
- [ ] Implement core agents (frontend, backend, QA)
- [ ] Codex integration
- [ ] Inter-agent communication
- [ ] Error handling and retry logic

### Phase 3: Advanced Features
- [ ] Idempotent operations
- [ ] Memory and context management
- [ ] Performance optimization
- [ ] Template system

### Phase 4: Polish & Release
- [ ] Comprehensive testing
- [ ] Documentation
- [ ] Package and publish to npm
- [ ] Community feedback integration

---

## 🎨 Design Inspiration
- Reference: Gemini UI (from `/input/` folder)
- Terminal-based elegant interface
- Clear visual hierarchy
- Responsive feedback system

---

## 📝 Next Steps
1. Set up TypeScript project structure
2. Implement CLI framework (Commander.js or similar)
3. Create agent prompt templates
4. Build Master Mind orchestration engine
5. Integrate Codex API
6. Test with sample projects
7. Iterate based on results
