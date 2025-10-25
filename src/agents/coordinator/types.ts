/**
 * Types for agent coordination
 */

/**
 * Coordination mode for agents
 */
export type CoordinationMode = 'parallel' | 'sequential';

/**
 * A single agent command to execute
 */
export interface AgentCommand {
  /** Agent name/ID */
  name: string;

  /** Prompt/instruction for the agent (optional - can use template only) */
  prompt?: string;

  /** Input file paths to prepend to prompt */
  input?: string[];

  /** Limit output to last N lines */
  tail?: number;

  /** Additional options for extensibility */
  options?: Record<string, unknown>;
}

/**
 * A group of agent commands that share the same coordination mode
 */
export interface CommandGroup {
  /** Coordination mode for this group */
  mode: CoordinationMode;

  /** Commands in this group */
  commands: AgentCommand[];
}

/**
 * Complete coordination plan parsed from coordination script
 */
export interface CoordinationPlan {
  /** Groups of commands with their coordination modes */
  groups: CommandGroup[];
}

/**
 * Result of a single agent execution
 */
export interface AgentExecutionResult {
  /** Agent name */
  name: string;

  /** Agent ID in monitoring system */
  agentId: number;

  /** Whether execution succeeded */
  success: boolean;

  /** Prompt/instruction used for the agent */
  prompt?: string;

  /** Input files used (for display purposes) */
  input?: string[];

  /** Output from the agent */
  output?: string;

  /** Error message if failed */
  error?: string;

  /** Number of lines if tail limiting was applied */
  tailApplied?: number;
}

/**
 * Result of coordinated execution
 */
export interface CoordinationResult {
  /** Parent agent ID (the coordination session) - undefined for standalone coordination */
  parentId?: number;

  /** Results from all executed agents */
  results: AgentExecutionResult[];

  /** Whether all agents succeeded */
  success: boolean;
}
