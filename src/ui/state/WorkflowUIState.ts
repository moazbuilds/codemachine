import type { WorkflowState, AgentStatus, AgentTelemetry, LoopState, SubAgentState, WorkflowStatus } from './types';
import type { EngineType } from '../../infra/engines/index.js';
import {
  createNewAgent,
  updateAgentStatusInList,
  updateAgentTelemetryInList,
  maintainCircularBuffer,
} from './stateMutations';
import {
  getNextNavigableItem,
  getPreviousNavigableItem,
  getCurrentSelection,
} from '../utils/navigation';

/**
 * Workflow UI State Manager with immutable updates and observer pattern
 */
export class WorkflowUIState {
  private state: WorkflowState;
  private listeners: Set<() => void> = new Set();

  constructor(workflowName: string, totalSteps: number = 0) {
    this.state = {
      workflowName,
      version: '0.3.1',
      packageName: 'codemachine',
      startTime: Date.now(),
      agents: [],
      subAgents: new Map(),
      triggeredAgents: [],
      loopState: null,
      expandedNodes: new Set(),
      outputBuffers: new Map(),
      outputBuffer: [],
      showTelemetryView: false,
      selectedAgentId: null,
      selectedSubAgentId: null,
      selectedItemType: null,
      // Workflow progress tracking
      totalSteps,
      workflowStatus: 'running', // Initialize as running
    };
  }

  addMainAgent(name: string, engine: EngineType, index: number, initialStatus?: AgentStatus, customAgentId?: string): string {
    const { id, agent } = createNewAgent(name, engine, customAgentId, index);

    // If initial status is provided, override the default 'pending' status
    if (initialStatus) {
      agent.status = initialStatus;
    }

    
    // Initialize buffer for this agent
    const newOutputBuffers = new Map(this.state.outputBuffers);
    newOutputBuffers.set(id, []);

    this.state = {
      ...this.state,
      agents: [...this.state.agents, agent],
      outputBuffers: newOutputBuffers,
    };

    this.notifyListeners();
    return id;
  }

  updateAgentStatus(agentId: string, status: AgentStatus): void {
    this.state = {
      ...this.state,
      agents: updateAgentStatusInList(this.state.agents, agentId, status),
    };

    // Auto-select agent when it starts running
    if (status === 'running') {
      // Clear this agent's buffer and select it
      const newOutputBuffers = new Map(this.state.outputBuffers);
      newOutputBuffers.set(agentId, []);

      this.state = {
        ...this.state,
        selectedAgentId: agentId,
        outputBuffers: newOutputBuffers,
        outputBuffer: [], // Clear current display buffer
      };
    }

    this.notifyListeners();
  }

  appendOutput(agentId: string, line: string): void {
    // Get or create buffer for this specific agent
    const newOutputBuffers = new Map(this.state.outputBuffers);
    const agentBuffer = newOutputBuffers.get(agentId) || [];
    const updatedAgentBuffer = maintainCircularBuffer([...agentBuffer, line], 1000);
    newOutputBuffers.set(agentId, updatedAgentBuffer);

    // Update the current display buffer if this agent is selected
    const currentOutputBuffer = this.state.selectedAgentId === agentId
      ? updatedAgentBuffer
      : this.state.outputBuffer;

    this.state = {
      ...this.state,
      outputBuffers: newOutputBuffers,
      outputBuffer: currentOutputBuffer,
    };

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
    // Get the selected agent's buffer
    const agentBuffer = this.state.outputBuffers.get(agentId) || [];

    this.state = {
      ...this.state,
      selectedAgentId: agentId,
      selectedSubAgentId: null, // Clear sub-agent selection
      outputBuffer: agentBuffer, // Switch display to this agent's buffer
    };

    this.notifyListeners();
  }

  selectSubAgent(subAgentId: string): void {
    this.state = {
      ...this.state,
      selectedSubAgentId: subAgentId,
    };

    this.notifyListeners();
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
      this.state = {
        ...this.state,
        agents: this.state.agents.map((agent) =>
          agent.id === loopState.sourceAgent
            ? { ...agent, loopRound: loopState.iteration }
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
          ? { ...agent, loopRound: undefined }
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
   * Update status of a sub-agent
   */
  updateSubAgentStatus(subAgentId: string, status: AgentStatus): void {
    const newSubAgents = new Map(this.state.subAgents);
    let updated = false;

    // Find and update the sub-agent across all parents
    for (const [parentId, subAgents] of newSubAgents.entries()) {
      const index = subAgents.findIndex(sa => sa.id === subAgentId);
      if (index >= 0) {
        const updatedSubAgents = [...subAgents];
        updatedSubAgents[index] = { ...updatedSubAgents[index], status };

        // Set endTime if status is completed or failed equivalent
        if (status === 'completed') {
          updatedSubAgents[index].endTime = Date.now();
        }

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

  /**
   * Navigate to the next item in the list
   */
  navigateDown(): void {
    const current = getCurrentSelection(this.state);
    const next = getNextNavigableItem(current, this.state);

    if (next) {
      this.selectItem(next.id, next.type);
    }
  }

  /**
   * Navigate to the previous item in the list
   */
  navigateUp(): void {
    const current = getCurrentSelection(this.state);
    const prev = getPreviousNavigableItem(current, this.state);

    if (prev) {
      this.selectItem(prev.id, prev.type);
    }
  }

  /**
   * Select a specific item and update output buffer accordingly
   */
  selectItem(itemId: string, itemType: 'main' | 'summary' | 'sub'): void {
    if (itemType === 'main') {
      // Select main agent
      const agentBuffer = this.state.outputBuffers.get(itemId) || [];
      this.state = {
        ...this.state,
        selectedAgentId: itemId,
        selectedSubAgentId: null,
        selectedItemType: 'main',
        outputBuffer: agentBuffer,
      };
    } else if (itemType === 'summary') {
      // Select summary - show parent agent's output
      const parentId = itemId; // summary ID is parent agent ID
      const agentBuffer = this.state.outputBuffers.get(parentId) || [];
      this.state = {
        ...this.state,
        selectedAgentId: parentId,
        selectedSubAgentId: null,
        selectedItemType: 'summary',
        outputBuffer: agentBuffer,
      };
    } else if (itemType === 'sub') {
      // Select sub-agent - show sub-agent's output
      const subAgentBuffer = this.state.outputBuffers.get(itemId) || [];
      this.state = {
        ...this.state,
        selectedSubAgentId: itemId,
        selectedItemType: 'sub',
        outputBuffer: subAgentBuffer,
      };
    }

    this.notifyListeners();
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

}
