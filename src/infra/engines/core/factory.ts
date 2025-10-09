import type { Engine, EngineType, EngineRunOptions, EngineRunResult } from './types.js';
import type { EngineModule } from './base.js';
import { registry } from './registry.js';

/**
 * Dynamic engine wrapper - wraps any EngineModule to conform to Engine interface
 */
class DynamicEngine implements Engine {
  constructor(private engineModule: EngineModule) {}

  get type(): EngineType {
    return this.engineModule.metadata.id;
  }

  async run(options: EngineRunOptions): Promise<EngineRunResult> {
    return await this.engineModule.run(options);
  }
}

/**
 * Factory to create engine instances from registry
 */
export function createEngine(type: EngineType): Engine {
  const engineModule = registry.get(type);

  if (!engineModule) {
    const availableEngines = registry.getAllIds().join(', ');
    throw new Error(
      `Unknown engine type: ${type}. Available engines: ${availableEngines}`
    );
  }

  return new DynamicEngine(engineModule);
}

/**
 * Get engine by name with fallback to default
 */
export function getEngine(type?: EngineType | string): Engine {
  // If no type provided, use the default engine (first by order)
  if (!type) {
    const defaultEngine = registry.getDefault();
    if (!defaultEngine) {
      throw new Error('No engines registered');
    }
    return new DynamicEngine(defaultEngine);
  }

  return createEngine(type);
}
