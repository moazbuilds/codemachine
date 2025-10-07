import type { StepOverrides, WorkflowStep } from '../types.js';
import { mainAgents } from '../config.js';

export function resolveStep(id: string, overrides: StepOverrides = {}): WorkflowStep {
  const agent = mainAgents.find((entry) => entry?.id === id);
  if (!agent) {
    throw new Error(`Unknown main agent: ${id}`);
  }

  const agentName = overrides.agentName ?? agent.name;
  const promptPath = overrides.promptPath ?? agent.promptPath;
  const model = overrides.model ?? agent.model;

  if (!agentName || !promptPath || !model) {
    throw new Error(`Agent ${id} is missing required fields (name, promptPath, or model)`);
  }

  return {
    type: 'module',
    agentId: agent.id,
    agentName,
    promptPath,
    model,
    modelReasoningEffort: overrides.modelReasoningEffort ?? agent.modelReasoningEffort,
    engine: overrides.engine ?? agent.engine, // Override from step or use agent config
    executeOnce: overrides.executeOnce,
  };
}
