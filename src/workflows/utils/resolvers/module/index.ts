import type { ModuleOverrides, WorkflowStep } from '../../types.js';
import { moduleCatalog } from '../../config/loaders.js';
import { resolveLoopBehavior } from './behaviors/loop.js';

export function resolveModule(id: string, overrides: ModuleOverrides = {}): WorkflowStep {
  const moduleEntry = moduleCatalog.find((entry) => entry?.id === id);

  if (!moduleEntry) {
    throw new Error(`Unknown workflow module: ${id}`);
  }

  const agentName = overrides.agentName ?? moduleEntry.name ?? moduleEntry.id;
  const promptPath = overrides.promptPath ?? moduleEntry.promptPath;
  const model = overrides.model ?? moduleEntry.model;
  const modelReasoningEffort = overrides.modelReasoningEffort ?? moduleEntry.modelReasoningEffort;

  if (typeof promptPath !== 'string' || !promptPath.trim()) {
    throw new Error(`Module ${id} is missing a promptPath configuration.`);
  }

  if (typeof model !== 'string' || !model.trim()) {
    throw new Error(`Module ${id} is missing a model configuration.`);
  }

  const behavior = resolveLoopBehavior(moduleEntry.behavior, overrides);

  return {
    type: 'module',
    agentId: moduleEntry.id,
    agentName,
    promptPath,
    model,
    modelReasoningEffort,
    module: {
      id: moduleEntry.id,
      behavior,
    },
  };
}
