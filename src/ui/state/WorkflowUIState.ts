import type { WorkflowState, AgentStatus, AgentTelemetry, LoopState, SubAgentState, WorkflowStatus, CheckpointState } from './types';
import type { EngineType } from '../../infra/engines/index.js';
import {
  createNewAgent,
  updateAgentTelemetryInList,
} from './stateMutations';
import {
  getNextNavigableItem,
  getPreviousNavigableItem,
  getCurrentSelection,
  getTimelineLayout,
  calculateScrollOffset,
} from '../utils/navigation';
import packageJson from '../../../package.json' assert { type: 'json' };

/**
 * Workflow UI State Manager with immutable updates and observer pattern
 * Includes notification throttling to prevent UI freezing during rapid updates
 */
export class WorkflowUIState {
  private state: WorkflowState;
  private listeners: Set<() => void> = new Set();
  private pendingNotification: NodeJS.Timeout | null = null;
  private notificationThrottleMs: number = 16; // ~60 FPS max update rate

  constructor(workflowName: string, totalSteps: number = 0) {
    this.state = {
      workflowName,
      version: packageJson.version,
      packageName: packageJson.name,
      startTime: Date.now(),
      agents: [],
      subAgents: new Map(),
      triggeredAgents: [],
      uiElements: [],
      executionHistory: [],
      loopState: null,
      checkpointState: null,
      expandedNodes: new Set(),
      showTelemetryView: false,
      selectedAgentId: null,
      selectedSubAgentId: null,
      selectedItemType: null,
      visibleItemCount: 10,
      scrollOffset: 0,
      // Workflow progress tracking
      totalSteps,
      workflowStatus: 'running', // Initialize as running
      agentIdMapVersion: 0, // Version counter for triggering re-renders on monitoring ID registration
    };
  }

  addMainAgent(name: string, engine: EngineType, index: number, initialStatus?: AgentStatus, customAgentId?: string): string {
    const { id, agent } = createNewAgent(name, engine, customAgentId, index);

    // If initial status is provided, override the default 'pending' status
    if (initialStatus) {
      agent.status = initialStatus;
    }

    this.state = {
      ...this.state,
      agents: [...this.state.agents, agent],
    };

    this.notifyListeners();
    return id;
  }

  addUIElement(text: string, stepIndex: number): void {
    const uiElement: import('./types').UIElement = {
      id: `ui-${stepIndex}-${Date.now()}`,
      text,
      stepIndex,
    };

    this.state = {
      ...this.state,
      uiElements: [...this.state.uiElements, uiElement],
    };

    this.notifyListeners();
  }

