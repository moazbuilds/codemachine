import * as path from 'node:path';

import type { EngineType } from '../../infra/engines/index.js';
import { getEngine } from '../../infra/engines/index.js';
import { MemoryAdapter } from '../../infra/fs/memory-adapter.js';
import { MemoryStore } from '../index.js';
import { loadAgentConfig } from './config.js';
import { AgentMonitorService, AgentLoggerService } from '../monitoring/index.js';
import type { ParsedTelemetry } from '../../infra/engines/core/types.js';

/**
 * Cache for engine authentication status with TTL (shared across all subagents)
 * Prevents repeated auth checks that can take 10-30 seconds each
 * CRITICAL: This fixes the 5-minute delay bug when spawning multiple subagents
 */
class EngineAuthCache {
  private cache: Map<string, { isAuthenticated: boolean; timestamp: number }> = new Map();
  private ttlMs: number = 5 * 60 * 1000; // 5 minutes TTL

  async isAuthenticated(engineId: string, checkFn: () => Promise<boolean>): Promise<boolean> {
    const cached = this.cache.get(engineId);
    const now = Date.now();

    // Return cached value if still valid
    if (cached && (now - cached.timestamp) < this.ttlMs) {
      return cached.isAuthenticated;
    }

    // Cache miss or expired - perform actual check
    const result = await checkFn();

    // Cache the result
    this.cache.set(engineId, {
      isAuthenticated: result,
      timestamp: now
    });

    return result;
  }
}

// Global auth cache instance (shared across all subagent executions)
const authCache = new EngineAuthCache();

/**
 * Minimal UI interface for agent execution
 */
export interface AgentExecutionUI {
  registerMonitoringId(uiAgentId: string, monitoringAgentId: number): void;
}

export interface ExecuteAgentOptions {
  /**
   * Engine to use (overrides agent config)
   */
  engine?: EngineType;

  /**
   * Model to use (overrides agent config)
   */
  model?: string;

  /**
   * Working directory for execution
   */
  workingDir: string;

  /**
   * Project root for config lookup (defaults to workingDir)
   */
  projectRoot?: string;

  /**
   * Logger for stdout
   */
  logger?: (chunk: string) => void;

  /**
   * Logger for stderr
   */
  stderrLogger?: (chunk: string) => void;

  /**
   * Telemetry callback (for UI updates)
   */
  onTelemetry?: (telemetry: ParsedTelemetry) => void;

  /**
   * Abort signal
   */
  abortSignal?: AbortSignal;

  /**
   * Timeout in milliseconds
   */
  timeout?: number;

  /**
   * Parent agent ID (for tracking parent-child relationships)
   */
  parentId?: number;

  /**
   * Disable monitoring (for special cases where monitoring is not desired)
   */
  disableMonitoring?: boolean;

  /**
   * UI manager (for registering monitoring IDs)
   */
  ui?: AgentExecutionUI;

  /**
   * Unique agent ID for UI (for registering monitoring IDs)
   */
  uniqueAgentId?: string;

  /**
   * Display prompt (for logging/monitoring - shows user's actual request)
   * If not provided, uses the full execution prompt
   */
  displayPrompt?: string;
}

/**
 * Ensures the engine is authenticated
 */
async function ensureEngineAuth(engineType: EngineType): Promise<void> {
  const { registry } = await import('../../infra/engines/index.js');
  const engine = registry.get(engineType);

  if (!engine) {
    const availableEngines = registry.getAllIds().join(', ');
    throw new Error(
      `Unknown engine type: ${engineType}. Available engines: ${availableEngines}`
    );
  }

  const isAuthed = await engine.auth.isAuthenticated();
  if (!isAuthed) {
    console.error(`\n${engine.metadata.name} authentication required`);
    console.error(`\nRun the following command to authenticate:\n`);
    console.error(`  codemachine auth login\n`);
    throw new Error(`${engine.metadata.name} authentication required`);
  }
}

/**
 * Executes a sub-agent or CLI agent with a pre-built prompt
 *
 * This is a low-level execution function that:
 * - Accepts FINAL, ready-to-use prompts (no template loading or prompt building)
 * - Handles engine authentication
 * - Manages monitoring and logging
 * - Executes the engine
 * - Stores output in memory
 *
 * Prompt building is the caller's responsibility:
 * - Orchestration layer: builds [SYSTEM] + [INPUT FILES] + [REQUEST]
 * - Workflow layer: processes templates with processPromptString()
 *
 * This loads agent configuration from:
 * - config/sub.agents.js
 * - config/main.agents.js
 * - .codemachine/agents/agents-config.json
 *
 * Used by:
 * - Orchestration executor (src/agents/orchestration/executor.ts)
 * - Workflow step executor (src/workflows/execution/step.ts)
 * - CLI commands (via orchestration)
 */
export interface AgentExecutionOutput {
  output: string;
  agentId?: number;
}

