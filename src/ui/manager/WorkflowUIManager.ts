import React from 'react';
import { render, type Instance } from 'ink';
import { WorkflowDashboard, type UIAction } from '../components/WorkflowDashboard';
import { WorkflowUIState } from '../state/WorkflowUIState';
import { processOutputChunk } from '../utils/outputProcessor';
import { CircularBuffer, BatchUpdater } from '../utils/performance';
import type { AgentStatus, LoopState, SubAgentState, TriggeredAgentState } from '../state/types';
import type { ParsedTelemetry } from '../../infra/engines/core/types';

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

  constructor(workflowName: string, totalSteps: number) {
    this.state = new WorkflowUIState(workflowName, totalSteps);
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
    } catch (error) {
      this.fallbackMode = true;
      console.error('Failed to initialize Ink UI, using fallback mode:', error);
      console.log(`Starting workflow: ${this.state.getState().workflowName}`);
    }
  }

  /**
   * Stop and cleanup Ink UI
   */
  stop(): void {
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
  addMainAgent(name: string, engine: 'claude' | 'codex' | 'cursor', index: number): string {
    const agentId = this.state.addMainAgent(name, engine, index);

    // Auto-select first agent
    if (index === 0) {
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
   * Handle keyboard actions from UI
   */
  private handleAction(action: UIAction): void {
    switch (action.type) {
      case 'QUIT':
        this.stop();
        process.exit(0);
        break;

      case 'PAUSE':
        this.state.setPaused(!this.state.getState().paused);
        // Emit pause event (workflow will handle)
        (process as NodeJS.EventEmitter).emit('workflow:pause');
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