  updateAgentStatus(agentId: string, status: AgentStatus): void {
    // Auto-set endTime for terminal statuses to freeze runtime
    const shouldSetEndTime = status === 'completed' || status === 'failed' || status === 'skipped';
    // Auto-set startTime when agent starts running to ensure accurate individual timer
    const shouldSetStartTime = status === 'running';

    this.state = {
      ...this.state,
      agents: this.state.agents.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              status,
              startTime: shouldSetStartTime ? Date.now() : agent.startTime,
              endTime: shouldSetEndTime ? Date.now() : agent.endTime,
            }
          : agent
      ),
    };

    // Auto-select agent when it starts running
    if (status === 'running') {
      this.selectItem(agentId, 'main');
      return;
    }

    this.notifyListeners();
  }


  updateAgentTelemetry(agentId: string, telemetry: Partial<AgentTelemetry>): void {
    this.state = {
      ...this.state,
      agents: updateAgentTelemetryInList(this.state.agents, agentId, telemetry),
    };

    this.notifyListeners();
  }

  selectAgent(agentId: string): void {
    this.selectItem(agentId, 'main');
  }

  selectSubAgent(subAgentId: string): void {
    this.selectItem(subAgentId, 'sub');
  }

  toggleExpand(agentId: string): void {
    const newExpanded = new Set(this.state.expandedNodes);
    if (newExpanded.has(agentId)) {
      newExpanded.delete(agentId);
    } else {
      newExpanded.add(agentId);
    }

    this.state = {
      ...this.state,
      expandedNodes: newExpanded,
    };

    this.state = this.adjustScroll(this.state);

    this.notifyListeners();
  }

  
  incrementToolCount(agentId: string): void {
    this.state = {
      ...this.state,
      agents: this.state.agents.map((agent) =>
        agent.id === agentId
          ? { ...agent, toolCount: agent.toolCount + 1 }
          : agent
      ),
    };

    this.notifyListeners();
  }

  incrementThinkingCount(agentId: string): void {
    this.state = {
      ...this.state,
      agents: this.state.agents.map((agent) =>
        agent.id === agentId
          ? { ...agent, thinkingCount: agent.thinkingCount + 1 }
          : agent
      ),
    };

    this.notifyListeners();
  }

  setLoopState(loopState: LoopState | null): void {
    this.state = {
      ...this.state,
      loopState,
    };

    // Update the source agent's loop round
    if (loopState && loopState.active) {
      // Debug: log loop state
      if (process.env.LOG_LEVEL === 'debug') {
        console.error(`[DEBUG] setLoopState: sourceAgent=${loopState.sourceAgent}, iteration=${loopState.iteration}, reason="${loopState.reason}"`);
      }
      this.state = {
        ...this.state,
        agents: this.state.agents.map((agent) =>
          agent.id === loopState.sourceAgent
            ? { ...agent, loopRound: loopState.iteration, loopReason: loopState.reason }
            : agent
        ),
      };
    }

    this.notifyListeners();
  }

  clearLoopRound(agentId: string): void {
    this.state = {
      ...this.state,
      agents: this.state.agents.map((agent) =>
        agent.id === agentId
          ? { ...agent, loopRound: undefined, loopReason: undefined }
          : agent
      ),
    };

    this.notifyListeners();
  }

  /**
   * Add a sub-agent to the specified parent
   */
  addSubAgent(parentId: string, subAgent: SubAgentState): void {
    const newSubAgents = new Map(this.state.subAgents);
    const parentSubAgents = newSubAgents.get(parentId) || [];

    // Check if sub-agent already exists (by ID)
    const existingIndex = parentSubAgents.findIndex(sa => sa.id === subAgent.id);

    if (existingIndex >= 0) {
      // Update existing sub-agent
      parentSubAgents[existingIndex] = subAgent;
    } else {
      // Add new sub-agent
      parentSubAgents.push(subAgent);
    }

    newSubAgents.set(parentId, parentSubAgents);

    this.state = {
      ...this.state,
      subAgents: newSubAgents,
    };

    this.notifyListeners();
  }

  /**
   * Batch add/update multiple sub-agents for a parent
   * More efficient than individual addSubAgent calls - triggers only one re-render
   */
  batchAddSubAgents(parentId: string, subAgents: SubAgentState[]): void {
    if (subAgents.length === 0) {
      return; // No-op if empty
    }

    const newSubAgents = new Map(this.state.subAgents);
    const parentSubAgents = newSubAgents.get(parentId) || [];

    // Process all sub-agents
    for (const subAgent of subAgents) {
      const existingIndex = parentSubAgents.findIndex(sa => sa.id === subAgent.id);

      if (existingIndex >= 0) {
        // Update existing sub-agent
        parentSubAgents[existingIndex] = subAgent;
      } else {
        // Add new sub-agent
        parentSubAgents.push(subAgent);
      }
    }

    newSubAgents.set(parentId, parentSubAgents);

    this.state = {
      ...this.state,
      subAgents: newSubAgents,
    };

    // Single notification after all updates
    this.notifyListeners();
  }

  /**
   * Update status of a sub-agent
   */
  updateSubAgentStatus(subAgentId: string, status: AgentStatus): void {
    const newSubAgents = new Map(this.state.subAgents);
    let updated = false;

    // Auto-set endTime for terminal statuses to freeze runtime
    const shouldSetEndTime = status === 'completed' || status === 'failed' || status === 'skipped';

    // Find and update the sub-agent across all parents
    for (const [parentId, subAgents] of newSubAgents.entries()) {
      const index = subAgents.findIndex(sa => sa.id === subAgentId);
      if (index >= 0) {
        const updatedSubAgents = [...subAgents];
        updatedSubAgents[index] = {
          ...updatedSubAgents[index],
          status,
          endTime: shouldSetEndTime ? Date.now() : updatedSubAgents[index].endTime,
        };

        newSubAgents.set(parentId, updatedSubAgents);
        updated = true;
        break;
      }
    }

    if (updated) {
      this.state = {
        ...this.state,
        subAgents: newSubAgents,
      };

      this.notifyListeners();
    }
  }

  /**
   * Get all sub-agents for a parent
   */
  getSubAgentsForParent(parentId: string): SubAgentState[] {
    return this.state.subAgents.get(parentId) || [];
  }

  /**
   * Clear all sub-agents for a parent agent (used when resetting for loop iterations)
   */
  clearSubAgentsForParent(parentId: string): void {
    const newSubAgents = new Map(this.state.subAgents);
    newSubAgents.delete(parentId);

    this.state = {
      ...this.state,
      subAgents: newSubAgents,
    };

    this.notifyListeners();
  }

  /**
   * Reset an agent's runtime data for a new loop iteration
   * Clears telemetry, tool count, thinking count, and resets status to pending
   */
  resetAgentForLoop(agentId: string): void {
    this.state = {
      ...this.state,
      agents: this.state.agents.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              status: 'pending',
              toolCount: 0,
              thinkingCount: 0,
              startTime: Date.now(),
              endTime: undefined,
              error: undefined,
              // Preserve loopRound and loopReason - these are set by setLoopState and should persist
              // loopReason: undefined,  <-- removed to preserve loop state
              telemetry: {
                tokensIn: 0,
                tokensOut: 0,
                cached: undefined,
                cost: undefined,
                duration: undefined,
              },
            }
          : agent
      ),
    };

    this.notifyListeners();
  }

  getState(): Readonly<WorkflowState> {
    return this.state;
  }

  setVisibleItemCount(count: number): void {
    const sanitized = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1;

    if (sanitized === this.state.visibleItemCount) {
      const adjustedState = this.adjustScroll(this.state, { visibleCount: sanitized, ensureSelectedVisible: false });
      if (adjustedState !== this.state) {
        this.state = adjustedState;
        this.notifyListeners();
      }
      return;
    }

    const updatedState: WorkflowState = {
      ...this.state,
      visibleItemCount: sanitized,
    };

    const adjustedState = this.adjustScroll(updatedState, { visibleCount: sanitized, ensureSelectedVisible: false });

    if (adjustedState !== this.state) {
      this.state = adjustedState;
      this.notifyListeners();
    }
  }

  setScrollOffset(offset: number, visibleItemCount?: number): void {
    const sanitized = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
    const adjustedState = this.adjustScroll(this.state, {
      visibleCount: visibleItemCount,
      desiredScrollOffset: sanitized,
    });

    if (adjustedState !== this.state) {
      this.state = adjustedState;
      this.notifyListeners();
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    // Throttle notifications to prevent UI freezing during rapid updates
    // Multiple updates within 16ms are batched into a single notification
    if (this.pendingNotification) {
      return; // Already scheduled, skip duplicate
    }

    this.pendingNotification = setTimeout(() => {
      this.pendingNotification = null;
      this.listeners.forEach(listener => listener());
    }, this.notificationThrottleMs);
  }

  /**
   * Force immediate notification (for critical updates that can't wait)
   */
  private notifyListenersImmediate(): void {
    if (this.pendingNotification) {
      clearTimeout(this.pendingNotification);
      this.pendingNotification = null;
    }
    this.listeners.forEach(listener => listener());
  }

  /**
   * Navigate to the next item in the list
   * @param visibleItemCount - Number of items that can fit in the visible area (optional)
   */
  navigateDown(visibleItemCount?: number): void {
    const current = getCurrentSelection(this.state);
    const next = getNextNavigableItem(current, this.state);

    if (next) {
      const viewport = visibleItemCount ?? this.state.visibleItemCount;
      this.selectItem(next.id, next.type, viewport);
      // Use immediate notification for navigation (user expects instant feedback)
      if (this.pendingNotification) {
        clearTimeout(this.pendingNotification);
        this.pendingNotification = null;
        this.notifyListenersImmediate();
      }
    }
  }

  /**
   * Navigate to the previous item in the list
   * @param visibleItemCount - Number of items that can fit in the visible area (optional)
   */
  navigateUp(visibleItemCount?: number): void {
    const current = getCurrentSelection(this.state);
    const prev = getPreviousNavigableItem(current, this.state);

    if (prev) {
      const viewport = visibleItemCount ?? this.state.visibleItemCount;
      this.selectItem(prev.id, prev.type, viewport);
      // Use immediate notification for navigation (user expects instant feedback)
      if (this.pendingNotification) {
        clearTimeout(this.pendingNotification);
        this.pendingNotification = null;
        this.notifyListenersImmediate();
      }
    }
  }

  /**
   * Select a specific item (no buffer management needed - UI reads from log files)
   * @param visibleItemCount - Number of items that can fit in the visible area (optional)
   */
  selectItem(itemId: string, itemType: 'main' | 'summary' | 'sub', visibleItemCount?: number): void {
    if (itemType === 'main') {
      this.state = {
        ...this.state,
        selectedAgentId: itemId,
        selectedSubAgentId: null,
        selectedItemType: 'main',
      };
    } else if (itemType === 'summary') {
      this.state = {
        ...this.state,
        selectedAgentId: itemId,
        selectedSubAgentId: null,
        selectedItemType: 'summary',
      };
    } else {
      this.state = {
        ...this.state,
        selectedSubAgentId: itemId,
        selectedItemType: 'sub',
      };
    }

    const adjustedState = this.adjustScroll(this.state, { visibleCount: visibleItemCount });
    if (adjustedState !== this.state) {
      this.state = adjustedState;
    }

    this.notifyListeners();
  }

  private adjustScroll(
    state: WorkflowState,
    options: { visibleCount?: number; ensureSelectedVisible?: boolean; desiredScrollOffset?: number } = {}
  ): WorkflowState {
    const resolvedVisible = options.visibleCount ?? state.visibleItemCount;
    const visibleLines = Number.isFinite(resolvedVisible)
      ? Math.max(1, Math.floor(resolvedVisible))
      : 1;

    const layout = getTimelineLayout(state);
    if (layout.length === 0) {
      const needsUpdate = state.scrollOffset !== 0 || state.visibleItemCount !== visibleLines;
      return needsUpdate
        ? { ...state, scrollOffset: 0, visibleItemCount: visibleLines }
        : state;
    }

    const totalLines = layout[layout.length - 1].offset + layout[layout.length - 1].height;
    const maxOffset = Math.max(0, totalLines - visibleLines);

    let desiredOffset = options.desiredScrollOffset ?? state.scrollOffset;
    if (!Number.isFinite(desiredOffset)) {
      desiredOffset = 0;
    }
    let nextOffset = Math.max(0, Math.min(Math.floor(desiredOffset), maxOffset));

    if (options.ensureSelectedVisible !== false) {
      const selection = getCurrentSelection(state);
      if (selection.id && selection.type) {
        const selectedIndex = layout.findIndex(
          (entry) => entry.item.id === selection.id && entry.item.type === selection.type
        );
        nextOffset = calculateScrollOffset(layout, selectedIndex, nextOffset, visibleLines);
      } else {
        nextOffset = Math.max(0, Math.min(nextOffset, maxOffset));
      }
    } else {
      nextOffset = Math.max(0, Math.min(nextOffset, maxOffset));
    }

    if (nextOffset === state.scrollOffset && visibleLines === state.visibleItemCount) {
      return state;
    }

    return {
      ...state,
      scrollOffset: nextOffset,
      visibleItemCount: visibleLines,
    };
  }

  /**
   * Set workflow execution status
   */
  setWorkflowStatus(status: WorkflowStatus): void {
    if (this.state.workflowStatus === status) {
      return;
    }

    this.state = {
      ...this.state,
      workflowStatus: status,
    };

    this.notifyListeners();
  }

  /**
   * Set checkpoint state for manual review
   */
  setCheckpointState(checkpoint: CheckpointState | null): void {
    this.state = {
      ...this.state,
      checkpointState: checkpoint,
    };

    this.notifyListeners();
  }

  /**
   * Freeze workflow runtime (called on Ctrl+C or completion)
   */
  freezeWorkflowRuntime(): void {
    if (this.state.endTime) {
      return; // Already frozen
    }

    this.state = {
      ...this.state,
      endTime: Date.now(),
    };

    this.notifyListeners();
  }

  /**
   * Save agent's current state to execution history before resetting
   * Used for loop cycles to preserve telemetry data
   */
  saveAgentToHistory(agentId: string, cycleNumber?: number): void {
    const agent = this.state.agents.find(a => a.id === agentId);
    if (!agent) {
      return;
    }

    // Calculate duration if endTime exists
    const duration = agent.endTime
      ? (agent.endTime - agent.startTime) / 1000
      : undefined;

    const record: import('./types').ExecutionRecord = {
      id: `${agentId}-${cycleNumber || Date.now()}`,
      agentName: agent.name,
      agentId: agent.id,
      cycleNumber,
      engine: agent.engine,
      status: agent.status,
      startTime: agent.startTime,
      endTime: agent.endTime,
      duration,
      telemetry: { ...agent.telemetry },
      toolCount: agent.toolCount,
      thinkingCount: agent.thinkingCount,
      error: agent.error,
    };

    this.state = {
      ...this.state,
      executionHistory: [...this.state.executionHistory, record],
    };

    this.notifyListeners();
  }

  /**
   * Save subagents to execution history
   * Called when clearing subagents before loop reset
   */
  saveSubAgentsToHistory(parentId: string): void {
    const subAgents = this.state.subAgents.get(parentId);
    if (!subAgents || subAgents.length === 0) {
      return;
    }

    const records: import('./types').ExecutionRecord[] = subAgents.map((subAgent) => {
      const duration = subAgent.endTime
        ? (subAgent.endTime - subAgent.startTime) / 1000
        : undefined;

      return {
        id: `${subAgent.id}-${Date.now()}`,
        agentName: subAgent.name,
        agentId: subAgent.id,
        engine: subAgent.engine,
        status: subAgent.status,
        startTime: subAgent.startTime,
        endTime: subAgent.endTime,
        duration,
        telemetry: { ...subAgent.telemetry },
        toolCount: 0, // Subagents don't track tool count
        thinkingCount: 0, // Subagents don't track thinking count
        error: subAgent.error,
      };
    });

    this.state = {
      ...this.state,
      executionHistory: [...this.state.executionHistory, ...records],
    };

    this.notifyListeners();
  }

  /**
   * Get cumulative telemetry from execution history
   * This persists across loop resets
   */
  getCumulativeTelemetry(): {
    totalTokensIn: number;
    totalTokensOut: number;
    totalCached: number;
    totalCost: number;
  } {
    const history = this.state.executionHistory;

    return {
      totalTokensIn: history.reduce((sum, record) => sum + record.telemetry.tokensIn, 0),
      totalTokensOut: history.reduce((sum, record) => sum + record.telemetry.tokensOut, 0),
      totalCached: history.reduce((sum, record) => sum + (record.telemetry.cached || 0), 0),
      totalCost: history.reduce((sum, record) => sum + (record.telemetry.cost || 0), 0),
    };
  }

  /**
   * Increment agent ID map version to trigger re-renders
   * Called when registerMonitoringId updates the mapping
   */
  incrementAgentIdMapVersion(): void {
    this.state = {
      ...this.state,
      agentIdMapVersion: this.state.agentIdMapVersion + 1,
    };

    this.notifyListeners();
  }

}
