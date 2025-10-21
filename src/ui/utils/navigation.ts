import type { WorkflowState, AgentState, SubAgentState } from '../state/types';

/**
 * Represents a navigable item in the UI
 */
export type NavigableItem =
  | { type: 'main'; id: string; agent: AgentState }
  | { type: 'summary'; id: string; parentId: string }
  | { type: 'sub'; id: string; agent: SubAgentState };

/**
 * Current selection state
 */
export interface NavigationSelection {
  id: string | null;
  type: 'main' | 'summary' | 'sub' | null;
}

/**
 * Build a flat list of all navigable items respecting expanded state
 * Order: Main Agent → Summary (if has sub-agents) → Sub-agents (if expanded) → Next Main Agent
 */
export function getFlatNavigableList(state: WorkflowState): NavigableItem[] {
  const items: NavigableItem[] = [];

  for (const agent of state.agents) {
    // Add main agent
    items.push({ type: 'main', id: agent.id, agent });

    // Add summary if sub-agents exist
    const subAgents = state.subAgents.get(agent.id);
    if (subAgents && subAgents.length > 0) {
      // Summary uses parent agent ID
      items.push({ type: 'summary', id: agent.id, parentId: agent.id });

      // Add sub-agents if expanded
      if (state.expandedNodes.has(agent.id)) {
        for (const subAgent of subAgents) {
          items.push({ type: 'sub', id: subAgent.id, agent: subAgent });
        }
      }
    }
  }

  return items;
}

/**
 * Get the next navigable item (circular navigation)
 */
export function getNextNavigableItem(
  current: NavigationSelection,
  state: WorkflowState
): NavigableItem | null {
  const items = getFlatNavigableList(state);

  if (items.length === 0) {
    return null;
  }

  // If nothing selected, return first item
  if (!current.id || !current.type) {
    return items[0];
  }

  // Find current item index
  const currentIndex = items.findIndex(
    (item) => item.id === current.id && item.type === current.type
  );

  if (currentIndex === -1) {
    // Current selection not found, return first item
    return items[0];
  }

  // Circular navigation: wrap to beginning if at end
  const nextIndex = (currentIndex + 1) % items.length;
  return items[nextIndex];
}

/**
 * Get the previous navigable item (circular navigation)
 */
export function getPreviousNavigableItem(
  current: NavigationSelection,
  state: WorkflowState
): NavigableItem | null {
  const items = getFlatNavigableList(state);

  if (items.length === 0) {
    return null;
  }

  // If nothing selected, return last item
  if (!current.id || !current.type) {
    return items[items.length - 1];
  }

  // Find current item index
  const currentIndex = items.findIndex(
    (item) => item.id === current.id && item.type === current.type
  );

  if (currentIndex === -1) {
    // Current selection not found, return last item
    return items[items.length - 1];
  }

  // Circular navigation: wrap to end if at beginning
  const previousIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1;
  return items[previousIndex];
}

/**
 * Get the current selection from workflow state
 */
export function getCurrentSelection(state: WorkflowState): NavigationSelection {
  if (state.selectedItemType === 'main' && state.selectedAgentId) {
    return { id: state.selectedAgentId, type: 'main' };
  }
  if (state.selectedItemType === 'summary' && state.selectedAgentId) {
    return { id: state.selectedAgentId, type: 'summary' };
  }
  if (state.selectedItemType === 'sub' && state.selectedSubAgentId) {
    return { id: state.selectedSubAgentId, type: 'sub' };
  }
  return { id: null, type: null };
}
