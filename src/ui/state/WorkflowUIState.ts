import type { WorkflowState, AgentStatus, AgentTelemetry, LoopState } from './types';
import type { EngineType } from '../../infra/engines/index.js';
import {
  createNewAgent,
  updateAgentStatusInList,
  updateAgentTelemetryInList,
  maintainCircularBuffer,
} from './stateMutations';

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
      // Workflow progress tracking
      totalSteps,
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