export async function executeAgent(
  agentId: string,
  prompt: string,
  options: ExecuteAgentOptions,
): Promise<AgentExecutionOutput> {
  const { workingDir, projectRoot, engine: engineOverride, model: modelOverride, logger, stderrLogger, onTelemetry, abortSignal, timeout, parentId, disableMonitoring, ui, uniqueAgentId, displayPrompt } = options;

  // Load agent config to determine engine and model
  const agentConfig = await loadAgentConfig(agentId, projectRoot ?? workingDir);

  // Determine engine: CLI override > agent config > first authenticated engine
  const { registry } = await import('../../infra/engines/index.js');
  let engineType: EngineType;

  if (engineOverride) {
    engineType = engineOverride;
  } else if (agentConfig.engine) {
    engineType = agentConfig.engine;
  } else {
    // Fallback: find first authenticated engine by order (WITH CACHING - critical for subagents)
    const engines = registry.getAll();
    let foundEngine = null;

    for (const engine of engines) {
      // Use cached auth check to avoid 10-30 second delays per subagent
      const isAuth = await authCache.isAuthenticated(
        engine.metadata.id,
        () => engine.auth.isAuthenticated()
      );
      if (isAuth) {
        foundEngine = engine;
        break;
      }
    }

    if (!foundEngine) {
      // If no authenticated engine, use default (first by order)
      foundEngine = registry.getDefault();
    }

    if (!foundEngine) {
      throw new Error('No engines registered. Please install at least one engine.');
    }

    engineType = foundEngine.metadata.id;
    console.log(`ℹ️  No engine specified for agent '${agentId}', using ${foundEngine.metadata.name} (${engineType})`);
  }

  // Ensure authentication
  await ensureEngineAuth(engineType);

  // Get engine module for defaults
  const engineModule = registry.get(engineType);
  if (!engineModule) {
    throw new Error(`Engine not found: ${engineType}`);
  }

  // Model resolution: CLI override > agent config (legacy) > engine default
  const model = modelOverride ?? (agentConfig.model as string | undefined) ?? engineModule.metadata.defaultModel;
  const modelReasoningEffort = (agentConfig.modelReasoningEffort as 'low' | 'medium' | 'high' | undefined) ?? engineModule.metadata.defaultModelReasoningEffort;

  // Initialize monitoring with engine/model info (unless explicitly disabled)
  const monitor = !disableMonitoring ? AgentMonitorService.getInstance() : null;
  const loggerService = !disableMonitoring ? AgentLoggerService.getInstance() : null;
  let monitoringAgentId: number | undefined;

  if (monitor && loggerService) {
    monitoringAgentId = monitor.register({
      name: agentId,
      prompt: displayPrompt || prompt, // Use display prompt for logging if provided
      parentId,
      engineProvider: engineType,
      modelName: model,
    });

    // Register monitoring ID with UI immediately so it can load logs
    if (ui && uniqueAgentId && monitoringAgentId !== undefined) {
      ui.registerMonitoringId(uniqueAgentId, monitoringAgentId);
    }
  }

  // Set up memory
  const memoryDir = path.resolve(workingDir, '.codemachine', 'memory');
  const adapter = new MemoryAdapter(memoryDir);
  const store = new MemoryStore(adapter);

  // Get engine and execute
  // NOTE: Prompt is already complete - no template loading or building here
  const engine = getEngine(engineType);

  let totalStdout = '';

  try {
    const result = await engine.run({
      prompt, // Already complete and ready to use
      workingDir,
      model,
      modelReasoningEffort,
      env: {
        ...process.env,
        // Pass parent agent ID to child processes (for orchestration context)
        ...(monitoringAgentId !== undefined && {
          CODEMACHINE_PARENT_AGENT_ID: monitoringAgentId.toString()
        })
      },
      onData: (chunk) => {
        totalStdout += chunk;

        // Dual-stream: write to log file AND original logger
        if (loggerService && monitoringAgentId !== undefined) {
          loggerService.write(monitoringAgentId, chunk);
        }

        if (logger) {
          logger(chunk);
        } else {
          try {
            process.stdout.write(chunk);
          } catch {
            // ignore streaming failures
          }
        }
      },
      onErrorData: (chunk) => {
        // Also log stderr to file
        if (loggerService && monitoringAgentId !== undefined) {
          loggerService.write(monitoringAgentId, `[STDERR] ${chunk}`);
        }

        if (stderrLogger) {
          stderrLogger(chunk);
        } else {
          try {
            process.stderr.write(chunk);
          } catch {
            // ignore streaming failures
          }
        }
      },
      onTelemetry: (telemetry) => {
        // Update telemetry in monitoring
        if (monitor && monitoringAgentId !== undefined) {
          monitor.updateTelemetry(monitoringAgentId, telemetry);
        }

        // Forward to caller's telemetry callback (for UI updates)
        if (onTelemetry) {
          onTelemetry(telemetry);
        }
      },
      abortSignal,
      timeout,
    });

    // Store output in memory
    const stdout = result.stdout || totalStdout;
    const slice = stdout.slice(-2000);
    await store.append({
      agentId,
      content: slice,
      timestamp: new Date().toISOString(),
    });

    // Mark agent as completed
    if (monitor && monitoringAgentId !== undefined) {
      monitor.complete(monitoringAgentId);
      // Note: Don't close stream here - workflow may write more messages
      // Streams will be closed by cleanup handlers or monitoring service shutdown
    }

    return {
      output: stdout,
      agentId: monitoringAgentId
    };
  } catch (error) {
    // Mark agent as failed
    if (monitor && monitoringAgentId !== undefined) {
      monitor.fail(monitoringAgentId, error as Error);
      // Note: Don't close stream here - workflow may write more messages
      // Streams will be closed by cleanup handlers or monitoring service shutdown
    }
    throw error;
  }
}
