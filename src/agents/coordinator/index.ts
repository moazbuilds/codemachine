/**
 * Agent Coordinator System
 *
 * Provides multi-agent coordination with parallel and sequential execution:
 * - Parse coordination scripts with & (parallel) and && (sequential)
 * - Execute agents in coordinated groups
 * - Track parent-child relationships in monitoring
 *
 * The parser is unified - handles both legacy and enhanced DSL syntax
 * The executor handles file loading, template loading, and prompt building
 */

export { CoordinatorService } from './service.js';
export { CoordinatorParser } from './parser.js';
export { CoordinationExecutor } from './execution.js';
export type {
  CoordinationMode,
  AgentCommand,
  CommandGroup,
  CoordinationPlan,
  AgentExecutionResult,
  CoordinationResult
} from './types';
