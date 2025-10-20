import type { AgentState, WorkflowState } from '../state/types';

/**
 * Centralized agent selection logic
 * Determines which agent should be selected and displayed
 */

/**
 * Get the currently active (running) agent
 * Returns the first agent with 'running' status, or null if none are running
 */
export function getActiveAgent(agents: AgentState[]): AgentState | null {
  return agents.find(agent => agent.status === 'running') || null;
}

/**
 * Get the agent that should be selected by default
 * Priority:
 * 1. Currently running agent
 * 2. Currently selected agent (if still valid)
 * 3. First pending agent
 * 4. Last completed agent
 * 5. First agent
 */
export function getDefaultSelectedAgent(
  agents: AgentState[],
  currentSelectedId: string | null
): AgentState | null {
  if (agents.length === 0) return null;

  // Priority 1: Running agent
  const runningAgent = getActiveAgent(agents);
  if (runningAgent) return runningAgent;

  // Priority 2: Currently selected (if valid)
  if (currentSelectedId) {
    const currentAgent = agents.find(a => a.id === currentSelectedId);
    if (currentAgent) return currentAgent;
  }

  // Priority 3: First pending agent
  const pendingAgent = agents.find(agent => agent.status === 'pending');
  if (pendingAgent) return pendingAgent;

  // Priority 4: Last completed agent
  const completedAgents = agents.filter(agent => agent.status === 'completed');
  if (completedAgents.length > 0) {
    return completedAgents[completedAgents.length - 1];
  }

  // Priority 5: First agent
  return agents[0];
}

/**
 * Check if an agent should automatically be selected
 * Returns true if the agent just started running
 */
export function shouldAutoSelectAgent(
  agentId: string,
  newStatus: string,
  oldStatus: string | undefined
): boolean {
  return newStatus === 'running' && oldStatus !== 'running';
}

/**
 * Get the agent to display in the output window
 * This should match the selected agent
 */
export function getOutputAgent(state: WorkflowState): AgentState | null {
  if (!state.selectedAgentId) {
    return getDefaultSelectedAgent(state.agents, null);
  }

  // Check if selected is a sub-agent
  if (state.selectedSubAgentId) {
    for (const subAgentList of state.subAgents.values()) {
      const subAgent = subAgentList.find(sa => sa.id === state.selectedSubAgentId);
      if (subAgent) return subAgent as AgentState;
    }
  }

  // Return selected main agent
  const agent = state.agents.find(a => a.id === state.selectedAgentId);
  return agent || null;
}

/**
 * Determine if the selection marker (>) should be shown on an agent
 */
export function isAgentSelected(
  agentId: string,
  selectedAgentId: string | null,
  selectedSubAgentId: string | null
): boolean {
  // If a sub-agent is selected, don't mark any main agent
  if (selectedSubAgentId) return false;

  return agentId === selectedAgentId;
}
