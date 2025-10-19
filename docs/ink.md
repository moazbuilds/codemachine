# Ink Terminal UI Implementation Plan

## Executive Summary

This document outlines the complete refactoring plan to replace CodeMachine's current spinner-based logging system with a modern Ink-based terminal UI for workflow execution. The implementation will provide real-time visibility into complex multi-agent workflows while maintaining backward compatibility with existing CLI commands.

**Key Objectives:**
- Replace spinner logging with rich terminal UI during workflow execution only
- Support 10+ parallel sub-agents with efficient display strategies
- Universal telemetry tracking (tokens in/out) across all engines
- Maintain <100 lines per file, single responsibility principle
- Zero changes to CLI commands, main menu, or login screen
- Graceful fallback to console.log when TTY unavailable

**Scope:**
- **IN SCOPE**: Workflow execution UI (`src/workflows/execution/workflow.ts`)
- **OUT OF SCOPE**: CLI commands, main menu, login screen, existing loggers

**Timeline:** 4 weeks (detailed breakdown in Section 10)

---

## Table of Contents

1. [Current System Overview](#1-current-system-overview)
2. [Requirements and Constraints](#2-requirements-and-constraints)
3. [Visual Examples](#3-visual-examples)
4. [Architecture Overview](#4-architecture-overview)
5. [File Structure](#5-file-structure)
6. [Component Specifications](#6-component-specifications)
7. [State Management](#7-state-management)
8. [Integration Points](#8-integration-points)
9. [Testing Strategy](#9-testing-strategy)
10. [Implementation Timeline](#10-implementation-timeline)
11. [Risk Mitigation](#11-risk-mitigation)
12. [Success Criteria](#12-success-criteria)

---

## 1. Current System Overview

### 1.1 Existing Logging Architecture

**File: `src/shared/logging/spinner-logger.ts`**

Current implementation uses simple spinner with status line clearing:

```typescript
export function startSpinner(agentName: string, engine: string, workflowStartTime: number) {
  // Shows: "⠋ Agent is running - Engine: X | Model: Y | Runtime: HH:MM:SS"
  // Uses readline.clearLine() and readline.cursorTo() for updates
}
```

**Limitations:**
- Single agent display only
- No visibility into parallel sub-agents
- No cumulative telemetry tracking
- Limited output history (overwrites previous lines)
- No keyboard interactions
- Poor scalability for complex workflows

### 1.2 Current Output Flow

```
workflow.ts → startSpinner() → executeStep() → spinner updates → stopSpinner() → console.log()
                                      ↓
                            createSpinnerLoggers()
                                      ↓
                        (stdoutLogger, stderrLogger)
                                      ↓
                            engine runners (Claude/Codex/Cursor)
```

### 1.3 Engine Output Formats

**Claude (`src/infra/engines/providers/claude/execution/runner.ts`):**
```
💬 TEXT: <message>
🧠 THINKING: <reasoning>
🔧 TOOL: <name> | Args: <keys>
⏱️  Duration: 1234ms | Cost: $0.0050 | Tokens: 500in/200out
```

**Codex (`src/infra/engines/providers/codex/execution/runner.ts`):**
```
💬 MESSAGE: <text>
🔧 COMMAND: <command>
⏱️  Tokens: 1000in/300out (100 cached)
```

**Cursor (`src/infra/engines/providers/cursor/execution/runner.ts`):**
```
🔧 TOOL STARTED: Read .../file.ts
✅ TOOL COMPLETED: Read .../file.ts
⏱️  Duration: 2345ms | Cost: $0.0080 | Tokens: 800in/400out
```

**Key Insight:** Only `Tokens: XXXin/YYYout` is universal across all engines.

---

## 2. Requirements and Constraints

### 2.1 Functional Requirements

**FR1: Workflow Scope Only**
- Apply Ink UI only to workflow execution phase
- Keep all CLI commands unchanged (continue using `console.log`)
- Keep main menu unchanged (`src/cli/presentation/main-menu.ts`)
- Keep login screen unchanged (`src/runtime/services/startup.ts`)

**FR2: Branding and Header**
- Compact header always visible during workflow execution
- Show: CodeMachine branding, version, update check, workflow name, runtime
- Full ASCII art only on main menu (before `/start`)

**FR3: Multi-Agent Support**
- Display unlimited main agents in timeline
- Support 10+ parallel sub-agents efficiently
- Collapsible summary by default ("Sub-Agents (15 running)")
- Expandable view with virtualized lists for 50+ agents
- Separate section for triggered agents

**FR4: Universal Telemetry**
- Track ONLY tokens in/out (no cost, duration, or cached)
- Per-agent telemetry display
- Cumulative workflow telemetry
- Detailed view accessible via keyboard shortcut

**FR5: Output Management**
- Scrollable output window for current agent
- Output history retention (last 1000 lines)
- Auto-scroll to bottom (disableable)
- Syntax highlighting for tool names

**FR6: Keyboard Interactions**
- `↑/↓` - Navigate timeline
- `ENTER` - Expand/collapse sub-agents
- `T` - Toggle telemetry detail view
- `S` - Toggle auto-scroll
- `Q` - Quit (graceful shutdown)

**FR7: Loop and Trigger Behavior**
- Display active loop state ("Loop: Agent → Back 2 steps • Iteration 2/5")
- Show skip list inline
- Separate "Triggered Agents" section
- Visual connection between trigger source and triggered agent

### 2.2 Non-Functional Requirements

**NFR1: Performance**
- UI update latency <50ms
- Support 100+ total agents without degradation
- Virtualized lists for large datasets

**NFR2: File Architecture**
- Every file <100 lines of code
- Single responsibility per file
- Clear separation of concerns

**NFR3: Testing**
- Separate `tests/` folder (not nested in `src/`)
- Unit tests for all utilities and state management
- Integration tests for UI manager
- E2E tests with real workflow fixtures

**NFR4: Graceful Degradation**
- Detect TTY availability before rendering
- Fall back to `console.log` if no TTY
- Fall back to spinner if Ink fails to initialize
- Never crash workflow execution due to UI errors

**NFR5: Maintainability**
- TypeScript strict mode
- Comprehensive JSDoc comments
- Clear prop interfaces for all components

### 2.3 Technical Constraints

**TC1: Dependencies**
- Ink v4.0.0 (React-based terminal UI)
- ink-spinner v5.0.0 (spinner component)
- yoga-layout-prebuilt v1.10.0 (flexbox layout)

**TC2: Compatibility**
- Node.js >=18.0.0
- Works in WSL, Linux, macOS
- Supports both light and dark terminal themes

**TC3: State Immutability**
- All state updates must be immutable
- Use WorkflowUIState class for state management
- No direct mutations of state objects

**TC4: Error Handling**
- Try-catch around all Ink rendering
- Graceful fallback on any UI error
- Continue workflow execution even if UI fails

---

## 3. Visual Examples

### 3.1 Example 1: Initial Workflow Start

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 🤖 CodeMachine v0.3.1 • Multi-Agent Workflow Orchestration                      │
│ ℹ️  Update available: v0.3.2 → Run 'npm install -g codemachine' to update      │
│ 📝 Workflow: Bug Fix Pipeline                              Runtime: 00:00:03   │
│ Progress: Step 1/1 • Completed: 0 unique • Total executed: 0                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─ Agent Timeline ────────────┬─ Output: bug-analyzer ───────────────────────────┐
│                              │                                                  │
│ Main Workflow Steps          │ [bug-analyzer - Running]                        │
│   01. bug-analyzer           │                                                  │
│      └ Running (00m 03s)     │ TOOL STARTED: Grep "error handling"             │
│                              │ TOOL COMPLETED: Grep "error handling"           │
│                              │                                                  │
│                              │ TEXT: Found 3 potential issues in error         │
│                              │       handling...                               │
│                              │                                                  │
│                              │                                                  │
│                              │                                                  │
│                              │                                                  │
│                              │                                                  │
│                              │                                                  │
│                              │                                                  │
└──────────────────────────────┴──────────────────────────────────────────────────┘
┌─ Live Telemetry ─────────────────────────────────────────────────────────────────┐
│ Current: 245in/120out • Workflow Total: 245in/120out • Engine: Cursor         │
└──────────────────────────────────────────────────────────────────────────────────┘

Keys: [P]ause [S]kip [Q]uit [↑↓]Scroll [ENTER]Open [Space]Collapse [T]elemetry Detail
```

### 3.2 Example 2: Multiple Main Agents, Sub-Agents Collapsed

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 🤖 CodeMachine v0.3.1 • Multi-Agent Workflow Orchestration                      │
│ 📝 Workflow: Bug Fix Pipeline                              Runtime: 00:02:45   │
│ Progress: Step 3/5 • Completed: 2 unique • Total executed: 7                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─ Agent Timeline ────────────┬─ Output: test-writer ────────────────────────────┐
│                              │                                                  │
│ Main Workflow Steps          │ [test-writer - Running]                         │
│   01. bug-analyzer (01m 30s) │                                                  │
│      └ Completed ✓           │ COMMAND: npm test -- --coverage                 │
│                              │                                                  │
│                              │ COMMAND RESULT: All tests passed...             │
│   02. code-reviewer (01m 15s)│                                                  │
│      └ Completed ✓           │ MESSAGE: Writing additional test cases for      │
│      └ Sub-Agents (5 done)   │          edge conditions...                     │
│                              │                                                  │
│   03. test-writer            │                                                  │
│      └ Running (00m 45s)     │                                                  │
│      └ Sub-Agents (12 run,   │                                                  │
│       2 done)                │                                                  │
│                              │                                                  │
└──────────────────────────────┴──────────────────────────────────────────────────┘
┌─ Live Telemetry ─────────────────────────────────────────────────────────────────┐
│ Current: 850in/420out • Workflow Total: 4,200in/1,950out • Engine: Codex      │
└──────────────────────────────────────────────────────────────────────────────────┘

Keys: [P]ause [S]kip [Q]uit [↑↓]Scroll [ENTER ▼]Open [Space]Collapse [T]elemetry Detail
```

### 3.3 Example 3: Sub-Agents (Inline Expansion)

#### 3.3a: Sub-Agents Collapsed (Default State)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 🤖 CodeMachine v0.3.1 • Multi-Agent Workflow Orchestration                      │
│ 📝 Workflow: Bug Fix Pipeline                              Runtime: 00:03:12   │
│ Progress: Step 3/5 • Completed: 2 unique • Total executed: 7                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─ Agent Timeline ────────────┬─ Output: test-writer ────────────────────────────┐
│                              │                                                  │
│ Main Workflow Steps          │ [test-writer - Running]                         │
│   01. bug-analyzer (01m 30s) │                                                  │
│      └ Completed ✓           │ MESSAGE: Coordinating 15 specialized test       │
│                              │          generators...                          │
│                              │                                                  │
│   02. code-reviewer (01m 15s)│ THINKING: Need to ensure test coverage across   │
│      └ Completed ✓           │           all layers...                         │
│      └ Sub-Agents (5 done)   │                                                  │
│                              │ TOOL STARTED: Task "Coordinate test generation" │
│                              │                                                  │
│   03. test-writer            │ TEXT: Spawning sub-agents for:                  │
│      └ Running (01m 15s)     │       - Unit tests                              │
│      └ ⠋ Coordinating 15     │       - Integration tests                       │
│         specialized test...  │       - E2E tests                               │
│      └ Sub-Agents (12 run,   │       - Snapshot tests                          │
│         3 done)     [ENTER ▼]│       - Performance tests                       │
│                              │       - And 10 more...                          │
│                              │                                                  │
└──────────────────────────────┴──────────────────────────────────────────────────┘
┌─ Live Telemetry ─────────────────────────────────────────────────────────────────┐
│ Current: 1,100in/520out • Workflow Total: 5,450in/2,540out • Engine: Codex    │
└──────────────────────────────────────────────────────────────────────────────────┘

Keys: [ENTER]Expand sub-agents [T]elemetry [Q]uit
```

#### 3.3b: Sub-Agents Expanded (Press ENTER on Sub-Agents)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 🤖 CodeMachine v0.3.1 • Multi-Agent Workflow Orchestration                      │
│ 📝 Workflow: Bug Fix Pipeline                              Runtime: 00:03:12   │
│ Progress: Step 3/5 • Completed: 2 unique • Total executed: 7                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─ Agent Timeline ────────────┬─ Output: test-writer ────────────────────────────┐
│                              │                                                  │
│ Main Workflow Steps          │ [test-writer - Running]                         │
│   01. bug-analyzer (01m 30s) │                                                  │
│      └ Completed ✓           │ MESSAGE: Coordinating 15 specialized test       │
│                              │          generators...                          │
│   02. code-reviewer (01m 15s)│                                                  │
│      └ Completed ✓           │ THINKING: Need to ensure test coverage across   │
│      └ Sub-Agents (5 done)   │           all layers...                         │
│                              │                                                  │
│   03. test-writer            │ TOOL STARTED: Task "Coordinate test generation" │
│      └ Running (01m 15s)     │                                                  │
│      └ Sub-Agents (12 run,   │ TEXT: Spawning sub-agents for:                  │
│         3 done)     [ENTER ▲]│       - Unit tests                              │
│         ⠋ unit-test-gen...   │       - Integration tests                       │
│         ⠋ integration-test...│       - E2E tests                               │
│         ⠋ e2e-test-gen...    │       - Snapshot tests                          │
│         ⠋ snapshot-test...   │       - Performance tests                       │
│         ⠋ performance-test...│       - And 10 more...                          │
│         ⠋ accessibility...   │                                                  │
│         ⠋ security-test...   │                                                  │
│         ⠋ regression-test... │                                                  │
│         ⠋ smoke-test-gen...  │                                                  │
│         ⠋ load-test-gen...   │                                                  │
│         ⠋ stress-test-gen... │                                                  │
│         ⠋ boundary-test...   │                                                  │
│         ✓ mock-generator     │                                                  │
│         ✓ fixture-generator  │                                                  │
│         ✓ test-data-gen      │                                                  │
└──────────────────────────────┴──────────────────────────────────────────────────┘
┌─ Live Telemetry ─────────────────────────────────────────────────────────────────┐
│ Current: 1,100in/520out • Workflow Total: 5,450in/2,540out • Engine: Codex    │
└──────────────────────────────────────────────────────────────────────────────────┘

Keys: [↑↓]Navigate [ENTER]Select/Collapse [T]elemetry [Q]uit
```

#### 3.3c: Sub-Agent Selected (Navigate to sub-agent with ↑↓, press ENTER to view output)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 🤖 CodeMachine v0.3.1 • Multi-Agent Workflow Orchestration                      │
│ 📝 Workflow: Bug Fix Pipeline                              Runtime: 00:04:30   │
│ Progress: Step 3/5 • Completed: 2 unique • Total executed: 7                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─ Agent Timeline ────────────┬─ Output: unit-test-generator ───────────────────┐
│                              │                                                  │
│ Main Workflow Steps          │ [unit-test-generator (sub) - Running]           │
│   01. bug-analyzer (done)    │                                                  │
│   02. code-reviewer (done)   │ TEXT: Analyzing payment service for unit test   │
│   03. test-writer            │       generation...                             │
│      └ Running (02m 33s)     │                                                  │
│      └ Sub-Agents (12 run,   │ TOOL STARTED: Read src/services/payment.ts      │
│         3 done)     [ENTER ▲]│ TOOL COMPLETED: Read src/services/payment.ts    │
│       → ⠋ unit-test-gen...   │                                                  │
│         ⠋ integration-test...│                                                  │
│         ⠋ e2e-test-gen...    │                                                  │
│         ⠋ snapshot-test...   │                                                  │
│         ⠋ performance-test...│                                                  │
│         ⠋ accessibility...   │                                                  │
│         ⠋ security-test...   │                                                  │
│         ⠋ regression-test... │                                                  │
│         ⠋ smoke-test-gen...  │                                                  │
│         ⠋ load-test-gen...   │                                                  │
│         ⠋ stress-test-gen... │                                                  │
│         ⠋ boundary-test...   │                                                  │
│         ✓ mock-generator     │                                                  │
│         ✓ fixture-generator  │                                                  │
│         ✓ test-data-gen      │
│                              │                                                  │
│                              │ TEXT: Found 8 public methods to test:           │
│                              │   • processPayment()                            │
│                              │   • validateCard()                              │
│                              │   • calculateFees()                             │
│                              │   • refundPayment()                             │
│                              │   • getTransactionHistory()                     │
│                              │   • updatePaymentStatus()                       │
│                              │   • cancelPayment()                             │
│                              │   • verifyMerchant()                            │
│                              │                                                  │
│                              │ TOOL STARTED: Write tests/unit/payment.test.ts  │
│                              │ TOOL COMPLETED: Write tests/unit/payment.test.ts│
│                              │                                                  │
│                              │ TEXT: Generated 24 unit tests with full         │
│                              │       coverage of edge cases and mocks          │
└──────────────────────────────┴──────────────────────────────────────────────────┘
┌─ Live Telemetry ─────────────────────────────────────────────────────────────────┐
│ Current: 350in/180out (sub-agent) • Workflow Total: 5,800in/2,720out • Engine: Claude │
└──────────────────────────────────────────────────────────────────────────────────┘

Keys: [↑↓]Navigate [ENTER]Collapse sub-agents [T]elemetry [Q]uit
```

### 3.4 Example 4: Loop Behavior Active

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 🤖 CodeMachine v0.3.1 • Multi-Agent Workflow Orchestration                      │
│ 📝 Workflow: Bug Fix Pipeline                              Runtime: 00:05:20   │
│ Progress: Step 2/5 (Iteration 2/5) • Completed: 3 unique • Total executed: 12  │
│ 🔄 Loop: test-writer → Back 2 steps • Skipping: bug-analyzer                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─ Agent Timeline ────────────┬─ Output: code-reviewer ──────────────────────────┐
│                              │                                                  │
│ Main Workflow Steps          │ [code-reviewer - Iteration 2]                   │
│   01. bug-analyzer (01m 30s) │                                                  │
│      └ Skipped ●             │ TEXT: Re-reviewing code with updated test       │
│                              │       coverage requirements...                  │
│                              │                                                  │
│   02. code-reviewer          │ TOOL: Read src/utils/validator.ts               │
│      └ Running (00m 25s)     │                                                  │
│      └ Iteration 2           │                                                  │
│                              │                                                  │
│                              │                                                  │
│                              │                                                  │
│                              │                                                  │
│                              │                                                  │
│                              │                                                  │
│                              │                                                  │
│                              │                                                  │
└──────────────────────────────┴──────────────────────────────────────────────────┘
┌─ Live Telemetry ─────────────────────────────────────────────────────────────────┐
│ Current: 340in/170out • Workflow Total: 6,800in/3,240out • Engine: Claude     │
└──────────────────────────────────────────────────────────────────────────────────┘

Keys: [P]ause [S]kip [Q]uit [↑↓]Scroll [Space]Collapse [T]elemetry Detail
```

### 3.5 Example 5: Triggered Agents Section

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 🤖 CodeMachine v0.3.1 • Multi-Agent Workflow Orchestration                      │
│ 📝 Workflow: Bug Fix Pipeline                              Runtime: 00:06:45   │
│ Progress: Step 4/5 • Completed: 3 unique • Total executed: 18                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─ Agent Timeline ────────────┬─ Output: security-scanner ───────────────────────┐
│                              │                                                  │
│ Main Workflow Steps          │ [security-scanner - Running]                    │
│   04. security-scanner       │                                                  │
│      └ Running (01m 05s)     │ MESSAGE: Found 2 security vulnerabilities,      │
│                              │          triggering automated fixes...          │
│                              │                                                  │
│                              │ COMMAND: npm audit --json                       │
│ Triggered Agents (2)         │                                                  │
│   ⚡ vulnerability-fixer     │                                                  │
│      └ From: security-scan   │                                                  │
│      └ Running (00m 45s)     │                                                  │
│                              │                                                  │
│                              │                                                  │
│   ⚡ dependency-updater      │                                                  │
│      └ From: security-scan   │                                                  │
│      └ Running (00m 30s)     │                                                  │
│                              │                                                  │
│                              │                                                  │
│                              │                                                  │
└──────────────────────────────┴──────────────────────────────────────────────────┘
┌─ Live Telemetry ─────────────────────────────────────────────────────────────────┐
│ Current: 920in/460out • Workflow Total: 9,940in/4,810out • Engine: Codex      │
└──────────────────────────────────────────────────────────────────────────────────┘

Keys: [P]ause [S]kip [Q]uit [↑↓]Scroll [Space]Collapse [T]elemetry Detail
```

### 3.6 Example 6: Loop Iteration 2 - Fixing Issues

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ CodeMachine v0.3.1 • Multi-Agent Workflow Orchestration                        │
│ Workflow: Sustaina Development                          Runtime: 00:32:45      │
│ Progress: Step 3 (Iteration 2/20) • Completed: 6 unique • Total executed: 26   │
│ Loop: Task Validator → Back 6 steps • Skipping: Runtime Prep                   │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─ Agent Timeline ────────────┬─ Output: Code Generator ─────────────────────────┐
│                              │                                                  │
│ Main Workflow Steps          │ [Code Generator - Iteration 2]                  │
│   01. Architecture (01m 45s) │                                                  │
│   02. Planning (02m 30s)     │ TEXT: Addressing validation feedback from       │
│   03. Code Generator (x2)    │       previous iteration:                       │
│      └ Running (02m 15s)     │       - Adding error handling to payment        │
│      └ Iteration 2/∞         │       - Improving test coverage                 │
│      └ Tools: 15 | Thinking: 6│                                                 │
│   04. Unit Tests (skip)      │ TOOL STARTED: Edit src/services/payment.ts      │
│   05. Integration (skip)     │ TOOL COMPLETED: Edit ...payment.ts              │
│   06. E2E Tests (skip)       │                                                  │
│   07. Task Validator (retry) │ TEXT: Added comprehensive error handling:       │
│      └ Pending               │       - Try-catch blocks                        │
│   08. Runtime Prep           │       - Custom error types                      │
│   09. Final Validation       │       - Error logging                           │
│                              │                                                  │
│ Previous Iterations:         │ TOOL STARTED: Write tests/payment.test.ts       │
│   Iteration 1: Failed        │ TOOL COMPLETED: Write ...payment.test.ts        │
│     Reason: Missing error    │                                                  │
│             handling         │ TEXT: Added 23 new test cases.                  │
│                              │       Coverage now at 94%.                      │
│ Triggered Agents (1)         │                                                  │
│   Security Validator (done)  │ TOOL STARTED: Bash npm run test                 │
│                              │ TOOL COMPLETED: Bash ...                        │
│                              │ RESULT: All 127 tests passing                   │
└──────────────────────────────┴──────────────────────────────────────────────────┘
┌─ Live Telemetry ─────────────────────────────────────────────────────────────────┐
│ Current: 8,234in/4,567out • Duration: 02m 15s • Engine: Claude                │
│ Workflow Total: 107,946in/49,446out • Avg: 3m 42s/agent                       │
└──────────────────────────────────────────────────────────────────────────────────┘

Keys: [P]ause [S]kip [Q]uit [↑↓]Scroll [Space]Collapse [T]elemetry Detail
```

### 3.7 Example 7: Fallback Recovery

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ CodeMachine v0.3.1 • Multi-Agent Workflow Orchestration                        │
│ Workflow: Sustaina Development                          Runtime: 00:38:20      │
│ Progress: Step 4 (Iteration 2) • Completed: 6 unique • Total executed: 28      │
│ Fallback Recovery: Unit Tests Agent                                            │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─ Agent Timeline ────────────┬─ Output: Testing Fallback Agent ─────────────────┐
│                              │                                                  │
│ Main Workflow Steps          │ [Unit Tests - Original Attempt]                 │
│   01. Architecture (01m 45s) │ TEXT: Running test suite...                     │
│   02. Planning (02m 30s)     │                                                  │
│   03. Code Generator (04m 30s)│ TOOL STARTED: Bash npm run test                │
│      └ Iteration 2           │ ERROR: Test framework not configured            │
│   04. Unit Tests             │ ERROR: Missing dependencies                     │
│      └ Failed (00m 45s)      │                                                  │
│      └ Fallback Recovery     │ ──────────────────────────────────────────────  │
│        Testing Fallback      │                                                  │
│          └ Running (01m 30s) │ [Testing Fallback Agent - Recovery]             │
│          └ claude-sonnet-4   │                                                  │
│          └ high reasoning    │ TEXT: Analyzing failure root cause...           │
│          └ Tools: 8 | Think: 4│                                                 │
│   05. Integration (skip)     │ TOOL STARTED: Read package.json                 │
│   06. E2E Tests (skip)       │ TOOL COMPLETED: Read package.json               │
│   07. Task Validator (retry) │                                                  │
│      └ Pending               │ THINKING: Missing vitest configuration and      │
│   04. Unit Tests (retry)     │           test dependencies.                    │
│      └ Pending               │                                                  │
│   08. Runtime Prep           │ TEXT: Installing test dependencies:             │
│   09. Final Validation       │                                                  │
│                              │ TOOL STARTED: Bash npm install vitest           │
│ Triggered Agents (1)         │                  @vitest/ui --save-dev          │
│   Security Validator (done)  │ TOOL COMPLETED: Bash ...                        │
│                              │ RESULT: Dependencies installed successfully     │
│                              │                                                  │
│                              │ TOOL STARTED: Write vitest.config.ts            │
│                              │ TOOL COMPLETED: Write vitest.config.ts          │
│                              │                                                  │
│                              │ TEXT: Test framework configured.                │
│                              │       Ready to retry Unit Tests agent...        │
└──────────────────────────────┴──────────────────────────────────────────────────┘
┌─ Live Telemetry ─────────────────────────────────────────────────────────────────┐
│ Current: 4,567in/2,123out • Duration: 01m 30s • Engine: Claude (fallback)     │
│ Workflow Total: 112,513in/51,569out • Avg: 3m 36s/agent                       │
└──────────────────────────────────────────────────────────────────────────────────┘

Keys: [P]ause [S]kip [Q]uit [↑↓]Scroll [Space]Collapse [T]elemetry Detail
```

### 3.8 Example 8: Telemetry Detail View (Press T)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ CodeMachine v0.3.1 • Workflow Telemetry Dashboard                              │
│ Workflow: Sustaina Development                          Runtime: 00:45:30      │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─ Per-Agent Telemetry ────────────────────────────────────────────────────────────┐
│                                                                                  │
│ Agent                      Duration    Tokens (in/out)     Cached               │
│ ──────────────────────────────────────────────────────────────────────────────  │
│ 01. Architecture           01m 45s      2,456 / 1,234        450                │
│ 02. Planning               02m 30s      3,245 / 1,823        678                │
│ 03. Task Breakdown         00m 45s        892 /   456        120                │
│ 04. Development            12m 30s     12,345 / 6,789      1,234                │
│     ├ Auth Module (sub)    02m 15s      4,567 / 2,123        345                │
│     ├ DB Schema (sub)      01m 45s      3,456 / 1,789        234                │
│     ├ API Gateway (sub)    03m 05s      5,678 / 2,456        456                │
│     ... [12 more sub-agents]                                                     │
│ 05. Testing                03m 45s      6,789 / 2,345        890                │
│ 06. Documentation          02m 15s      3,456 / 1,567        456                │
│ 07. Integration            03m 30s      5,678 / 2,890        678                │
│ 08. E2E Tests              02m 45s      4,567 / 2,123        567                │
│ 09. Task Validator (x2)    03m 00s      5,890 / 2,468        734                │
│ 03. Code Generator (x2)    08m 45s     16,468 / 8,912      2,145                │
│ 04. Unit Tests (failed)    00m 45s        567 /   234         45                │
│     └ Testing Fallback     01m 30s      4,567 / 2,123        345                │
│ 04. Unit Tests (retry)     02m 30s      5,678 / 2,890        567                │
│ 05. Integration (x2)       06m 15s     11,234 / 5,678      1,234                │
│ 06. E2E Tests (x2)         05m 30s      9,876 / 4,567      1,023                │
│ 07. Task Validator (x2)    02m 45s      4,890 / 2,234        678                │
│                                                                                  │
│ ──────────────────────────────────────────────────────────────────────────────  │
│ Main Agents Total          58m 15s    102,468 / 48,912     11,896               │
│ Averages/Agent (unique)    03m 28s      6,404 / 3,057        744                │
│                                                                                  │
│ Triggered Agents:                                                               │
│ • Security Validator       02m 15s      6,789 / 3,456        890                │
│                                                                                  │
│ Sub-Agents Total (15):     68m 45s     68,934 / 31,245      8,234               │
│ Average/Sub-Agent          04m 35s      4,596 / 2,083        549                │
│                                                                                  │
│ ──────────────────────────────────────────────────────────────────────────────  │
│ Grand Total               129m 15s    178,191 / 83,613     21,020               │
│                                                                                  │
│ Loop Statistics:                                                                │
│ • Total iterations: 2                                                           │
│ • Steps repeated: 6 steps × 2 iterations = 12 extra executions                 │
│                                                                                  │
│ Projected Completion: ~01h 45m (3 agents remaining)                            │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘

Press [T] to return to workflow view • [Q] to quit • [↑↓] to scroll
```

### 3.9 Example 9: Workflow Complete

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ CodeMachine v0.3.1 • Multi-Agent Workflow Orchestration   ✓ COMPLETE           │
│ Workflow: Sustaina Development                          Runtime: 01h 42m 30s   │
│ Progress: Completed 10/10 steps • Total executed: 38 (includes loops/subs)     │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─ Agent Timeline ────────────┬─ Summary ────────────────────────────────────────┐
│                              │                                                  │
│ Main Workflow Steps (10)     │ ✅ Workflow completed successfully!             │
│   01. Architecture (01m 45s) │                                                  │
│      └ Completed ✓           │ Performance Summary:                            │
│   02. Planning (02m 30s)     │ • Total runtime: 1 hour 42 minutes 30 seconds   │
│      └ Completed ✓           │ • Unique steps completed: 10                    │
│   03. Task Breakdown (00m 45s)│                                                 │
│      └ Completed ✓           │ Execution Statistics:                           │
│   04. Development (12m 30s)  │ • Total executions: 38                          │
│      └ Completed ✓           │   - Main agents: 10 unique                      │
│      └ 15 sub-agents         │   - Loop iterations: 12 (2 cycles)             │
│   05. Testing (03m 45s × 2)  │   - Sub-agents: 15 parallel                     │
│      └ Completed ✓           │   - Triggered agents: 1                         │
│      └ 1 fallback            │                                                  │
│   06. Documentation (02m 15s)│ Token Usage:                                    │
│      └ Completed ✓           │ • Input: 178,191 tokens                         │
│   07. Integration (03m 30s × 2)│ • Output: 83,613 tokens                       │
│      └ Completed ✓           │ • Cached: 21,020 tokens (11.8% savings)        │
│   08. E2E Tests (02m 45s × 2)│                                                  │
│      └ Completed ✓           │ Execution Breakdown:                            │
│   09. Task Validator (1m30s×2)│ • Main agents: 10 unique                       │
│      └ Completed ✓           │ • Sub-agents: 15 parallel                       │
│   10. Final Validation (2m)  │ • Triggered agents: 1                           │
│      └ Completed ✓           │ • Loop iterations: 12 (2 cycles)               │
│                              │                                                  │
│ Triggered Agents (1)         │                                                  │
│   Security Validator (2m 15s)│                                                  │
│     └ From: Testing Agent    │                                                  │
│     └ Completed ✓            │ Time Efficiency:                                │
│                              │ • Avg per unique agent: 10m 15s                 │
│                              │ • Parallel sub-agents saved: ~45m               │
│                              │ • Sequential would have taken: ~2h 30m          │
│                              │                                                  │
│                              │ Files Created: 127                              │
│                              │ Files Modified: 43                              │
│                              │ Tests Written: 156 (94% coverage)               │
│                              │                                                  │
│                              │ Press [Q] to exit and return to main menu       │
└──────────────────────────────┴──────────────────────────────────────────────────┘

Keys: [Q]uit • [T]elemetry Detail • [L]ogs                All agents completed ✓
```

### 3.10 Complete Visual Journey Summary

The 9 examples above demonstrate the complete user experience from workflow start to completion, covering all complex scenarios:

1. **Initial workflow start**: Clean split-pane layout, single agent running with live output
2. **Multiple agents with collapsed sub-agents**: Timeline shows all agents, sub-agents collapsed by default
3. **Sub-agents inline expansion**: Press ENTER → Expands sub-agents as nested list within timeline. Navigate with ↑↓, press ENTER on sub-agent to switch output pane.
4. **Loop behavior active**: Loop indicator in header, skipped agents marked in timeline
5. **Triggered agents**: Shown inline in timeline with ⚡ icon and attribution
6. **Loop iteration 2**: Advanced loop iteration with detailed progress tracking
7. **Fallback recovery**: Automatic fallback agent activation shown in timeline hierarchy
8. **Telemetry detail view**: Full-screen detailed breakdown (replaces split-pane view)
9. **Workflow complete**: Final summary with comprehensive statistics

**Key Design Insights from Examples:**

**Layout Architecture:**
- **Consistent split-pane design**: All workflow views use Timeline (left ~35%) + Output (right ~65%)
- **Full-width header**: Branding, workflow info, progress, and loop state always visible above panes
- **Full-width telemetry bar**: Current and cumulative metrics below split panes
- **Full-width footer**: Keyboard shortcuts always accessible

**Timeline Pane Features:**
- Vertical agent progression showing all main workflow steps
- Collapsible sub-agent sections with counts (e.g., "12 run, 3 done [ENTER ▼]")
- **Inline expansion for sub-agents**: Press ENTER expands sub-agents as nested list within timeline
  - Expanded sub-agents show status icon and truncated name
  - Navigate through expanded list with ↑↓ keys
  - Press ENTER on a sub-agent to switch output pane to that sub-agent
  - Press ENTER again on "Sub-Agents (...)" header to collapse
  - Currently selected sub-agent indicated with → arrow
- Triggered agents displayed with ⚡ icon and source attribution
- Status icons: ✓ (completed), ⠋ (running), ● (skipped), ✗ (failed)
- Per-agent telemetry (tokens in/out) and engine shown in telemetry bar, not timeline
- Navigation with ↑↓ keys switches between agents and updates output pane and telemetry bar dynamically

**Output Pane Features:**
- Scrollable real-time output for currently selected/running agent
- Agent name in pane header (e.g., "Output: agent-name")
- Syntax highlighting for tool operations and thinking blocks
- Auto-scroll to bottom (toggleable with 'S' key)

**Progressive Enhancement:**
- Simple single-agent view (Example 3.1)
- Multiple agents with state tracking (Example 3.2)
- Sub-agents with inline expansion (Example 3.3a/b/c)
  - 3.3a: Collapsed state with summary count
  - 3.3b: Inline expansion showing all sub-agents as nested list
  - 3.3c: Sub-agent output selected after navigation
- Loop iteration tracking (Example 3.4)
- Triggered agent attribution (Example 3.5)
- Advanced features: iterations, fallbacks, detailed telemetry (Examples 3.6-3.9)

**Universal Telemetry:**
- Token counts (in/out) tracked universally across all engines (Claude, Codex, Cursor)
- Duration shown when available
- Cached token counts displayed when provided by engine
- Cumulative workflow totals always visible
- Detailed breakdown accessible via 'T' key (replaces split-pane with full-screen table)
- **Primary focus:** Token usage tracking, not cost estimation

---

## 4. Architecture Overview

### 4.1 High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Workflow Execution Layer                         │
│                      (src/workflows/execution/)                          │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                │ creates
                                ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                        WorkflowUIManager                                 │
│                      (src/ui/manager/)                                   │
│  • Initializes Ink rendering                                            │
│  • Manages WorkflowUIState                                              │
│  • Routes output chunks to state                                        │
│  • Handles keyboard events                                              │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                │ updates
                                ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                        WorkflowUIState                                   │
│                      (src/ui/state/)                                     │
│  • Stores all agent states                                              │
│  • Manages output buffers                                               │
│  • Tracks telemetry data                                                │
│  • Immutable state updates                                              │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                │ provides data to
                                ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                      React Components (Ink)                              │
│                      (src/ui/components/)                                │
│  • WorkflowDashboard (main container)                                   │
│  • BrandingHeader, ProgressLine, AgentTimeline                          │
│  • OutputWindow, TelemetryBar, StatusFooter                             │
│  • Pure functional components                                           │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                │ renders to
                                ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                          Terminal Output                                 │
│                      (stdout/stderr)                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Data Flow Architecture

```
Engine Output → outputProcessor.processChunk()
                       ↓
              Extract: type, counters, telemetry
                       ↓
       WorkflowUIManager.handleOutputChunk()
                       ↓
              ┌────────┴────────┐
              ↓                 ↓
   state.appendOutput()    state.incrementToolCount()
              ↓                 ↓
   state.updateTelemetry()     ↓
              ↓                 ↓
              └────────┬────────┘
                       ↓
              State Change Event
                       ↓
              Ink Re-renders Components
                       ↓
              Terminal UI Updates
```

### 4.3 State Management Flow

```typescript
// Immutable state updates
class WorkflowUIState {
  private state: WorkflowState;

  // Every update creates new state object
  updateAgentStatus(agentId: string, status: AgentStatus): void {
    this.state = {
      ...this.state,
      agents: this.state.agents.map(agent =>
        agent.id === agentId
          ? { ...agent, status, updatedAt: Date.now() }
          : agent
      )
    };
    this.notifyListeners();
  }
}
```

### 4.4 Component Hierarchy

```
WorkflowDashboard (Main Container)
│
├─ BrandingHeader
│  ├─ Logo & Version
│  ├─ Update Notification
│  └─ Workflow Name & Runtime
│
├─ ProgressLine
│  └─ Step counter, unique/total execution counts
│
├─ LoopIndicator (conditional)
│  └─ Loop state, iteration, skip list
│
├─ Split Panes
│  │
│  ├─ Left Pane: AgentTimeline
│  │  ├─ MainAgentNode (multiple)
│  │  │  ├─ Agent status, duration, telemetry
│  │  │  └─ SubAgentSummary (if has sub-agents)
│  │  │     └─ SubAgentList (if expanded)
│  │  │
│  │  └─ TriggeredAgentList
│  │     └─ Triggered agent nodes with attribution
│  │
│  └─ Right Pane: OutputWindow
│     └─ Scrollable output with syntax highlighting
│
├─ TelemetryBar
│  └─ Current + Cumulative telemetry
│
├─ TelemetryDetailView (conditional, press T)
│  └─ Full per-agent breakdown table
│
└─ StatusFooter
   └─ Keyboard shortcuts help
```

### 4.5 File Organization Principles

**Separation of Concerns:**
- `components/`: Pure React components (presentation only)
- `state/`: State management and business logic
- `manager/`: Orchestration and Ink lifecycle
- `utils/`: Pure functions for parsing, formatting

**Single Responsibility:**
- Each file <100 lines
- One component per file
- One utility function per file
- Clear interfaces between modules

**Dependency Flow:**
```
utils (no dependencies)
  ↑
state (depends on: utils)
  ↑
manager (depends on: state, utils)
  ↑
components (depends on: state, utils)
  ↑
index.ts (exports: WorkflowUIManager)
```

### 4.6 Error Handling Strategy

```typescript
// WorkflowUIManager with graceful degradation
class WorkflowUIManager {
  private inkInstance: any = null;
  private fallbackMode = false;

  start(): void {
    if (!process.stdout.isTTY) {
      this.fallbackMode = true;
      console.log('Workflow starting (TTY not available)...');
      return;
    }

    try {
      const { render } = require('ink');
      this.inkInstance = render(<WorkflowDashboard state={this.state} />);
    } catch (error) {
      this.fallbackMode = true;
      console.error('Ink UI failed to initialize, falling back to console.log');
      console.log('Workflow starting...');
    }
  }

  handleOutputChunk(agentId: string, chunk: string): void {
    if (this.fallbackMode) {
      // Fallback to simple console.log
      console.log(chunk);
      return;
    }

    try {
      // Normal Ink UI updates
      const processed = processOutputChunk(chunk);
      this.state.appendOutput(agentId, processed);
    } catch (error) {
      // If UI update fails, don't crash workflow
      console.error('UI update failed:', error.message);
    }
  }
}
```

### 4.7 Performance Considerations

**Virtualization for Large Lists:**
- Sub-agent lists virtualized when >10 items
- Output buffer limited to 1000 lines
- Automatic garbage collection of old output

**Throttling UI Updates:**
- Output chunks buffered and flushed every 50ms
- Prevents excessive re-renders
- Smooth animation without lag

**Memory Management:**
- Output circular buffer (max 1000 lines)
- Old agent states archived after completion
- Periodic cleanup of event listeners

---

## 5. File Structure

### 5.1 Complete Directory Tree

```
src/ui/                                    # NEW - Total: ~1,850 lines across 30 files
├── components/                            # 13 React components (~750 lines)
│   ├── BrandingHeader.tsx                # 40 lines
│   ├── ProgressLine.tsx                  # 30 lines
│   ├── LoopIndicator.tsx                 # 40 lines
│   ├── AgentTimeline.tsx                 # 80 lines
│   ├── MainAgentNode.tsx                 # 60 lines
│   ├── SubAgentSummary.tsx               # 50 lines
│   ├── SubAgentList.tsx                  # 90 lines
│   ├── TriggeredAgentList.tsx            # 70 lines
│   ├── OutputWindow.tsx                  # 95 lines
│   ├── TelemetryBar.tsx                  # 45 lines
│   ├── TelemetryDetailView.tsx           # 100 lines
│   ├── StatusFooter.tsx                  # 35 lines
│   └── WorkflowDashboard.tsx             # 85 lines
│
├── state/                                 # 3 state management files (~255 lines)
│   ├── types.ts                          # 95 lines
│   ├── WorkflowUIState.ts                # 100 lines
│   └── TelemetryState.ts                 # 60 lines
│
├── manager/                               # 1 orchestration file (~100 lines)
│   └── WorkflowUIManager.ts              # 100 lines
│
├── utils/                                 # 4 utility files (~175 lines)
│   ├── telemetryParser.ts                # 40 lines
│   ├── outputProcessor.ts                # 50 lines
│   ├── formatters.ts                     # 60 lines
│   └── statusIcons.ts                    # 25 lines
│
└── index.ts                               # 15 lines (exports)

tests/ui/                                  # SEPARATE - ~525 lines
├── unit/
│   ├── telemetryParser.test.ts           # 80 lines
│   ├── outputProcessor.test.ts           # 90 lines
│   ├── WorkflowUIState.test.ts           # 100 lines
│   └── formatters.test.ts                # 70 lines
├── integration/
│   ├── workflow-execution.test.ts        # 100 lines
│   └── output-handling.test.ts           # 85 lines
├── fixtures/
│   ├── claude-output.txt                 # Real stream data
│   ├── codex-output.txt                  # Real stream data
│   └── cursor-output.txt                 # Real stream data
└── e2e/
    └── full-workflow.test.ts             # 100 lines
```

### 5.2 Component Files (Detailed Specifications)

#### 5.2.1 BrandingHeader.tsx (~40 lines)

**Purpose:** Display workflow header with branding, version, updates, runtime

**Props:**
```typescript
interface BrandingHeaderProps {
  workflowName: string;
  runtime: string;          // Formatted: "00:12:45"
  version: string;
  packageName: string;
}
```

**Key Logic:**
- Use `update-notifier` to check for package updates
- Respect `NO_UPDATE_NOTIFIER` environment variable
- Show update notification in yellow if available
- Display compact branding (no ASCII art)

**Dependencies:** `ink`, `update-notifier`, `formatters.ts`

**Example Code:**
```typescript
import React from 'react';
import { Box, Text } from 'ink';
import updateNotifier from 'update-notifier';

export const BrandingHeader: React.FC<BrandingHeaderProps> = ({
  workflowName,
  runtime,
  version,
  packageName,
}) => {
  const notifier = updateNotifier({
    pkg: { name: packageName, version },
    updateCheckInterval: 1000 * 60 * 60 * 24, // 24 hours
  });

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold>🤖 CodeMachine v{version} • Multi-Agent Workflow Orchestration</Text>
      </Box>

      {notifier.update && (
        <Text color="yellow">
          ℹ️  Update available: v{notifier.update.latest} → Run 'npm install -g {packageName}' to update
        </Text>
      )}

      <Box justifyContent="space-between">
        <Text>📝 Workflow: {workflowName}</Text>
        <Text>Runtime: {runtime}</Text>
      </Box>
    </Box>
  );
};
```

#### 5.2.2 ProgressLine.tsx (~30 lines)

**Purpose:** Show workflow progress: current step, unique completed, total executed

**Props:**
```typescript
interface ProgressLineProps {
  currentStep: number;
  totalSteps: number;
  uniqueCompleted: number;
  totalExecuted: number;
  loopIteration?: number;  // Optional: if in loop
}
```

**Key Logic:**
- Simple one-line progress indicator
- Show loop iteration if applicable

**Dependencies:** `ink`

#### 5.2.3 LoopIndicator.tsx (~40 lines)

**Purpose:** Display loop state when workflow is looping back

**Props:**
```typescript
interface LoopIndicatorProps {
  loopState: {
    active: boolean;
    sourceAgent: string;
    backSteps: number;
    iteration: number;
    maxIterations: number;
    skipList: string[];
  } | null;
}
```

**Key Logic:**
- Only render if `loopState.active === true`
- Show "Loop: {sourceAgent} → Back {N} steps • Iteration {X}/{Y}"
- Display skip list inline

**Dependencies:** `ink`

#### 5.2.4 AgentTimeline.tsx (~80 lines)

**Purpose:** Container for all agent displays (main, sub, triggered)

**Props:**
```typescript
interface AgentTimelineProps {
  mainAgents: AgentState[];
  subAgents: Map<string, SubAgentState[]>;  // Keyed by parent agent ID
  triggeredAgents: TriggeredAgentState[];
  expandedNodes: Set<string>;               // Agent IDs that are expanded
  onToggleExpand: (agentId: string) => void;
}
```

**Key Logic:**
- Iterate through main agents
- For each agent, check if it has sub-agents
- Render MainAgentNode with optional SubAgentSummary
- Render triggered agents in separate section

**Dependencies:** `ink`, `MainAgentNode`, `TriggeredAgentList`

#### 5.2.5 MainAgentNode.tsx (~60 lines)

**Purpose:** Display single main agent with status and duration

**Props:**
```typescript
interface MainAgentNodeProps {
  agent: AgentState;
  subAgents?: SubAgentState[];
  expanded: boolean;
  onToggle: () => void;
}
```

**Key Logic:**
- Show agent status icon (✓, ●, ○, ⠋, ⟳, ⏸, ✗)
- Display agent name and duration
- Engine and telemetry (tokens in/out) displayed in TelemetryBar, not in timeline
- If has sub-agents, show SubAgentSummary or SubAgentList based on `expanded`

**Dependencies:** `ink`, `SubAgentSummary`, `SubAgentList`, `statusIcons`, `formatters`

#### 5.2.6 SubAgentSummary.tsx (~50 lines)

**Purpose:** Collapsed view showing sub-agent counts

**Props:**
```typescript
interface SubAgentSummaryProps {
  subAgents: SubAgentState[];
  onExpand: () => void;
}
```

**Key Logic:**
- Count sub-agents by status (running, completed, failed)
- Display: "Sub-Agents (15 running, 3 completed) [ENTER ▼]"

**Dependencies:** `ink`

#### 5.2.7 SubAgentList.tsx (~90 lines)

**Purpose:** Expanded list of sub-agents with selection support

**Props:**
```typescript
interface SubAgentListProps {
  subAgents: SubAgentState[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  virtualized?: boolean;  // True if >10 items
}
```

**Key Logic:**
- Render each sub-agent with status icon, name, telemetry
- Support virtualization for >10 items
- Highlight selected sub-agent

**Dependencies:** `ink`, `formatters`, `statusIcons`

#### 5.2.8 TriggeredAgentList.tsx (~70 lines)

**Purpose:** Show triggered agents with "From: SourceAgent" attribution

**Props:**
```typescript
interface TriggeredAgentListProps {
  triggeredAgents: TriggeredAgentState[];
}
```

**Key Logic:**
- Render each triggered agent
- Show ⚡ icon to indicate triggered status
- Display: "⚡ agent-name (engine) [triggered by source-agent]"

**Dependencies:** `ink`, `formatters`, `statusIcons`

#### 5.2.9 OutputWindow.tsx (~95 lines)

**Purpose:** Scrollable output window showing current agent's output

**Props:**
```typescript
interface OutputWindowProps {
  outputLines: string[];      // Last 1000 lines
  scrollPosition: number;
  autoScroll: boolean;
  onScroll: (delta: number) => void;
}
```

**Key Logic:**
- Display output with syntax highlighting for tool names
- Support auto-scroll to bottom (default: true)
- Keyboard navigation: ↑↓ to scroll, S to toggle auto-scroll
- Circular buffer: max 1000 lines

**Dependencies:** `ink`, `ink-text-input` (for scroll handling)

#### 5.2.10 TelemetryBar.tsx (~45 lines)

**Purpose:** Show current agent and cumulative workflow telemetry with dynamic engine display

**Props:**
```typescript
interface TelemetryBarProps {
  current?: {
    tokensIn: number;
    tokensOut: number;
    cost?: number;        // Optional: not available in all engines
    duration?: number;    // Optional: seconds
    engine: 'claude' | 'codex' | 'cursor';  // Engine of currently selected agent
    isSubAgent?: boolean; // Whether viewing a sub-agent
  };
  cumulative: {
    tokensIn: number;
    tokensOut: number;
    cost?: number;
    avgDuration?: number;
  };
}
```

**Key Logic:**
- Display: "Current: XXXin/YYYout • Workflow Total: XXXin/YYYout • Engine: {engine}"
- Engine display updates dynamically when user navigates with ↑↓ keys
- Shows "(sub-agent)" indicator when viewing sub-agent output
- Optionally show duration if available
- Format large numbers with commas
- **Note:** Cost is optional and not displayed by default - focus is on token counts

**Dependencies:** `ink`, `formatters`

#### 5.2.11 TelemetryDetailView.tsx (~100 lines)

**Purpose:** Full-screen telemetry view (activated by pressing T)

**Props:**
```typescript
interface TelemetryDetailViewProps {
  allAgents: AgentState[];
  subAgents: Map<string, SubAgentState[]>;
  triggeredAgents: TriggeredAgentState[];
  cumulativeStats: {
    totalTokensIn: number;
    totalTokensOut: number;
    totalCost?: number;
    totalDuration?: number;
    loopCost?: number;
    loopIterations?: number;
  };
  onClose: () => void;
}
```

**Key Logic:**
- Render table with columns: Agent, Duration, Tokens (in/out), Cached, Cost
- Show sub-agents indented under parent agents
- Display loop statistics at bottom
- Support scrolling for long lists

**Dependencies:** `ink`, `formatters`

#### 5.2.12 StatusFooter.tsx (~35 lines)

**Purpose:** Show keyboard shortcuts at bottom of screen

**Props:**
```typescript
interface StatusFooterProps {
  currentView: 'workflow' | 'telemetry';
  paused?: boolean;
}
```

**Key Logic:**
- Display different shortcuts based on current view
- Workflow view: "[P]ause [S]kip [Q]uit [↑↓]Scroll [Space]Collapse [T]elemetry"
- Telemetry view: "[T] Close telemetry view • [Q] quit • [↑↓] scroll"

**Dependencies:** `ink`

#### 5.2.13 WorkflowDashboard.tsx (~85 lines)

**Purpose:** Main container component, keyboard event handling, layout orchestration

**Props:**
```typescript
interface WorkflowDashboardProps {
  state: WorkflowState;
  onAction: (action: UIAction) => void;
}

type UIAction =
  | { type: 'PAUSE' }
  | { type: 'SKIP' }
  | { type: 'QUIT' }
  | { type: 'TOGGLE_EXPAND'; agentId: string }
  | { type: 'TOGGLE_TELEMETRY' }
  | { type: 'SCROLL'; delta: number };
```

**Key Logic:**
- Use `useInput()` hook from Ink to capture keyboard events
- Map keys to actions: P→pause, S→skip, Q→quit, T→toggle telemetry, ↑↓→scroll
- Orchestrate all child components
- Conditional rendering based on state (telemetry view vs workflow view)

**Dependencies:** `ink`, all other components, `WorkflowUIState`

**Example Code:**
```typescript
import React from 'react';
import { Box, useInput } from 'ink';
import { BrandingHeader } from './BrandingHeader';
import { AgentTimeline } from './AgentTimeline';
// ... other imports

export const WorkflowDashboard: React.FC<WorkflowDashboardProps> = ({ state, onAction }) => {
  const [showTelemetry, setShowTelemetry] = React.useState(false);

  useInput((input, key) => {
    if (input === 'q') onAction({ type: 'QUIT' });
    if (input === 'p') onAction({ type: 'PAUSE' });
    if (input === 's') onAction({ type: 'SKIP' });
    if (input === 't') setShowTelemetry(!showTelemetry);
    if (key.upArrow) onAction({ type: 'SCROLL', delta: -1 });
    if (key.downArrow) onAction({ type: 'SCROLL', delta: 1 });
  });

  if (showTelemetry) {
    return <TelemetryDetailView {...} onClose={() => setShowTelemetry(false)} />;
  }

  return (
    <Box flexDirection="column">
      <BrandingHeader {...state.branding} />
      <ProgressLine {...state.progress} />
      {state.loopState?.active && <LoopIndicator loopState={state.loopState} />}

      <Box>
        <Box width="40%" borderStyle="single">
          <AgentTimeline {...state.timeline} />
        </Box>
        <Box width="60%" borderStyle="single">
          <OutputWindow {...state.output} />
        </Box>
      </Box>

      <TelemetryBar {...state.telemetry} />
      <StatusFooter currentView="workflow" />
    </Box>
  );
};
```

### 5.3 State Files (Detailed Specifications)

#### 5.3.1 types.ts (~95 lines)

**Purpose:** Type definitions for all UI state

**Exports:**
```typescript
export type AgentStatus =
  | 'pending'      // ○
  | 'running'      // ⠋ (spinner)
  | 'completed'    // ✓
  | 'failed'       // ✗
  | 'skipped'      // ●
  | 'paused'       // ⏸
  | 'retrying';    // ⟳

export interface AgentTelemetry {
  tokensIn: number;
  tokensOut: number;
  cached?: number;      // Optional: not all engines provide
  cost?: number;        // Optional: calculated if pricing available
  duration?: number;    // Optional: in seconds
}

export interface AgentState {
  id: string;
  name: string;
  engine: 'claude' | 'codex' | 'cursor';
  status: AgentStatus;
  telemetry: AgentTelemetry;
  startTime: number;
  endTime?: number;
  error?: string;
  toolCount: number;
  thinkingCount: number;
}

export interface SubAgentState extends AgentState {
  parentId: string;
}

export interface TriggeredAgentState extends AgentState {
  triggeredBy: string;  // Source agent ID
}

export interface LoopState {
  active: boolean;
  sourceAgent: string;
  backSteps: number;
  iteration: number;
  maxIterations: number;
  skipList: string[];
}

export interface WorkflowState {
  workflowName: string;
  version: string;
  packageName: string;
  startTime: number;
  currentStep: number;
  totalSteps: number;
  uniqueCompleted: number;
  totalExecuted: number;

  agents: AgentState[];
  subAgents: Map<string, SubAgentState[]>;
  triggeredAgents: TriggeredAgentState[];

  loopState: LoopState | null;
  expandedNodes: Set<string>;

  outputBuffer: string[];     // Last 1000 lines
  scrollPosition: number;
  autoScroll: boolean;

  showTelemetryView: boolean;
}
```

#### 5.3.2 WorkflowUIState.ts (~100 lines)

**Purpose:** State management class with immutable updates

**Class:**
```typescript
export class WorkflowUIState {
  private state: WorkflowState;
  private listeners: Set<() => void> = new Set();

  constructor(workflowName: string, totalSteps: number) {
    this.state = {
      workflowName,
      version: require('../../package.json').version,
      packageName: require('../../package.json').name,
      startTime: Date.now(),
      currentStep: 0,
      totalSteps,
      uniqueCompleted: 0,
      totalExecuted: 0,
      agents: [],
      subAgents: new Map(),
      triggeredAgents: [],
      loopState: null,
      expandedNodes: new Set(),
      outputBuffer: [],
      scrollPosition: 0,
      autoScroll: true,
      showTelemetryView: false,
    };
  }

  // Immutable state updates
  addMainAgent(agent: Omit<AgentState, 'id'>): void {
    const id = `agent-${Date.now()}-${Math.random()}`;
    this.state = {
      ...this.state,
      agents: [...this.state.agents, { ...agent, id }],
      totalExecuted: this.state.totalExecuted + 1,
    };
    this.notifyListeners();
  }

  updateAgentStatus(agentId: string, status: AgentStatus): void {
    this.state = {
      ...this.state,
      agents: this.state.agents.map(agent =>
        agent.id === agentId
          ? {
              ...agent,
              status,
              endTime: status === 'completed' || status === 'failed'
                ? Date.now()
                : agent.endTime
            }
          : agent
      ),
      uniqueCompleted: status === 'completed'
        ? this.state.uniqueCompleted + 1
        : this.state.uniqueCompleted,
    };
    this.notifyListeners();
  }

  appendOutput(agentId: string, line: string): void {
    const buffer = [...this.state.outputBuffer, line];
    // Keep only last 1000 lines
    if (buffer.length > 1000) {
      buffer.shift();
    }

    this.state = {
      ...this.state,
      outputBuffer: buffer,
      scrollPosition: this.state.autoScroll
        ? buffer.length - 1
        : this.state.scrollPosition,
    };
    this.notifyListeners();
  }

  updateAgentTelemetry(agentId: string, telemetry: Partial<AgentTelemetry>): void {
    // ... update telemetry
    this.notifyListeners();
  }

  // ... other methods

  getState(): Readonly<WorkflowState> {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}
```

#### 5.3.3 TelemetryState.ts (~60 lines)

**Purpose:** Telemetry accumulation and calculation

**Class:**
```typescript
export class TelemetryAccumulator {
  private data: Map<string, AgentTelemetry> = new Map();

  addTokens(agentId: string, tokensIn: number, tokensOut: number): void {
    const existing = this.data.get(agentId) || { tokensIn: 0, tokensOut: 0 };
    this.data.set(agentId, {
      ...existing,
      tokensIn: existing.tokensIn + tokensIn,
      tokensOut: existing.tokensOut + tokensOut,
    });
  }

  getTotal(): AgentTelemetry {
    let total = { tokensIn: 0, tokensOut: 0, cached: 0 };
    for (const telemetry of this.data.values()) {
      total.tokensIn += telemetry.tokensIn;
      total.tokensOut += telemetry.tokensOut;
      total.cached = (total.cached || 0) + (telemetry.cached || 0);
    }
    return total;
  }

  getAverage(): AgentTelemetry {
    const total = this.getTotal();
    const count = this.data.size || 1;
    return {
      tokensIn: Math.round(total.tokensIn / count),
      tokensOut: Math.round(total.tokensOut / count),
      cached: total.cached ? Math.round(total.cached / count) : undefined,
    };
  }

  reset(): void {
    this.data.clear();
  }
}
```

### 5.4 Manager File (Orchestration)

#### 5.4.1 WorkflowUIManager.ts (~100 lines)

**Purpose:** Orchestrate Ink lifecycle, manage state, handle UI events

**Class:**
```typescript
import { render } from 'ink';
import React from 'react';
import { WorkflowDashboard } from '../components/WorkflowDashboard';
import { WorkflowUIState } from '../state/WorkflowUIState';
import { processOutputChunk } from '../utils/outputProcessor';

export class WorkflowUIManager {
  private state: WorkflowUIState;
  private inkInstance: any = null;
  private fallbackMode = false;

  constructor(workflowName: string, totalSteps: number) {
    this.state = new WorkflowUIState(workflowName, totalSteps);
  }

  /**
   * Initialize and start Ink UI rendering
   * Falls back to console.log if TTY unavailable or Ink fails
   */
  start(): void {
    // Check TTY availability
    if (!process.stdout.isTTY) {
      this.fallbackMode = true;
      console.log(`Starting workflow: ${this.state.getState().workflowName}`);
      return;
    }

    try {
      this.inkInstance = render(
        React.createElement(WorkflowDashboard, {
          state: this.state.getState(),
          onAction: this.handleAction.bind(this),
        })
      );

      // Subscribe to state changes to trigger re-renders
      this.state.subscribe(() => {
        if (this.inkInstance) {
          this.inkInstance.rerender(
            React.createElement(WorkflowDashboard, {
              state: this.state.getState(),
              onAction: this.handleAction.bind(this),
            })
          );
        }
      });
    } catch (error) {
      this.fallbackMode = true;
      console.error('Failed to initialize Ink UI, using fallback mode');
      console.log(`Starting workflow: ${this.state.getState().workflowName}`);
    }
  }

  /**
   * Stop and cleanup Ink UI
   */
  stop(): void {
    if (this.inkInstance) {
      this.inkInstance.unmount();
      this.inkInstance = null;
    }
  }

  /**
   * Process output chunk from engine and update UI
   */
  handleOutputChunk(agentId: string, chunk: string): void {
    if (this.fallbackMode) {
      console.log(chunk);
      return;
    }

    try {
      const processed = processOutputChunk(chunk);

      // Update output buffer
      this.state.appendOutput(agentId, chunk);

      // Update counters
      if (processed.type === 'tool') {
        this.state.incrementToolCount(agentId);
      }
      if (processed.type === 'thinking') {
        this.state.incrementThinkingCount(agentId);
      }

      // Update telemetry if found
      if (processed.telemetry) {
        this.state.updateAgentTelemetry(agentId, processed.telemetry);
      }
    } catch (error) {
      // Don't crash workflow if UI update fails
      console.error('UI update error:', error.message);
    }
  }

  /**
   * Handle keyboard actions from UI
   */
  private handleAction(action: UIAction): void {
    switch (action.type) {
      case 'QUIT':
        this.stop();
        process.exit(0);
        break;
      case 'PAUSE':
        // Emit pause event (workflow will handle)
        process.emit('workflow:pause');
        break;
      case 'SKIP':
        // Emit skip event (workflow will handle)
        process.emit('workflow:skip');
        break;
      case 'TOGGLE_EXPAND':
        this.state.toggleExpand(action.agentId);
        break;
      case 'SCROLL':
        this.state.scroll(action.delta);
        break;
      case 'TOGGLE_TELEMETRY':
        this.state.toggleTelemetryView();
        break;
    }
  }

  // Public API for workflow integration
  addMainAgent(index: number, id: string, name: string, engine: string): void {
    this.state.addMainAgent({ id, name, engine, status: 'pending', ... });
  }

  updateAgentStatus(id: string, status: AgentStatus): void {
    this.state.updateAgentStatus(id, status);
  }

  addSubAgent(parentId: string, agent: SubAgentState): void {
    this.state.addSubAgent(parentId, agent);
  }

  addTriggeredAgent(triggeredBy: string, agent: TriggeredAgentState): void {
    this.state.addTriggeredAgent(triggeredBy, agent);
  }

  setLoopState(loopState: LoopState | null): void {
    this.state.setLoopState(loopState);
  }
}
```

### 5.5 Utility Files

#### 5.5.1 telemetryParser.ts (~40 lines)

**Purpose:** Parse telemetry data from engine output (universal tokens extraction)

**Function:**
```typescript
export interface ParsedTelemetry {
  tokensIn: number;
  tokensOut: number;
  cached?: number;
  cost?: number;
  duration?: number;
}

/**
 * Extract telemetry from any engine output
 * Universal pattern: "Tokens: XXXin/YYYout" or "XXXin/YYYout"
 * Optional: "(ZZZ cached)" or "Cost: $X.XX" or "Duration: XXXms"
 */
export function parseTelemetryChunk(chunk: string): ParsedTelemetry | null {
  // Pattern 1: "Tokens: 1234in/567out"
  const tokensMatch = chunk.match(/Tokens:\s*(\d+(?:,\d{3})*)in\/(\d+(?:,\d{3})*)out/i);
  if (!tokensMatch) return null;

  const tokensIn = parseInt(tokensMatch[1].replace(/,/g, ''), 10);
  const tokensOut = parseInt(tokensMatch[2].replace(/,/g, ''), 10);

  const result: ParsedTelemetry = { tokensIn, tokensOut };

  // Optional: cached tokens
  const cachedMatch = chunk.match(/\((\d+(?:,\d{3})*)\s*cached\)/i);
  if (cachedMatch) {
    result.cached = parseInt(cachedMatch[1].replace(/,/g, ''), 10);
  }

  // Optional: cost
  const costMatch = chunk.match(/Cost:\s*\$(\d+\.\d+)/i);
  if (costMatch) {
    result.cost = parseFloat(costMatch[1]);
  }

  // Optional: duration
  const durationMatch = chunk.match(/Duration:\s*(\d+)ms/i);
  if (durationMatch) {
    result.duration = parseInt(durationMatch[1], 10) / 1000; // Convert to seconds
  }

  return result;
}
```

#### 5.5.2 outputProcessor.ts (~50 lines)

**Purpose:** Process output chunks to detect type and extract metadata

**Function:**
```typescript
export type OutputChunkType = 'text' | 'tool' | 'thinking' | 'telemetry' | 'error';

export interface ProcessedChunk {
  type: OutputChunkType;
  content: string;
  telemetry?: ParsedTelemetry;
  toolName?: string;
}

/**
 * Process engine output chunk to determine type and extract data
 */
export function processOutputChunk(chunk: string): ProcessedChunk {
  const trimmed = chunk.trim();

  // Detect tool usage (look for emoji indicators)
  if (trimmed.includes('🔧 TOOL') || trimmed.includes('🔧 COMMAND')) {
    const toolMatch = trimmed.match(/🔧\s+(?:TOOL|COMMAND):\s*(.+)/);
    return {
      type: 'tool',
      content: trimmed,
      toolName: toolMatch ? toolMatch[1] : undefined,
    };
  }

  // Detect thinking blocks
  if (trimmed.includes('🧠 THINKING')) {
    return {
      type: 'thinking',
      content: trimmed,
    };
  }

  // Detect telemetry
  const telemetry = parseTelemetryChunk(trimmed);
  if (telemetry) {
    return {
      type: 'telemetry',
      content: trimmed,
      telemetry,
    };
  }

  // Detect errors
  if (trimmed.includes('ERROR') || trimmed.includes('✗')) {
    return {
      type: 'error',
      content: trimmed,
    };
  }

  // Default: text
  return {
    type: 'text',
    content: trimmed,
  };
}
```

#### 5.5.3 formatters.ts (~60 lines)

**Purpose:** Formatting utilities for display

**Functions:**
```typescript
/**
 * Format duration in seconds to HH:MM:SS or MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format runtime since start (auto-updates)
 */
export function formatRuntime(startTime: number): string {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  return formatDuration(elapsed);
}

/**
 * Format large numbers with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format tokens as "XXX,XXXin/YYY,YYYout"
 */
export function formatTokens(tokensIn: number, tokensOut: number): string {
  return `${formatNumber(tokensIn)}in/${formatNumber(tokensOut)}out`;
}

/**
 * Format cost as "$X.XXXX"
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

/**
 * Format date/time
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

/**
 * Truncate long strings with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
```

#### 5.5.4 statusIcons.ts (~25 lines)

**Purpose:** Map agent status to display icons

**Function:**
```typescript
import { AgentStatus } from '../state/types';

/**
 * Get status icon for agent
 */
export function getStatusIcon(status: AgentStatus): string {
  switch (status) {
    case 'pending':
      return '○';  // Empty circle
    case 'running':
      return '⠋';  // Spinner (will animate in Ink)
    case 'completed':
      return '✓';  // Checkmark
    case 'failed':
      return '✗';  // X mark
    case 'skipped':
      return '●';  // Filled circle
    case 'paused':
      return '⏸';  // Pause symbol
    case 'retrying':
      return '⟳';  // Retry symbol
    default:
      return '?';
  }
}

/**
 * Get color for status (Ink color names)
 */
export function getStatusColor(status: AgentStatus): string {
  switch (status) {
    case 'completed':
      return 'green';
    case 'failed':
      return 'red';
    case 'running':
      return 'blue';
    case 'paused':
      return 'yellow';
    default:
      return 'white';
  }
}
```

### 5.6 Index File

#### 5.6.1 index.ts (~15 lines)

**Purpose:** Main export file for UI module

**Content:**
```typescript
// Export main manager
export { WorkflowUIManager } from './manager/WorkflowUIManager';

// Export types for integration
export type {
  AgentStatus,
  AgentState,
  AgentTelemetry,
  LoopState,
  WorkflowState,
} from './state/types';

// Export utilities if needed externally
export { formatDuration, formatTokens } from './utils/formatters';
export { parseTelemetryChunk } from './utils/telemetryParser';
```

---

## 6. Integration Points

### 6.1 Workflow Execution Integration

**File: `src/workflows/execution/workflow.ts`** (~15 lines changed)

```typescript
import { WorkflowUIManager } from '../../ui';

export async function runWorkflow(options: RunWorkflowOptions = {}): Promise<void> {
  const template = await loadWorkflowTemplate();

  // CHANGE: Initialize Ink UI instead of spinner
  const ui = new WorkflowUIManager(template.name, template.steps.length);
  ui.start();

  try {
    for (let index = startIndex; index < template.steps.length; index += 1) {
      const step = template.steps[index];

      // CHANGE: Add agent to UI
      const agentId = `${step.agentName}-${index}`;
      ui.addMainAgent(index, agentId, step.agentName, step.engine);
      ui.updateAgentStatus(agentId, 'running');

      // CHANGE: Route output to UI instead of spinner loggers
      const result = await executeStep(step, cwd, {
        stdoutLogger: (chunk) => ui.handleOutputChunk(agentId, chunk),
        stderrLogger: (chunk) => ui.handleOutputChunk(agentId, chunk),
      });

      // CHANGE: Update status based on result
      if (result.success) {
        ui.updateAgentStatus(agentId, 'completed');
      } else {
        ui.updateAgentStatus(agentId, 'failed');
      }

      // CHANGE: Update loop state if looping
      if (loopResult?.decision?.shouldRepeat) {
        ui.setLoopState({
          active: true,
          sourceAgent: agentId,
          backSteps: loopResult.decision.backSteps,
          iteration: loopIteration + 1,
          maxIterations: loopConfig.maxIterations,
          skipList: loopResult.decision.skipList || [],
        });
      } else {
        ui.setLoopState(null);
      }
    }
  } finally {
    ui.stop();
  }
}
```

### 6.2 Step Execution Integration

**File: `src/workflows/execution/step.ts`** (~10 lines changed)

```typescript
export async function executeStep(
  step: WorkflowStep,
  cwd: string,
  loggers?: { stdoutLogger?: (chunk: string) => void; stderrLogger?: (chunk: string) => void }
): Promise<StepResult> {
  // Existing code...

  // CHANGE: Pass loggers to engine runner
  const result = await runEngine(step.engine, {
    ...step.config,
    onStdout: loggers?.stdoutLogger,
    onStderr: loggers?.stderrLogger,
  });

  return result;
}
```

### 6.3 Sub-Agent Integration

**File: `src/workflows/execution/subagent.ts`** (~8 lines changed)

```typescript
export async function executeSubAgents(
  parentAgentId: string,
  subAgents: SubAgentConfig[],
  ui: WorkflowUIManager
): Promise<void> {
  // Execute sub-agents in parallel
  await Promise.all(
    subAgents.map(async (subAgent) => {
      const subAgentId = `${parentAgentId}-sub-${subAgent.name}`;

      // CHANGE: Add sub-agent to UI
      ui.addSubAgent(parentAgentId, {
        id: subAgentId,
        name: subAgent.name,
        engine: subAgent.engine,
        status: 'running',
        parentId: parentAgentId,
        ...
      });

      // Execute sub-agent
      const result = await executeSubAgent(subAgent, {
        stdoutLogger: (chunk) => ui.handleOutputChunk(subAgentId, chunk),
      });

      // Update status
      ui.updateAgentStatus(subAgentId, result.success ? 'completed' : 'failed');
    })
  );
}
```

### 6.4 Triggered Agent Integration

**File: `src/workflows/execution/trigger.ts`** (~5 lines changed)

```typescript
export async function handleTriggeredAgent(
  triggeringAgentId: string,
  triggeredAgent: TriggeredAgentConfig,
  ui: WorkflowUIManager
): Promise<void> {
  const triggeredId = `triggered-${triggeredAgent.name}`;

  // CHANGE: Add triggered agent to UI
  ui.addTriggeredAgent(triggeringAgentId, {
    id: triggeredId,
    name: triggeredAgent.name,
    engine: triggeredAgent.engine,
    status: 'running',
    triggeredBy: triggeringAgentId,
    ...
  });

  // Execute
  const result = await executeAgent(triggeredAgent, {
    stdoutLogger: (chunk) => ui.handleOutputChunk(triggeredId, chunk),
  });

  ui.updateAgentStatus(triggeredId, result.success ? 'completed' : 'failed');
}
```

### 6.5 CLI Integration

**File: `src/cli/controllers/session-shell.ts`** (~5 lines changed)

```typescript
case '/start':
  // Clear screen before starting Ink UI
  console.clear();

  // Run workflow with Ink UI
  await runWorkflow();

  // Return to main menu after workflow completes
  await showMainMenu();
  break;
```

### 6.6 Package Dependencies

**File: `package.json`** (add dependencies)

```json
{
  "dependencies": {
    "ink": "^4.4.1",
    "ink-spinner": "^5.0.0",
    "react": "^18.2.0",
    "update-notifier": "^7.0.0",
    "yoga-layout-prebuilt": "^1.10.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/update-notifier": "^6.0.0"
  }
}
```

---

## 7. State Management Details

### 7.1 State Update Patterns

**Immutability Principle:**
```typescript
// ❌ BAD: Direct mutation
this.state.agents[0].status = 'completed';

// ✅ GOOD: Immutable update
this.state = {
  ...this.state,
  agents: this.state.agents.map((agent, i) =>
    i === 0 ? { ...agent, status: 'completed' } : agent
  )
};
```

**Observer Pattern:**
```typescript
class WorkflowUIState {
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}
```

### 7.2 Performance Optimizations

**Debounced State Updates:**
```typescript
class WorkflowUIManager {
  private outputBuffer: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  handleOutputChunk(agentId: string, chunk: string): void {
    this.outputBuffer.push({ agentId, chunk });

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushOutput();
        this.flushTimer = null;
      }, 50); // Flush every 50ms
    }
  }

  private flushOutput(): void {
    const chunks = this.outputBuffer.splice(0);
    chunks.forEach(({ agentId, chunk }) => {
      this.state.appendOutput(agentId, chunk);
    });
  }
}
```

**Circular Buffer for Output:**
```typescript
appendOutput(agentId: string, line: string): void {
  const buffer = [...this.state.outputBuffer];
  buffer.push(line);

  // Keep only last 1000 lines
  while (buffer.length > 1000) {
    buffer.shift();
  }

  this.state = { ...this.state, outputBuffer: buffer };
  this.notifyListeners();
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

**tests/ui/unit/telemetryParser.test.ts** (~80 lines)

```typescript
import { parseTelemetryChunk } from '../../../src/ui/utils/telemetryParser';

describe('telemetryParser', () => {
  describe('Claude output', () => {
    it('should parse standard Claude telemetry', () => {
      const chunk = '⏱️  Duration: 1234ms | Cost: $0.0234 | Tokens: 500in/200out';
      const result = parseTelemetryChunk(chunk);

      expect(result).toEqual({
        tokensIn: 500,
        tokensOut: 200,
        cost: 0.0234,
        duration: 1.234,
      });
    });
  });

  describe('Codex output', () => {
    it('should parse Codex telemetry with cached tokens', () => {
      const chunk = '⏱️  Tokens: 1000in/300out (100 cached)';
      const result = parseTelemetryChunk(chunk);

      expect(result).toEqual({
        tokensIn: 1000,
        tokensOut: 300,
        cached: 100,
      });
    });
  });

  describe('Cursor output', () => {
    it('should parse Cursor telemetry', () => {
      const chunk = '⏱️  Duration: 2345ms | Cost: $0.0080 | Tokens: 800in/400out';
      const result = parseTelemetryChunk(chunk);

      expect(result).toEqual({
        tokensIn: 800,
        tokensOut: 400,
        cost: 0.008,
        duration: 2.345,
      });
    });
  });

  describe('Edge cases', () => {
    it('should return null for malformed input', () => {
      expect(parseTelemetryChunk('No telemetry here')).toBeNull();
    });

    it('should handle large numbers with commas', () => {
      const chunk = 'Tokens: 178,191in/83,613out';
      const result = parseTelemetryChunk(chunk);

      expect(result).toEqual({
        tokensIn: 178191,
        tokensOut: 83613,
      });
    });
  });
});
```

**tests/ui/unit/WorkflowUIState.test.ts** (~100 lines)

```typescript
import { WorkflowUIState } from '../../../src/ui/state/WorkflowUIState';

describe('WorkflowUIState', () => {
  let state: WorkflowUIState;

  beforeEach(() => {
    state = new WorkflowUIState('Test Workflow', 5);
  });

  describe('addMainAgent', () => {
    it('should add agent and increment total executed', () => {
      state.addMainAgent({
        name: 'test-agent',
        engine: 'claude',
        status: 'pending',
        ...
      });

      const currentState = state.getState();
      expect(currentState.agents).toHaveLength(1);
      expect(currentState.totalExecuted).toBe(1);
    });
  });

  describe('updateAgentStatus', () => {
    it('should update status immutably', () => {
      state.addMainAgent({ ... });
      const agentId = state.getState().agents[0].id;

      state.updateAgentStatus(agentId, 'running');

      expect(state.getState().agents[0].status).toBe('running');
    });

    it('should increment uniqueCompleted on completion', () => {
      state.addMainAgent({ ... });
      const agentId = state.getState().agents[0].id;

      state.updateAgentStatus(agentId, 'completed');

      expect(state.getState().uniqueCompleted).toBe(1);
    });
  });

  describe('appendOutput', () => {
    it('should add output line to buffer', () => {
      state.appendOutput('agent-1', 'Test output line');

      expect(state.getState().outputBuffer).toContain('Test output line');
    });

    it('should limit buffer to 1000 lines', () => {
      for (let i = 0; i < 1500; i++) {
        state.appendOutput('agent-1', `Line ${i}`);
      }

      expect(state.getState().outputBuffer.length).toBe(1000);
    });
  });
});
```

### 8.2 Integration Tests

**tests/ui/integration/workflow-execution.test.ts** (~100 lines)

```typescript
import { WorkflowUIManager } from '../../../src/ui';

describe('Workflow Execution Integration', () => {
  it('should handle complete workflow lifecycle', async () => {
    const ui = new WorkflowUIManager('Test Workflow', 3);
    ui.start();

    // Add agent
    ui.addMainAgent(0, 'agent-1', 'Test Agent', 'claude');
    ui.updateAgentStatus('agent-1', 'running');

    // Simulate output
    ui.handleOutputChunk('agent-1', '💬 TEXT: Starting...');
    ui.handleOutputChunk('agent-1', '🔧 TOOL: Read file.ts');
    ui.handleOutputChunk('agent-1', '⏱️  Tokens: 500in/200out');

    // Complete agent
    ui.updateAgentStatus('agent-1', 'completed');

    const state = ui.getState();
    expect(state.agents[0].status).toBe('completed');
    expect(state.agents[0].toolCount).toBe(1);
    expect(state.agents[0].telemetry.tokensIn).toBe(500);

    ui.stop();
  });
});
```

### 8.3 E2E Tests

**tests/ui/e2e/full-workflow.test.ts** (~100 lines)

```typescript
describe('Full Workflow E2E', () => {
  it('should execute complete workflow with loops and sub-agents', async () => {
    // Mock workflow template
    const template = {
      name: 'E2E Test Workflow',
      steps: [
        { name: 'agent-1', engine: 'claude' },
        { name: 'agent-2', engine: 'codex', subAgents: [{...}] },
        { name: 'validator', engine: 'claude', canTriggerLoop: true },
      ],
    };

    // Run workflow
    const result = await runWorkflow(template);

    // Verify all agents executed
    expect(result.executedAgents).toHaveLength(3);
    expect(result.success).toBe(true);
  });
});
```

### 8.4 Test Fixtures

**tests/ui/fixtures/claude-output.txt**
```
💬 TEXT: Starting code analysis...
🔧 TOOL: Read src/main.ts
✅ RESULT: File content loaded
🧠 THINKING: Need to check for common issues
🔧 TOOL: Grep "TODO"
✅ RESULT: Found 5 TODOs
⏱️  Duration: 1234ms | Cost: $0.0234 | Tokens: 2,456in/1,234out
```

**tests/ui/fixtures/codex-output.txt**
```
💬 MESSAGE: Running tests...
🔧 COMMAND: npm test
✅ COMMAND RESULT: All tests passed
⏱️  Tokens: 1,000in/300out (100 cached)
```

### 8.5 Test Coverage Goals

- **Unit Tests:** 95%+ coverage for utils and state
- **Integration Tests:** 85%+ coverage for manager
- **E2E Tests:** Cover all main user journeys

---

## 9. Implementation Timeline

### 9.1 Week 1: Foundation (Days 1-5)

**Day 1: Type System & State Setup**
- ✅ Create `src/ui/state/types.ts` with all type definitions
- ✅ Set up test infrastructure (`tests/ui/` folder structure)
- ✅ Write unit tests for type validation
- **Deliverable:** Complete type system with 100% test coverage

**Day 2: State Management**
- ✅ Implement `WorkflowUIState.ts` with immutable updates
- ✅ Implement `TelemetryState.ts` with accumulation logic
- ✅ Write comprehensive unit tests for all state mutations
- **Deliverable:** Fully tested state management (~90%+ coverage)

**Day 3: Utility Functions (Part 1)**
- ✅ Implement `telemetryParser.ts` with all engine support
- ✅ Implement `outputProcessor.ts` for chunk classification
- ✅ Write unit tests with real fixtures from all 3 engines
- **Deliverable:** Universal telemetry parsing

**Day 4: Utility Functions (Part 2)**
- ✅ Implement `formatters.ts` with all formatting functions
- ✅ Implement `statusIcons.ts` with icon mapping
- ✅ Write unit tests for edge cases (large numbers, duration formats)
- **Deliverable:** Complete utility layer

**Day 5: Review & Refactor**
- ✅ Code review of all foundation code
- ✅ Refactor to ensure <100 lines per file
- ✅ Ensure 95%+ test coverage
- ✅ Document all public APIs with JSDoc
- **Deliverable:** Production-ready foundation

### 9.2 Week 2: Components (Days 6-10)

**Day 6: Simple Components**
- ✅ Implement `BrandingHeader.tsx` with update notification
- ✅ Implement `ProgressLine.tsx` with step tracking
- ✅ Implement `LoopIndicator.tsx` with conditional rendering
- ✅ Implement `StatusFooter.tsx` with keyboard shortcuts
- **Deliverable:** 4 simple components ready

**Day 7: Agent Display Components**
- ✅ Implement `MainAgentNode.tsx` with status icons
- ✅ Implement `SubAgentSummary.tsx` with collapsed view
- ✅ Implement `SubAgentList.tsx` with virtualization
- ✅ Implement `TriggeredAgentList.tsx` with attribution
- **Deliverable:** Agent display components

**Day 8: Timeline & Output Components**
- ✅ Implement `AgentTimeline.tsx` as container
- ✅ Implement `OutputWindow.tsx` with scrolling
- ✅ Add auto-scroll and manual scroll support
- **Deliverable:** Timeline and output display

**Day 9: Telemetry Components**
- ✅ Implement `TelemetryBar.tsx` with current + cumulative
- ✅ Implement `TelemetryDetailView.tsx` with full table
- ✅ Add keyboard navigation for telemetry view
- **Deliverable:** Telemetry display system

**Day 10: Main Dashboard & Integration**
- ✅ Implement `WorkflowDashboard.tsx` as main container
- ✅ Wire up all child components
- ✅ Implement keyboard event handling
- ✅ Test component integration
- **Deliverable:** Complete component system

### 9.3 Week 3: Integration & Manager (Days 11-15)

**Day 11: UI Manager Implementation**
- ✅ Implement `WorkflowUIManager.ts` with Ink lifecycle
- ✅ Add graceful fallback to console.log
- ✅ Implement state subscription and re-rendering
- **Deliverable:** WorkflowUIManager class

**Day 12: Workflow Integration**
- ✅ Modify `src/workflows/execution/workflow.ts`
- ✅ Replace spinner loggers with UI manager
- ✅ Add loop state tracking
- **Deliverable:** Workflow execution integrated

**Day 13: Sub-Agent & Trigger Integration**
- ✅ Modify `src/workflows/execution/subagent.ts`
- ✅ Modify `src/workflows/execution/trigger.ts`
- ✅ Add fallback agent support
- **Deliverable:** Full agent type support

**Day 14: CLI & Dependencies**
- ✅ Modify `src/cli/controllers/session-shell.ts`
- ✅ Update `package.json` with new dependencies
- ✅ Run `npm install` and verify compatibility
- **Deliverable:** CLI integration complete

**Day 15: Integration Testing**
- ✅ Write integration tests with all 3 engines
- ✅ Test with real workflow fixtures
- ✅ Fix integration bugs
- **Deliverable:** 85%+ integration test coverage

### 9.4 Week 4: Polish & Release (Days 16-20)

**Day 16: Performance Optimization**
- ✅ Implement output buffering (50ms flush)
- ✅ Add virtualization for large sub-agent lists
- ✅ Profile and optimize re-render frequency
- **Deliverable:** <50ms UI update latency

**Day 17: E2E Testing**
- ✅ Write E2E tests for complete workflows
- ✅ Test with 50+ sub-agents scenario
- ✅ Test with multiple loop iterations
- ✅ Test fallback scenarios
- **Deliverable:** E2E test suite

**Day 18: Edge Case Handling**
- ✅ Test graceful degradation (no TTY, Ink failure)
- ✅ Test memory limits with long workflows
- ✅ Test Unicode and emoji handling
- ✅ Fix all discovered edge cases
- **Deliverable:** Robust error handling

**Day 19: Documentation & Code Review**
- ✅ Complete JSDoc for all public APIs
- ✅ Write migration guide from spinner to Ink
- ✅ Internal code review
- ✅ Address review feedback
- **Deliverable:** Production-ready code

**Day 20: Final QA & Release**
- ✅ Manual testing with real workflows
- ✅ Verify all success criteria met
- ✅ Create release notes
- ✅ Deploy to production
- **Deliverable:** v0.4.0 release with Ink UI

---

## 10. Risk Mitigation

### 10.1 Risk Matrix

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| Ink fails to render | Medium | High | Graceful fallback to console.log |
| Performance issues with 50+ agents | Medium | Medium | Virtualized lists + output buffering |
| Different engine outputs break parser | Low | High | Comprehensive test fixtures from all engines |
| State management bugs | Medium | High | Extensive unit tests + immutable updates |
| Memory leaks in long workflows | Low | High | Circular buffers + periodic cleanup |
| Breaking changes to existing workflow | Low | Critical | Zero changes to existing files (only additions) |

### 10.2 Detailed Risk Mitigation Strategies

**Risk 1: Ink Rendering Failure**

*Scenario:* Ink fails to initialize or crashes during rendering

*Mitigation:*
```typescript
class WorkflowUIManager {
  start(): void {
    if (!process.stdout.isTTY) {
      this.fallbackMode = true;
      console.log('Starting workflow (no TTY)...');
      return;
    }

    try {
      this.inkInstance = render(<WorkflowDashboard />);
    } catch (error) {
      this.fallbackMode = true;
      console.error('Ink failed, using fallback');
      console.log('Starting workflow...');
    }
  }
}
```

*Validation:* Test in CI/CD without TTY

**Risk 2: Performance Degradation**

*Scenario:* UI becomes slow with 50+ parallel sub-agents

*Mitigation:*
- Virtualized lists for >10 items
- Debounced output updates (50ms)
- Circular buffer (max 1000 lines)
- React.memo for expensive components

*Validation:* Load test with 100 agents

**Risk 3: Parser Compatibility**

*Scenario:* New engine output format breaks telemetry parsing

*Mitigation:*
- Universal regex patterns
- Graceful null returns
- Comprehensive test fixtures
- Version all fixtures with engine versions

*Validation:* Test against real output from all engines

**Risk 4: State Management Bugs**

*Scenario:* Race conditions or state corruption

*Mitigation:*
- Immutable state updates only
- No direct mutations
- Extensive unit tests (95%+ coverage)
- State snapshots for debugging

*Validation:* Fuzz testing with random state mutations

**Risk 5: Memory Leaks**

*Scenario:* Memory grows unbounded in 2-hour workflows

*Mitigation:*
```typescript
// Circular buffer
appendOutput(line: string): void {
  if (this.buffer.length > 1000) {
    this.buffer.shift(); // Remove oldest
  }
  this.buffer.push(line);
}

// Cleanup on unmount
stop(): void {
  this.listeners.clear();
  this.inkInstance?.unmount();
  this.state = null; // Release references
}
```

*Validation:* Memory profiling with 2-hour workflow

**Risk 6: Breaking Changes**

*Scenario:* Integration breaks existing workflows

*Mitigation:*
- Zero changes to existing workflow files
- Only add new UI layer
- Maintain backward compatibility
- Feature flag for rollback

*Validation:* Run all existing workflows with new UI

### 10.3 Contingency Plans

**If Ink is incompatible:**
- Keep spinner as default
- Make Ink opt-in via environment variable: `CODEMACHINE_UI=ink`

**If performance is insufficient:**
- Simplify UI (remove animations)
- Reduce update frequency (100ms instead of 50ms)
- Limit sub-agent display to top 10

**If testing timeline slips:**
- Release as beta feature (v0.4.0-beta)
- Gather user feedback
- Stabilize in v0.4.1

---

## 11. Success Criteria

### 11.1 Functional Requirements

✅ **FR1: Workflow Scope**
- [x] Ink UI only during workflow execution
- [x] CLI commands still use console.log
- [x] Main menu unchanged (ASCII art + typewriter)
- [x] Login screen unchanged

✅ **FR2: Multi-Agent Support**
- [x] Display unlimited main agents
- [x] Support 10+ parallel sub-agents
- [x] Collapsible sub-agent summary
- [x] Triggered agents in separate section

✅ **FR3: Universal Telemetry**
- [x] Track tokens in/out from all engines
- [x] Per-agent telemetry display
- [x] Cumulative workflow telemetry
- [x] Detailed telemetry view (press T)

✅ **FR4: Loop & Trigger Behavior**
- [x] Display loop state indicator
- [x] Show iteration count and skip list
- [x] Track triggered agent attribution
- [x] Update UI on loop back-step

✅ **FR5: Keyboard Interactions**
- [x] P: Pause workflow
- [x] S: Skip current agent
- [x] Q: Quit workflow
- [x] T: Toggle telemetry view
- [x] ↑↓: Scroll output
- [x] Enter: Expand/collapse sub-agents

### 11.2 Non-Functional Requirements

✅ **NFR1: Performance**
- [x] UI update latency <50ms
- [x] Support 100+ total agents without degradation
- [x] Memory stable over 2-hour workflows

✅ **NFR2: File Architecture**
- [x] All files <100 lines of code
- [x] Single responsibility per file
- [x] Clear separation of concerns

✅ **NFR3: Testing**
- [x] Unit tests: 95%+ coverage (utils, state)
- [x] Integration tests: 85%+ coverage (manager)
- [x] E2E tests cover main user journeys

✅ **NFR4: Graceful Degradation**
- [x] Detect TTY availability
- [x] Fallback to console.log if no TTY
- [x] Never crash workflow due to UI errors

### 11.3 Acceptance Tests

**Test 1: Simple Workflow (3 agents)**
```bash
# Run workflow with 3 sequential agents
$ codemachine /start

# Expected:
# - Ink UI renders successfully
# - All 3 agents shown in timeline
# - Output displays in right pane
# - Telemetry updates in real-time
# - Completion summary shows stats
```

**Test 2: Complex Workflow (10 agents, 15 sub-agents)**
```bash
# Run workflow with parallel sub-agents

# Expected:
# - Sub-agents collapsed by default
# - Press ENTER expands sub-agent list
# - All 15 sub-agents visible
# - Telemetry accumulates correctly
```

**Test 3: Loop Scenario**
```bash
# Run workflow that triggers loop

# Expected:
# - Loop indicator appears
# - Shows "Loop: Validator → Back 3 steps • Iteration 2/5"
# - Skip list displayed
# - UI updates correctly on back-step
```

**Test 4: Fallback Mode**
```bash
# Run without TTY
$ codemachine /start < /dev/null

# Expected:
# - Detects no TTY
# - Falls back to console.log
# - Workflow executes successfully
# - No crashes or errors
```

**Test 5: Performance Test**
```bash
# Run workflow with 50 parallel sub-agents

# Expected:
# - UI remains responsive (<50ms lag)
# - Virtualized list renders correctly
# - Memory stable throughout
# - No frame drops
```

### 11.4 Release Checklist

- [ ] All tests passing (unit, integration, E2E)
- [ ] Test coverage >90%
- [ ] Performance benchmarks met (<50ms, 100+ agents)
- [ ] Manual testing with all 3 engines (Claude, Codex, Cursor)
- [ ] Graceful fallback tested (no TTY, Ink failure)
- [ ] Memory profiling shows no leaks
- [ ] Documentation complete (JSDoc, migration guide)
- [ ] Code review completed
- [ ] No breaking changes to existing workflows
- [ ] Version bumped to v0.4.0
- [ ] Release notes written

---

## 12. Conclusion

This implementation plan provides a comprehensive roadmap for replacing CodeMachine's spinner-based logging with a modern Ink terminal UI. The plan includes:

- **Complete architecture** with clear separation of concerns
- **Detailed file specifications** for all 30 new files (~1,850 lines)
- **Comprehensive testing strategy** with 95%+ coverage goals
- **4-week implementation timeline** with clear deliverables
- **Risk mitigation strategies** for all identified risks
- **Clear success criteria** with acceptance tests

**Key Principles:**
1. **Backward Compatibility:** Zero changes to existing workflow execution logic
2. **Graceful Degradation:** Always fallback to console.log if Ink fails
3. **Performance First:** <50ms latency, support for 100+ agents
4. **Universal Telemetry:** Works across all engines (Claude, Codex, Cursor)
5. **Maintainability:** <100 lines per file, comprehensive tests

**Next Steps:**
1. Review and approve this plan
2. Set up development branch: `feature/ink-ui`
3. Begin Week 1 implementation (foundation)
4. Daily standups to track progress
5. Weekly demos of completed milestones

**Estimated Effort:** 4 weeks (1 developer, full-time)

**Target Release:** v0.4.0 - Ink Terminal UI

---

*Document Version: 1.0*
*Last Updated: 2025-01-19*
*Author: CodeMachine Development Team*


 