import * as path from 'node:path';

import type { EngineType } from '../../infra/engines/types.js';
import { getEngine } from '../../infra/engines/engine-factory.js';
import { claude, codex } from '../../infra/engines/index.js';
import { MemoryAdapter } from '../../infra/fs/memory-adapter.js';
import { MemoryStore } from '../memory/memory-store.js';
import { loadAgentConfig } from './config.js';
import { buildCompositePrompt } from './prompt.js';

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
   * Engine profile to use (defaults to agentId)
   */
  profile?: string;

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
   * Abort signal
   */
  abortSignal?: AbortSignal;

  /**
   * Timeout in milliseconds
   */
  timeout?: number;
}

/**
 * Ensures the engine is authenticated
 */
async function ensureEngineAuth(engineType: EngineType, profile: string): Promise<void> {
  if (engineType === 'claude') {
    const isAuthed = await claude.isAuthenticated();
    if (!isAuthed) {
      console.error(`\nClaude authentication required`);
      console.error(`\nRun the following command to authenticate:\n`);
      console.error(`  CLAUDE_CONFIG_DIR=~/.codemachine/claude claude setup-token\n`);
      throw new Error('Claude authentication required');
    }
  } else if (engineType === 'codex') {
    await codex.ensureAuth();
  }
}

/**
 * Executes a sub-agent or CLI agent with the specified prompt
 *
 * This loads agent configuration from:
 * - config/sub.agents.js
 * - config/main.agents.js
 * - .codemachine/agents/agents-config.json
 *
 * Used by:
 * - CLI commands (`codemachine agent ...`)
 * - Sub-agent orchestration
 *
 * NOT used by:
 * - Workflow main agents (they use src/workflows/execution/step.ts)
 */
export async function executeAgent(
  agentId: string,
  prompt: string,
  options: ExecuteAgentOptions,
): Promise<string> {
  const { workingDir, projectRoot, engine: engineOverride, model: modelOverride, profile: profileOverride, logger, stderrLogger, abortSignal, timeout } = options;

  // Load agent config to determine engine and model
  const agentConfig = await loadAgentConfig(agentId, projectRoot ?? workingDir);
  const engineType: EngineType = engineOverride ?? agentConfig.engine ?? 'codex'; // Default to codex for backward compatibility
  const model = modelOverride ?? (agentConfig.model as string | undefined);
  const profile = profileOverride ?? agentId;

  // Ensure authentication
  await ensureEngineAuth(engineType, profile);

  // Set up memory
  const memoryDir = path.resolve(workingDir, '.codemachine', 'memory');
  const adapter = new MemoryAdapter(memoryDir);
  const store = new MemoryStore(adapter);

  // Build composite prompt with memory
  const compositePrompt = await buildCompositePrompt(agentId, prompt, store, projectRoot ?? workingDir);

  // Get engine and execute
  const engine = getEngine(engineType);

  let totalStdout = '';
  const result = await engine.run({
    profile,
    prompt: compositePrompt,
    workingDir,
    model,
    onData: (chunk) => {
      totalStdout += chunk;
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

  return stdout;
}
