# Ink Terminal UI - API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Core API](#core-api)
4. [Components](#components)
5. [State Management](#state-management)
6. [Performance](#performance)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

## Overview

The Ink Terminal UI provides a modern, interactive terminal interface for CodeMachine workflows. It replaces the simple spinner-based logging with a rich split-pane UI showing agent timeline, real-time output, and telemetry tracking.

### Key Features

- **Split-pane layout**: Timeline (left) + Output (right)
- **Real-time updates**: Live agent status, streaming output, telemetry
- **Universal telemetry**: Token tracking across all engines (Claude, Codex, Cursor)
- **Performance optimized**: Batching, buffering, virtualization
- **Graceful degradation**: Auto-fallback to console.log when TTY unavailable
- **Keyboard controls**: Full navigation and interaction

## Quick Start

### Installation

Dependencies are already included in package.json:

```json
{
  "dependencies": {
    "ink": "^4.4.1",
    "react": "^18.3.1",
    "yoga-layout-prebuilt": "^1.10.0"
  }
}
```

### Basic Usage

```typescript
import { WorkflowUIManager } from './ui';

// Create UI manager
const ui = new WorkflowUIManager('My Workflow', 5);

// Start UI rendering
ui.start();

// Add an agent
const agentId = ui.addMainAgent('analyzer', 'claude', 0);

// Update status
ui.updateAgentStatus(agentId, 'running');

// Stream output
ui.handleOutputChunk(agentId, '💬 TEXT: Starting analysis...');
ui.handleOutputChunk(agentId, '🔧 TOOL: Read file.ts');
ui.handleOutputChunk(agentId, '⏱️  Tokens: 500in/200out');

// Complete agent
ui.updateAgentStatus(agentId, 'completed');

// Stop UI
ui.stop();
```

## Core API

### WorkflowUIManager

Main class for managing the Ink UI lifecycle.

#### Constructor

```typescript
constructor(workflowName: string, totalSteps: number)
```

**Parameters:**
- `workflowName`: Name of the workflow to display
- `totalSteps`: Total number of main workflow steps

**Example:**
```typescript
const ui = new WorkflowUIManager('Bug Fix Pipeline', 10);
```

#### Methods

##### start()

Initialize and render the Ink UI. Automatically falls back to console.log if TTY is unavailable.

```typescript
ui.start(): void
```

##### stop()

Stop rendering and cleanup resources. Flushes pending updates.

```typescript
ui.stop(): void
```

##### addMainAgent()

Add a main workflow agent and return its ID.

```typescript
ui.addMainAgent(
  name: string,
  engine: 'claude' | 'codex' | 'cursor',
  index: number
): string
```

**Parameters:**
- `name`: Agent display name
- `engine`: Engine type (claude, codex, cursor)
- `index`: Step index in workflow (0-based)

**Returns:** Agent ID (string)

**Example:**
```typescript
const agentId = ui.addMainAgent('code-reviewer', 'claude', 0);
```

##### updateAgentStatus()

Update agent execution status.

```typescript
ui.updateAgentStatus(
  agentId: string,
  status: AgentStatus
): void
```

**Status values:**
- `pending`: Not yet started (○)
- `running`: Currently executing (⠋)
- `completed`: Successfully finished (✓)
- `failed`: Execution failed (✗)
- `skipped`: Skipped in loop (●)
- `paused`: Execution paused (⏸)
- `retrying`: Retrying after failure (⟳)

**Example:**
```typescript
ui.updateAgentStatus(agentId, 'running');
// ... work ...
ui.updateAgentStatus(agentId, 'completed');
```

##### handleOutputChunk()

Process output chunk from engine. Automatically parses telemetry, counts tools/thinking.

```typescript
ui.handleOutputChunk(
  agentId: string,
  chunk: string
): void
```

**Parameters:**
- `agentId`: Target agent ID
- `chunk`: Output line from engine

**Features:**
- Batches updates (50ms intervals) for performance
- Auto-detects tool usage (increments tool count)
- Auto-detects thinking blocks (increments thinking count)
- Auto-parses telemetry (updates token counts)

**Example:**
```typescript
// Tool usage
ui.handleOutputChunk(agentId, '🔧 TOOL: Read file.ts');

// Thinking block
ui.handleOutputChunk(agentId, '🧠 THINKING: Analyzing code...');

// Telemetry (auto-parsed)
ui.handleOutputChunk(agentId, '⏱️  Tokens: 1000in/500out');
```

##### getState()

Get current UI state (for debugging/testing).

```typescript
ui.getState(): Readonly<WorkflowState>
```

**Returns:** Immutable workflow state object

## Components

### Component Hierarchy

```
WorkflowDashboard (Main Container)
├─ BrandingHeader
│  └─ Workflow name, version, runtime
├─ ProgressLine
│  └─ Step counter, completion stats
├─ LoopIndicator (conditional)
│  └─ Loop state, iteration, skip list
├─ Split Panes
│  ├─ AgentTimeline (Left Pane)
│  │  ├─ MainAgentNode (multiple)
│  │  │  ├─ Status, duration, telemetry
│  │  │  └─ SubAgentSummary/SubAgentList
│  │  └─ TriggeredAgentList
│  └─ OutputWindow (Right Pane)
│     └─ Scrollable, syntax-highlighted output
├─ TelemetryBar
│  └─ Current + cumulative telemetry
├─ TelemetryDetailView (conditional, press T)
│  └─ Per-agent breakdown table
└─ StatusFooter
   └─ Keyboard shortcuts
```

### Keyboard Controls

| Key | Action |
|-----|--------|
| `P` | Pause workflow |
| `S` | Skip current agent |
| `Q` | Quit workflow |
| `T` | Toggle telemetry detail view |
| `Space` | Toggle auto-scroll |
| `Enter` | Expand/collapse sub-agents |
| `↑↓` | Scroll output |

## State Management

### WorkflowUIState Class

Manages UI state with immutable updates and observer pattern.

#### Key Methods

```typescript
class WorkflowUIState {
  // Agent management
  addMainAgent(name, engine, index): string
  updateAgentStatus(agentId, status): void

  // Selection
  selectAgent(agentId): void
  selectSubAgent(subAgentId): void

  // UI controls
  toggleExpand(agentId): void
  toggleAutoScroll(): void
  setPaused(paused): void

  // Telemetry
  updateAgentTelemetry(agentId, telemetry): void
  incrementToolCount(agentId): void
  incrementThinkingCount(agentId): void

  // Output
  appendOutput(agentId, line): void

  // State access
  getState(): Readonly<WorkflowState>
  subscribe(listener): () => void
}
```

#### Immutability

All state updates create new state objects:

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

## Performance

### Optimization Techniques

#### 1. Batched Updates

Output chunks are batched and flushed every 50ms:

```typescript
// Instead of immediate render on each chunk:
manager.handleOutputChunk(agentId, 'Line 1'); // Batched
manager.handleOutputChunk(agentId, 'Line 2'); // Batched
manager.handleOutputChunk(agentId, 'Line 3'); // Batched
// ... 50ms later: Single batch flush → One render
```

**Performance:** Max 20 renders/second instead of 100+

#### 2. Circular Buffer

Output buffer limited to 1000 lines:

```typescript
const buffer = new CircularBuffer<string>(1000);
buffer.push('Line 1');
// ... 1000 more lines ...
buffer.push('Line 1002'); // Automatically removes oldest
```

**Memory:** Constant memory usage regardless of workflow length

#### 3. Virtualized Lists

Sub-agent lists virtualized when >10 items:

```typescript
// Only renders visible items (10 at a time)
const { visibleItems } = getVisibleItems(subAgents, scrollOffset, 10);
```

**Performance:** O(1) render time regardless of list size

### Performance Metrics

- **Target:** <50ms UI update latency
- **Memory:** <50MB for 100 agents
- **Throughput:** 500+ output chunks/second
- **Render rate:** Max 20 renders/second (50ms batching)

## Testing

### Test Structure

```
tests/ui/
├── unit/
│   ├── performance.test.ts          # Performance utilities
│   ├── telemetryParser.test.ts      # Telemetry parsing
│   └── formatters.test.ts           # Formatting functions
├── integration/
│   ├── workflow-ui-manager.test.ts  # Manager integration
│   └── edge-cases.test.ts           # Error handling
├── e2e/
│   └── full-workflow.test.ts        # End-to-end scenarios
└── fixtures/
    ├── claude-output.txt             # Real Claude output
    ├── codex-output.txt              # Real Codex output
    └── cursor-output.txt             # Real Cursor output
```

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test tests/ui/unit/performance.test.ts

# With coverage
npm test -- --coverage
```

### Writing Tests

```typescript
import { WorkflowUIManager } from '../../../src/ui';

describe('My Test', () => {
  it('should work', () => {
    const ui = new WorkflowUIManager('Test', 1);
    ui.start();

    const agentId = ui.addMainAgent('test', 'claude', 0);
    ui.handleOutputChunk(agentId, 'Tokens: 100in/50out');

    const state = ui.getState();
    expect(state.agents[0].telemetry.tokensIn).toBeGreaterThan(0);

    ui.stop();
  });
});
```

## Troubleshooting

### Issue: UI not rendering

**Cause:** No TTY available (e.g., running in CI/CD)

**Solution:** UI automatically falls back to console.log. Check logs:
```
Starting workflow: <workflow-name>
```

### Issue: Blank screen

**Cause:** Terminal too small

**Solution:** Resize terminal to at least 80x24 characters

### Issue: Telemetry not updating

**Cause:** Output format not recognized

**Solution:** Ensure output matches expected format:
```
Tokens: <number>in/<number>out
```

Valid formats:
- `Tokens: 1000in/500out`
- `Tokens: 1,000in/500out (100 cached)`
- `⏱️  Duration: 2345ms | Tokens: 800in/400out`

### Issue: High memory usage

**Cause:** Very long workflow with continuous output

**Solution:** Output buffer auto-limits to 1000 lines. If memory still high:
1. Check for memory leaks in workflow code
2. Reduce batch size (modify `BatchUpdater` delay)

### Issue: Slow rendering

**Cause:** Too many rapid updates

**Solution:** Updates are already batched (50ms). If still slow:
1. Check terminal emulator performance
2. Reduce output verbosity in agents
3. Increase batch delay in WorkflowUIManager

## Migration Guide

### From Spinner to Ink UI

**Before (Spinner):**
```typescript
import { startSpinner, stopSpinner } from './shared/logging/spinner-logger';

const spinner = startSpinner(agentName, engine, startTime);
// ... execution ...
spinner.stop();
```

**After (Ink UI):**
```typescript
import { WorkflowUIManager } from './ui';

const ui = new WorkflowUIManager(workflowName, totalSteps);
ui.start();

const agentId = ui.addMainAgent(agentName, engine, index);
ui.updateAgentStatus(agentId, 'running');
// ... stream output via handleOutputChunk ...
ui.updateAgentStatus(agentId, 'completed');

ui.stop();
```

### Key Differences

| Spinner | Ink UI |
|---------|--------|
| Per-agent spinner | Workflow-wide UI manager |
| Overwrites single line | Full-screen split pane |
| No output history | Scrollable output buffer |
| No telemetry tracking | Automatic telemetry parsing |
| No keyboard controls | Full keyboard navigation |

## Best Practices

### 1. Always call stop()

```typescript
const ui = new WorkflowUIManager('Workflow', 5);
ui.start();

try {
  // ... workflow execution ...
} finally {
  ui.stop(); // Always cleanup
}
```

### 2. Stream output incrementally

```typescript
// ✅ GOOD: Stream each line
lines.forEach(line => ui.handleOutputChunk(agentId, line));

// ❌ BAD: Send all at once
ui.handleOutputChunk(agentId, lines.join('\n'));
```

### 3. Update status appropriately

```typescript
// Start
const agentId = ui.addMainAgent('agent', 'claude', 0);
ui.updateAgentStatus(agentId, 'running');

// ... work ...

// End (choose appropriate status)
ui.updateAgentStatus(agentId, result.success ? 'completed' : 'failed');
```

### 4. Handle errors gracefully

```typescript
try {
  ui.start();
  // ... workflow ...
} catch (error) {
  console.error('Workflow failed:', error);
  // UI handles errors internally, won't crash workflow
} finally {
  ui.stop();
}
```

## Support

For issues or questions:
- Check existing tests in `tests/ui/` for examples
- Review component source in `src/ui/components/`
- File issues on GitHub

## Version History

- **v0.4.0**: Initial Ink UI implementation
  - Full component system
  - Performance optimizations
  - Comprehensive test suite
  - Graceful degradation
