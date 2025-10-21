import type {
  AgentState,
  AgentStatus,
  AgentTelemetry,
} from './types';
import type { EngineType } from '../../infra/engines/index.js';

/**
 * Immutable state mutation helpers
 */

export function createNewAgent(
  name: string,
  engine: EngineType,
  customAgentId?: string,
  stepIndex?: number
): { id: string; agent: AgentState } {
  const id = customAgentId ?? `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const agent: AgentState = {
    id,
    name,
    engine,
    status: 'pending',
    telemetry: { tokensIn: 0, tokensOut: 0 },
    startTime: Date.now(),
    toolCount: 0,
    thinkingCount: 0,
    stepIndex,
  };
  return { id, agent };
}

export function updateAgentInList(
  agents: AgentState[],
  agentId: string,
  updates: Partial<AgentState>
): AgentState[] {
  return agents.map(agent =>
    agent.id === agentId ? { ...agent, ...updates } : agent
  );
}

export function updateAgentStatusInList(
  agents: AgentState[],
  agentId: string,
  status: AgentStatus
): AgentState[] {
  return agents.map(agent =>
    agent.id === agentId
      ? {
          ...agent,
          status,
          endTime: (status === 'completed')
            ? Date.now()
            : agent.endTime,
        }
      : agent
  );
}

export function updateAgentTelemetryInList(
  agents: AgentState[],
  agentId: string,
  telemetry: Partial<AgentTelemetry>
): AgentState[] {
  return agents.map(agent =>
    agent.id === agentId
      ? {
          ...agent,
          telemetry: { ...agent.telemetry, ...telemetry },
        }
      : agent
  );
}

export function maintainCircularBuffer(buffer: string[], maxSize: number): string[] {
  const newBuffer = [...buffer];
  while (newBuffer.length > maxSize) {
    newBuffer.shift();
  }
  return newBuffer;
}
