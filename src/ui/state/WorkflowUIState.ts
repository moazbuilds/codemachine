import type { WorkflowState, AgentStatus, AgentTelemetry, LoopState } from './types';
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
  private completedAgents: Set<string> = new Set();

  constructor(workflowName: string) {
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
      outputBuffer: [],
      scrollPosition: 0,
      autoScroll: true,
      showTelemetryView: false,
      selectedAgentId: null,
      selectedSubAgentId: null,
    };
  }

  addMainAgent(name: string, engine: 'claude' | 'codex' | 'cursor', index: number, initialStatus?: AgentStatus, customAgentId?: string): string {
    const { id, agent } = createNewAgent(name, engine, customAgentId);

    // If initial status is provided, override the default 'pending' status
    if (initialStatus) {
      agent.status = initialStatus;
    }

    // If initializing as completed, mark it in completedAgents
    if (initialStatus === 'completed') {
      this.completedAgents.add(id);
    }

    this.state = {
      ...this.state,
      agents: [...this.state.agents, agent],
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
      this.state = {
        ...this.state,
        selectedAgentId: agentId,
        outputBuffer: [], // Clear output buffer for new agent
        scrollPosition: 0,
      };
    }

    // Track completed agents
    if (status === 'completed') {
      this.completedAgents.add(agentId);
    }

    this.notifyListeners();
  }

  appendOutput(agentId: string, line: string): void {
    const buffer = maintainCircularBuffer([...this.state.outputBuffer, line], 1000);

    this.state = {
      ...this.state,
      outputBuffer: buffer,
      scrollPosition: this.state.autoScroll ? buffer.length - 1 : this.state.scrollPosition,
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
    this.state = {
      ...this.state,
      selectedAgentId: agentId,
      selectedSubAgentId: null, // Clear sub-agent selection
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

  toggleAutoScroll(): void {
    this.state = {
      ...this.state,
      autoScroll: !this.state.autoScroll,
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
