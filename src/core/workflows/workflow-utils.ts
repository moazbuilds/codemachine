import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mainAgents = require('../../../config/main.agents.js');

interface StepOverrides {
  agentName?: string;
  promptPath?: string;
  model?: string;
  modelReasoningEffort?: string;
}

interface WorkflowStep {
  type: string;
  agentId: string;
  agentName: string;
  promptPath: string;
  model: string;
  modelReasoningEffort?: string;
}

export function resolveStep(id: string, overrides: StepOverrides = {}): WorkflowStep {
  const agent = mainAgents.find((entry: any) => entry?.id === id);
  if (!agent) {
    throw new Error(`Unknown main agent: ${id}`);
  }

  return {
    type: 'module',
    agentId: agent.id,
    agentName: overrides.agentName ?? agent.name,
    promptPath: overrides.promptPath ?? agent.promptPath,
    model: overrides.model ?? agent.model,
    modelReasoningEffort: overrides.modelReasoningEffort ?? agent.modelReasoningEffort,
  };
}
