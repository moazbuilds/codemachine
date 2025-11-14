import React from 'react';
import { render, type Instance } from 'ink';
import { WorkflowDashboard, type UIAction } from '../components/WorkflowDashboard';
import { WorkflowUIState } from '../state/WorkflowUIState';
import type { AgentStatus, LoopState, SubAgentState, TriggeredAgentState, WorkflowStatus } from '../state/types';
import type { ParsedTelemetry, EngineType } from '../../infra/engines/index.js';
import { formatAgentLog } from '../../shared/logging/agent-loggers.js';
import { debug } from '../../shared/logging/logger.js';
import { AgentMonitorService, AgentLoggerService, convertChildrenToSubAgents, MonitoringCleanup } from '../../agents/monitoring/index.js';

/**
 * Orchestrates Ink lifecycle, manages state, and handles UI events
 * Provides graceful fallback to console.log when TTY is unavailable
 * UI reads agent output from log files via useLogStream hook
 */
export class WorkflowUIManager {
  private state: WorkflowUIState;
  private inkInstance: Instance | null = null;
  private fallbackMode = false;
  private renderCount = 0;
  private lastRenderTime = 0;
  private originalConsoleLog?: typeof console.log;
  private originalConsoleError?: typeof console.error;
  private originalConsoleWarn?: typeof console.warn;
  private consoleHijacked = false;
  private agentIdMap: Map<string, number> = new Map(); // UI agent ID → Monitoring agent ID
  private syncInterval?: NodeJS.Timeout;
  private debugLogPath?: string;

