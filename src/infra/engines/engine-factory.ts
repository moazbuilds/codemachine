import type { Engine, EngineType, EngineRunOptions, EngineRunResult } from './types.js';
import { runCodex } from './codex/index.js';
import { runClaude } from './claude/index.js';

class CodexEngine implements Engine {
  type: EngineType = 'codex';

  async run(options: EngineRunOptions): Promise<EngineRunResult> {
    return await runCodex(options);
  }
}

class ClaudeEngine implements Engine {
  type: EngineType = 'claude';

  async run(options: EngineRunOptions): Promise<EngineRunResult> {
    return await runClaude(options);
  }
}

/**
 * Factory to create engine instances
 */
export function createEngine(type: EngineType): Engine {
  switch (type) {
    case 'codex':
      return new CodexEngine();
    case 'claude':
      return new ClaudeEngine();
    default:
      throw new Error(`Unknown engine type: ${type}`);
  }
}

/**
 * Get engine by name with fallback to default
 */
export function getEngine(type?: EngineType | string): Engine {
  const engineType = (type as EngineType) || 'codex';
  return createEngine(engineType);
}
