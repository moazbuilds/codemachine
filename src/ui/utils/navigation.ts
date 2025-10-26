import type { WorkflowState, AgentState, SubAgentState, UIElement } from '../state/types';

/**
 * Represents a navigable item in the UI
 */
export type NavigableItem =
  | { type: 'main'; id: string; agent: AgentState }
  | { type: 'summary'; id: string; parentId: string }
  | { type: 'sub'; id: string; agent: SubAgentState }
  | { type: 'ui'; id: string; uiElement: UIElement };

/**
 * Represents a selectable item (excludes UI elements)
 */
export type SelectableItem =
  | { type: 'main'; id: string; agent: AgentState }
  | { type: 'summary'; id: string; parentId: string }
  | { type: 'sub'; id: string; agent: SubAgentState };

export interface TimelineLayoutEntry {
  item: NavigableItem;
  height: number;
  offset: number;
}

/**
 * Calculate the height (in lines) that each item type occupies
 * - Main agent: 1 line (or 2 if showing cycle indicator)
 * - Summary: 1 line
 * - Sub-agent: 1 line
 */
export function getItemHeight(item: NavigableItem): number {
  // Main agents with loop rounds take 2 lines (main line + cycle line)
  if (item.type === 'main' && item.agent.loopRound && item.agent.loopRound > 0) {
    return 2;
  }
  return 1;
}

/**
 * Current selection state
 */
export interface NavigationSelection {
  id: string | null;
  type: 'main' | 'summary' | 'sub' | null;
}

/**
 * Build a complete list of all timeline items including UI elements
 * Used for rendering the timeline (not for navigation)
 * Order: Items sorted by stepIndex (agents and UI elements interleaved)
 */
function getFullItemsList(state: WorkflowState): NavigableItem[] {
  const items: NavigableItem[] = [];

  // Create a combined list of agents and UI elements with their step indices
  type StepItem =
    | { stepIndex: number; type: 'agent'; agent: AgentState }
    | { stepIndex: number; type: 'uiElement'; uiElement: UIElement };

  const stepItems: StepItem[] = [];

  // Add agents
  for (const agent of state.agents) {
    if (agent.stepIndex !== undefined) {
      stepItems.push({ stepIndex: agent.stepIndex, type: 'agent', agent });
    }
  }

  // Add UI elements
  for (const uiElement of state.uiElements) {
    stepItems.push({ stepIndex: uiElement.stepIndex, type: 'uiElement', uiElement });
  }

  // Sort by step index
  stepItems.sort((a, b) => a.stepIndex - b.stepIndex);

  // Build complete list (includes UI elements for rendering)
  for (const stepItem of stepItems) {
    if (stepItem.type === 'agent') {
      const agent = stepItem.agent;

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
    } else {
      // Add UI element
      items.push({ type: 'ui', id: stepItem.uiElement.id, uiElement: stepItem.uiElement });
    }
  }

  return items;
}

/**
 * Build a flat list of navigable items (excludes UI elements)
 * Used for keyboard navigation - UI separators cannot be selected
 * Order: Items sorted by stepIndex (agents only)
 */
export function getFlatNavigableList(state: WorkflowState): SelectableItem[] {
  const fullList = getFullItemsList(state);
  // Filter out UI elements - they're visual only, not selectable
  return fullList.filter(item => item.type !== 'ui') as SelectableItem[];
}

/**
 * Build layout metadata for the timeline to support scrolling calculations.
 * Includes all items (agents, subagents, and UI elements) for rendering.
 */
export function getTimelineLayout(state: WorkflowState): TimelineLayoutEntry[] {
  const items = getFullItemsList(state);  // Use full list to include UI elements in timeline
  const layout: TimelineLayoutEntry[] = [];
  let offset = 0;

  for (const item of items) {
    const height = Math.max(1, getItemHeight(item));
    layout.push({ item, height, offset });
    offset += height;
  }

  return layout;
}

/**
 * Calculate total visible height of the timeline in terminal rows.
 */
export function getTotalTimelineHeight(state: WorkflowState): number {
  const layout = getTimelineLayout(state);
  if (layout.length === 0) {
    return 0;
  }
  const last = layout[layout.length - 1];
  return last.offset + last.height;
}

/**
 * Get the next navigable item (circular navigation)
 */
export function getNextNavigableItem(
  current: NavigationSelection,
  state: WorkflowState
): SelectableItem | null {
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
): SelectableItem | null {
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

/**
 * Calculate the new scroll offset to keep the selected item visible
 * @param selectedIndex - Index of the selected item in the flat list
 * @param currentScrollOffset - Current scroll offset
 * @param visibleItemCount - Number of items that can fit in the visible area
 * @returns New scroll offset
 */
export function calculateScrollOffset(
  layout: TimelineLayoutEntry[],
  selectedIndex: number,
  currentScrollOffset: number,
  visibleLines: number
): number {
  if (layout.length === 0) {
    return 0;
  }

  const totalLines = layout[layout.length - 1].offset + layout[layout.length - 1].height;
  const maxOffset = Math.max(0, totalLines - visibleLines);
  const clampedOffset = Math.max(0, Math.min(currentScrollOffset, maxOffset));

  if (selectedIndex < 0 || selectedIndex >= layout.length) {
    return clampedOffset;
  }

  const entry = layout[selectedIndex];
  const itemStart = entry.offset;
  const itemEnd = entry.offset + entry.height - 1;
  let nextOffset = clampedOffset;

  if (itemStart < clampedOffset) {
    nextOffset = itemStart;
  } else if (itemEnd >= clampedOffset + visibleLines) {
    nextOffset = itemEnd - visibleLines + 1;
  }

  return Math.max(0, Math.min(nextOffset, maxOffset));
}