  constructor(workflowName: string, totalSteps: number = 0) {
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
      // Create React element and render
      this.inkInstance = render(
        React.createElement(WorkflowDashboard, {
          state: this.state.getState(),
          onAction: this.handleAction.bind(this),
          getMonitoringId: this.getMonitoringAgentId.bind(this),
        }),
        {
          exitOnCtrlC: false, // Let MonitoringCleanup handle Ctrl+C instead of Ink
        }
      );

      // Subscribe to state changes to trigger re-renders
      this.state.subscribe(() => {
        if (this.inkInstance) {
          this.inkInstance.rerender(
            React.createElement(WorkflowDashboard, {
              state: this.state.getState(),
              onAction: this.handleAction.bind(this),
              getMonitoringId: this.getMonitoringAgentId.bind(this),
            })
          );
        }
      });

      // Hijack console to prevent breaking Ink UI
      this.hijackConsole();

      if (this.debugLogPath) {
        debug(`[WorkflowUIManager] Writing debug logs to ${this.debugLogPath}`);
      }

      // Start syncing sub-agents from registry
      this.startSubAgentSync();

      MonitoringCleanup.registerWorkflowHandlers({
        onStop: () => {
          // Freeze workflow runtime immediately (not individual agents)
          this.state.freezeWorkflowRuntime();

          // Abort the currently running agent
          (process as NodeJS.EventEmitter).emit('workflow:skip');

          // Stop the entire workflow from continuing to next agents
          (process as NodeJS.EventEmitter).emit('workflow:stop');

          // Update UI to show workflow is stopping and waiting for second Ctrl+C
          this.setWorkflowStatus('stopping');
        },
        onExit: () => {
          // Update UI to show workflow has fully stopped
          this.setWorkflowStatus('stopped');
        },
      });
    } catch (error) {
      this.fallbackMode = true;
      console.error('Failed to initialize Ink UI, using fallback mode:', error);
      console.log(`Starting workflow: ${this.state.getState().workflowName}`);
    }
  }

  /**
   * Store debug log path so we can notify users in fallback mode or future UI renders.
   */
  setDebugLogPath(path: string): void {
    this.debugLogPath = path;
  }

  /**
   * Hijack console methods to prevent output from breaking Ink UI
   * Console messages are suppressed when UI is active
   */
  private hijackConsole(): void {
    if (this.consoleHijacked || this.fallbackMode) return;

    this.originalConsoleLog = console.log;
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
    this.consoleHijacked = true;

    // Suppress console.log completely during UI mode
    console.log = (..._args: unknown[]) => {
      // Silently ignore - messages should use ui.logMessage() instead
    };

    // Suppress console.error and console.warn completely during UI mode
    // All error logging should go through ui.logMessage() to prevent breaking Ink layout
    console.error = (..._args: unknown[]) => {
      // Silently ignore - errors should use ui.logMessage() instead
    };

    // Also hijack console.warn to prevent placeholder warnings from breaking UI
    console.warn = (..._args: unknown[]) => {
      // Silently ignore - warnings should use ui.logMessage() instead
    };
  }

  /**
   * Restore original console methods
   */
  private restoreConsole(): void {
    if (!this.consoleHijacked) return;

    if (this.originalConsoleLog) {
      console.log = this.originalConsoleLog;
    }
    if (this.originalConsoleError) {
      console.error = this.originalConsoleError;
    }
    if (this.originalConsoleWarn) {
      console.warn = this.originalConsoleWarn;
    }
    this.consoleHijacked = false;
  }

  /**
   * Stop and cleanup Ink UI
   */
  stop(): void {
    MonitoringCleanup.clearWorkflowHandlers();

    // Stop sub-agent sync
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }

    // Restore console first
    this.restoreConsole();

    if (this.inkInstance) {
      this.inkInstance.unmount();
      this.inkInstance = null;
    }

    // Log performance stats in fallback mode
    if (this.fallbackMode && this.renderCount > 0) {
      console.log(
        `UI Performance: ${this.renderCount} renders, avg ${Math.round(
          (Date.now() - this.lastRenderTime) / this.renderCount
        )}ms between renders`
      );
    }
  }

  /**
   * Add a main workflow agent
   */
  addMainAgent(name: string, engine: EngineType, index: number, initialStatus?: AgentStatus, customAgentId?: string): string {
    const agentId = this.state.addMainAgent(name, engine, index, initialStatus, customAgentId);

    // Auto-select first non-completed agent (or first agent if all are completed)
    const currentState = this.state.getState();
    if (currentState.selectedAgentId === null && initialStatus !== 'completed') {
      this.state.selectAgent(agentId);
    }

    if (this.fallbackMode) {
      console.log(`Agent ${index + 1}: ${name} (${engine})`);
    }

    return agentId;
  }

  /**
   * Add a UI element to the timeline
   */
  addUIElement(text: string, stepIndex: number): void {
    this.state.addUIElement(text, stepIndex);

    if (this.fallbackMode) {
      console.log(`UI: ${text}`);
    }
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentId: string, status: AgentStatus): void {
    this.state.updateAgentStatus(agentId, status);

    if (this.fallbackMode) {
      console.log(`Agent status: ${status}`);
    }
  }


  /**
   * Set loop state
   */
  setLoopState(loopState: LoopState | null): void {
    // Update state with loop information
    this.state.setLoopState(loopState);

    // Log in fallback mode
    if (this.fallbackMode && loopState) {
      console.log(
        `Loop: ${loopState.sourceAgent} → Back ${loopState.backSteps} steps • Iteration ${loopState.iteration}/${loopState.maxIterations}`
      );
    }
  }

  /**
   * Clear loop round indicator for an agent
   */
  clearLoopRound(agentId: string): void {
    this.state.clearLoopRound(agentId);
  }

  /**
   * Add a sub-agent
   */
  addSubAgent(parentId: string, subAgent: SubAgentState): void {
    this.state.addSubAgent(parentId, subAgent);

    if (this.fallbackMode) {
      console.log(`  Sub-agent: ${subAgent.name} (${subAgent.engine})`);
    }
  }

  /**
   * Update sub-agent status
   */
  updateSubAgentStatus(subAgentId: string, status: AgentStatus): void {
    this.state.updateSubAgentStatus(subAgentId, status);

    if (this.fallbackMode) {
      console.log(`Sub-agent ${subAgentId} status: ${status}`);
    }
  }

  /**
   * Add a triggered agent
   */
  addTriggeredAgent(triggeredBy: string, agent: TriggeredAgentState): void {
    // Triggered agent support will be added in WorkflowUIState
    if (this.fallbackMode) {
      console.log(`⚡ Triggered: ${agent.name} by ${triggeredBy}`);
    }
  }

  /**
   * Log a workflow message to agent's log file
   * Use this instead of direct console.log to prevent breaking Ink UI
   */
  logMessage(agentId: string, message: string): void {
    if (this.fallbackMode) {
      // In fallback mode, use the colored formatAgentLog
      console.log(formatAgentLog(agentId, message));
    } else {
      // In UI mode, write directly to log file
      const monitoringId = this.agentIdMap.get(agentId);
      if (monitoringId !== undefined) {
        const loggerService = AgentLoggerService.getInstance();
        loggerService.write(monitoringId, message + '\n');
      }
    }
  }

  /**
   * Handle keyboard actions from UI
   */
  private handleAction(action: UIAction): void {
    switch (action.type) {
      case 'QUIT':
        this.state.setWorkflowStatus('stopped');
        this.stop();
        process.exit(0);
        break;

      case 'SKIP':
        // Emit skip event (workflow will handle)
        (process as NodeJS.EventEmitter).emit('workflow:skip');
        break;

      case 'TOGGLE_EXPAND':
        this.state.toggleExpand(action.agentId);
        break;

      case 'TOGGLE_TELEMETRY':
        // Telemetry view is handled internally by WorkflowDashboard
        break;

      case 'NAVIGATE_UP':
        this.state.navigateUp(action.visibleItemCount);
        break;

      case 'NAVIGATE_DOWN':
        this.state.navigateDown(action.visibleItemCount);
        break;

      case 'SET_VISIBLE_COUNT':
        this.state.setVisibleItemCount(action.count);
        break;

      case 'SET_SCROLL_OFFSET':
        this.state.setScrollOffset(action.offset, action.visibleItemCount);
        break;

      case 'SELECT_ITEM':
        this.state.selectItem(action.itemId, action.itemType);
        break;

      case 'SELECT_AGENT':
        this.state.selectAgent(action.agentId);
        break;

      case 'SELECT_SUB_AGENT':
        this.state.selectSubAgent(action.subAgentId);
        break;

      case 'CHECKPOINT_CONTINUE':
        (process as NodeJS.EventEmitter).emit('checkpoint:continue');
        break;

      case 'CHECKPOINT_QUIT':
        (process as NodeJS.EventEmitter).emit('checkpoint:quit');
        break;
    }
  }

  /**
   * Update agent telemetry data
   */
  updateAgentTelemetry(agentId: string, telemetry: ParsedTelemetry) {
    this.state.updateAgentTelemetry(agentId, telemetry);
  }

  /**
   * Set workflow execution status
   */
  setWorkflowStatus(status: WorkflowStatus): void {
    // Freeze runtime when workflow reaches terminal status
    if (status === 'completed' || status === 'stopped' || status === 'stopping') {
      this.state.freezeWorkflowRuntime();
    }
    this.state.setWorkflowStatus(status);
  }

  /**
   * Set checkpoint state for manual review
   */
  setCheckpointState(checkpoint: { active: boolean; reason?: string } | null): void {
    this.state.setCheckpointState(checkpoint);
    if (checkpoint && checkpoint.active) {
      this.setWorkflowStatus('checkpoint');
    }
  }

  /**
   * Clear checkpoint state and resume workflow
   */
  clearCheckpointState(): void {
    this.state.setCheckpointState(null);
    this.setWorkflowStatus('running');
  }

  /**
   * Get current state (for testing/debugging)
   */
  getState() {
    return this.state.getState();
  }

  /**
   * Get monitoring agent ID from UI agent ID
   * Used by LogViewer to access log files
   *
   * Handles two cases:
   * 1. Main agents: UUID → monitoring ID via agentIdMap
   * 2. Sub-agents: ID is already the monitoring ID as a string (e.g., "3" → 3)
   */
  getMonitoringAgentId(uiAgentId: string): number | undefined {
    // Validate input
    if (!uiAgentId || typeof uiAgentId !== 'string') {
      console.error('[WorkflowUIManager] Invalid UI agent ID:', uiAgentId);
      return undefined;
    }

    // Try main agent mapping first
    const mappedId = this.agentIdMap.get(uiAgentId);
    if (mappedId !== undefined) {
      // Validate mapped ID is a positive integer
      if (typeof mappedId === 'number' && mappedId > 0 && Number.isInteger(mappedId)) {
        return mappedId;
      }
      console.error('[WorkflowUIManager] Invalid mapped monitoring ID for', uiAgentId, ':', mappedId);
      return undefined;
    }

    // Try parsing as sub-agent ID (monitoring ID as string)
    const parsedId = parseInt(uiAgentId, 10);
    if (!isNaN(parsedId) && parsedId > 0 && Number.isInteger(parsedId)) {
      return parsedId;
    }

    // If parsing failed and it's not a UUID, log debug
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uiAgentId)) {
      debug('[WorkflowUIManager] Could not resolve monitoring ID for UI agent:', uiAgentId);
    }

    return undefined;
  }

  /**
   * Register mapping between UI agent ID and monitoring agent ID
   * Called by workflow execution when agents are registered
   */
  registerMonitoringId(uiAgentId: string, monitoringAgentId: number): void {
    this.agentIdMap.set(uiAgentId, monitoringAgentId);

    // Trigger state update to force re-render
    // This ensures OutputWindow can immediately get the monitoring ID
    // Fixes race condition where UI shows "Waiting for agent output..." forever
    this.state.incrementAgentIdMapVersion();
  }

  /**
   * Sync sub-agents from registry to UI state
   * Polls registry and converts ALL descendants (children, grandchildren, etc.) to SubAgentState
   */
  private syncSubAgentsFromRegistry(): void {
    try {
      const monitor = AgentMonitorService.getInstance();
      const currentState = this.state.getState();

      // For each main agent in UI, sync ALL its descendants from registry
      for (const mainAgent of currentState.agents) {
        const monitoringId = this.agentIdMap.get(mainAgent.id);

        if (monitoringId === undefined) {
          continue; // Agent not registered in monitoring yet
        }

        // Get FULL subtree (all descendants recursively) from registry
        // This captures orchestration sessions AND their spawned agents
        const subtree = monitor.getFullSubtree(monitoringId);

        if (subtree.length <= 1) {
          // Only the root agent exists, no descendants
          continue;
        }

        // Filter out the root agent itself (we only want descendants)
        const descendants = subtree.filter(agent => agent.id !== monitoringId);

        if (descendants.length === 0) {
          continue; // No descendants yet
        }

        // Convert to SubAgentState with UI parent override
        // This flattens the hierarchy: all descendants show under the main agent
        const subAgents = convertChildrenToSubAgents(
          descendants,
          mainAgent.id,      // Override parentId to flatten hierarchy
          mainAgent.engine   // Fallback engine if agent doesn't have its own
        );

        // Batch update all sub-agents at once (single re-render instead of N re-renders)
        this.state.batchAddSubAgents(mainAgent.id, subAgents);
      }
    } catch (_error) {
      // Silently ignore sync errors to prevent UI crashes
      // Registry may not exist yet or be temporarily locked
    }
  }

  /**
   * Start periodic sync of sub-agents from registry
   */
  private startSubAgentSync(): void {
    // Initial sync
    this.syncSubAgentsFromRegistry();

    // Poll every 1000ms with random offset to prevent thundering herd
    // Stagger syncs to avoid simultaneous registry reloads
    const syncDelay = 1000 + Math.random() * 200;
    this.syncInterval = setInterval(() => {
      if (!this.fallbackMode) {
        this.syncSubAgentsFromRegistry();
      }
    }, syncDelay);
  }

  /**
   * Reset an agent for a new loop iteration
   * Saves current state to history, then clears UI data and monitoring registry data
   */
  async resetAgentForLoop(agentId: string, cycleNumber?: number): Promise<void> {
    // 1. Save current agent state to execution history
    this.state.saveAgentToHistory(agentId, cycleNumber);

    // 2. Save current subagents to execution history
    this.state.saveSubAgentsToHistory(agentId);

    // 3. Reset UI state
    this.state.resetAgentForLoop(agentId);
    this.state.clearSubAgentsForParent(agentId);

    // 4. Clear monitoring registry descendants
    const monitoringId = this.agentIdMap.get(agentId);
    if (monitoringId !== undefined) {
      const monitor = AgentMonitorService.getInstance();
      const loggerService = AgentLoggerService.getInstance();

      // Get all descendants to clean up their log streams
      const subtree = monitor.getFullSubtree(monitoringId);
      const descendants = subtree.filter(agent => agent.id !== monitoringId);

      // Close log streams for all descendants
      for (const descendant of descendants) {
        loggerService.closeStream(descendant.id).catch(() => {
          // Ignore errors - stream may not exist yet
        });
      }

      // Clear descendants from monitoring registry
      await monitor.clearDescendants(monitoringId);
    }

    if (this.fallbackMode) {
      console.log(`Reset agent ${agentId} for new loop iteration ${cycleNumber || ''}`);
    }
  }
}
