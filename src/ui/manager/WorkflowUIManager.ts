import React from 'react';
import { render, type Instance } from 'ink';
import { WorkflowDashboard, type UIAction } from '../components/WorkflowDashboard';
import { WorkflowUIState } from '../state/WorkflowUIState';
import { processOutputChunk } from '../utils/outputProcessor';
import { CircularBuffer, BatchUpdater } from '../utils/performance';
import type { AgentStatus, LoopState, SubAgentState, TriggeredAgentState } from '../state/types';
import type { ParsedTelemetry } from '../../infra/engines/core/types';
import { formatAgentLog } from '../../shared/logging/agent-loggers.js';

/**
 * Orchestrates Ink lifecycle, manages state, and handles UI events
 * Provides graceful fallback to console.log when TTY is unavailable
 * Implements performance optimizations: buffering, batching, throttling
 */
export class WorkflowUIManager {
  private state: WorkflowUIState;
  private inkInstance: Instance | null = null;
  private fallbackMode = false;
  private outputBuffer: CircularBuffer<{ agentId: string; chunk: string }>;
  private batchUpdater: BatchUpdater;
  private renderCount = 0;
  private lastRenderTime = 0;
  private originalConsoleLog?: typeof console.log;
  private originalConsoleError?: typeof console.error;
  private consoleHijacked = false;

  constructor(workflowName: string) {
    this.state = new WorkflowUIState(workflowName);
    this.outputBuffer = new CircularBuffer(1000);
    this.batchUpdater = new BatchUpdater(50); // 50ms batching
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

      // Hijack console to prevent breaking Ink UI
      this.hijackConsole();
    } catch (error) {
      this.fallbackMode = true;
      console.error('Failed to initialize Ink UI, using fallback mode:', error);
      console.log(`Starting workflow: ${this.state.getState().workflowName}`);
    }
  }

  /**
   * Hijack console methods to prevent output from breaking Ink UI
   * Console messages are suppressed when UI is active
   */
  private hijackConsole(): void {
    if (this.consoleHijacked || this.fallbackMode) return;

    this.originalConsoleLog = console.log;
    this.originalConsoleError = console.error;
    this.consoleHijacked = true;

    // Suppress console.log completely during UI mode
    console.log = (..._args: unknown[]) => {
      // Silently ignore - messages should use ui.logMessage() instead
    };

    // Allow errors through stderr for debugging
    console.error = (...args: unknown[]) => {
      if (this.originalConsoleError) {
        this.originalConsoleError(...args);
      }
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
    this.consoleHijacked = false;
  }

  /**
   * Stop and cleanup Ink UI
   */
  stop(): void {
    // Restore console first
    this.restoreConsole();

    // Flush any pending updates
    this.batchUpdater.flush();
    this.batchUpdater.clear();

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
  addMainAgent(name: string, engine: 'claude' | 'codex' | 'cursor', index: number, initialStatus?: AgentStatus, customAgentId?: string): string {
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
   * Update agent status
   */
  updateAgentStatus(agentId: string, status: AgentStatus): void {
    this.state.updateAgentStatus(agentId, status);

    if (this.fallbackMode) {
      console.log(`Agent status: ${status}`);
    }
  }

  /**
   * Process output chunk from engine and update UI
   * Uses batching to prevent excessive re-renders (max 20 renders/sec)
   */
  handleOutputChunk(agentId: string, chunk: string): void {
    if (this.fallbackMode) {
      console.log(chunk);
      return;
    }

    try {
      // Add to circular buffer (auto-manages memory)
      this.outputBuffer.push({ agentId, chunk });

      // Schedule batched update
      this.batchUpdater.schedule(() => {
        this.processBufferedOutput();
      });
    } catch (error) {
      // Don't crash workflow if UI update fails
      console.error('UI update error:', error);
    }
  }

  /**
   * Process all buffered output (called by batch updater)
   */
  private processBufferedOutput(): void {
    const chunks = this.outputBuffer.getAll();
    this.outputBuffer.clear();

    for (const { agentId, chunk } of chunks) {
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
    }

    // Track render performance
    this.renderCount++;
    this.lastRenderTime = Date.now();
  }

  /**
   * Set loop state
   */
  setLoopState(loopState: LoopState | null): void {
    // Loop state will be added to WorkflowUIState in next iteration
    // For now, just log
    if (this.fallbackMode && loopState) {
      console.log(
        `Loop: ${loopState.sourceAgent} → Back ${loopState.backSteps} steps • Iteration ${loopState.iteration}/${loopState.maxIterations}`
      );
    }
  }

  /**
   * Add a sub-agent
   */
  addSubAgent(parentId: string, subAgent: SubAgentState): void {
    // Sub-agent support will be added in WorkflowUIState
    if (this.fallbackMode) {
      console.log(`  Sub-agent: ${subAgent.name} (${subAgent.engine})`);
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
   * Log a workflow message (routes through UI in TTY mode, console.log in fallback)
   * Use this instead of direct console.log to prevent breaking Ink UI
   */
  logMessage(agentId: string, message: string): void {
    if (this.fallbackMode) {
      // In fallback mode, use the colored formatAgentLog
      console.log(formatAgentLog(agentId, message));
    } else {
      // In UI mode, route through output buffer to display in UI
      this.handleOutputChunk(agentId, message + '\n');
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

      case 'TOGGLE_AUTO_SCROLL':
        this.state.toggleAutoScroll();
        break;

      case 'SELECT_AGENT':
        this.state.selectAgent(action.agentId);
        break;

      case 'SELECT_SUB_AGENT':
        this.state.selectSubAgent(action.subAgentId);
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
   * Get current state (for testing/debugging)
   */
  getState() {
    return this.state.getState();
  }
}
