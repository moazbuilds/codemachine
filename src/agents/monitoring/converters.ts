import type { AgentRecord } from './types.js';
import type { SubAgentState, AgentStatus as UIAgentStatus } from '../../ui/state/types.js';
import type { EngineType } from '../../infra/engines/index.js';

/**
 * Convert monitoring AgentRecord to UI SubAgentState
 * Bridges the gap between the monitoring system and UI components
 */
export function agentRecordToSubAgentState(
  agent: AgentRecord,
  engine: EngineType = 'anthropic'
): SubAgentState | null {
  // Root agents (no parentId) cannot be converted to SubAgentState
  if (!agent.parentId) {
    return null;
  }

  // Convert status from monitoring format to UI format
  const uiStatus = convertStatus(agent.status);

  return {
    id: agent.id.toString(),
    parentId: agent.parentId.toString(),
    name: agent.name,
    engine,
    status: uiStatus,
    startTime: new Date(agent.startTime).getTime(),
    endTime: agent.endTime ? new Date(agent.endTime).getTime() : undefined,
    error: agent.error,
    telemetry: {
      tokensIn: agent.telemetry?.tokensIn ?? 0,
      tokensOut: agent.telemetry?.tokensOut ?? 0,
      cached: agent.telemetry?.cached,
      cost: agent.telemetry?.cost,
      duration: agent.duration ? agent.duration / 1000 : undefined, // Convert ms to seconds
    },
    toolCount: 0, // Not tracked in AgentRecord
    thinkingCount: 0, // Not tracked in AgentRecord
  };
}

/**
 * Convert all children of a parent agent to SubAgentState array
 */
export function convertChildrenToSubAgents(
  children: AgentRecord[],
  engine: EngineType = 'anthropic'
): SubAgentState[] {
  return children
    .map(child => agentRecordToSubAgentState(child, engine))
    .filter((state): state is SubAgentState => state !== null);
}

/**
 * Convert monitoring agent status to UI agent status
 */
function convertStatus(monitoringStatus: 'running' | 'completed' | 'failed'): UIAgentStatus {
  switch (monitoringStatus) {
    case 'running':
      return 'running';
    case 'completed':
      return 'completed';
    case 'failed':
      // In UI, failed agents are shown as 'retrying' if active, or 'completed' if done
      // For now, map to 'completed' (caller can adjust based on context)
      return 'completed';
    default:
      return 'pending';
  }
}
