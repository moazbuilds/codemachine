import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mainAgents = require('../../config/main.agents.js');

function resolveStep(id, overrides = {}) {
  const agent = mainAgents.find((entry) => entry?.id === id);
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

const workflow = {
  name: 'Quick Development',
  steps: [
    resolveStep('tasks-generator'),
  ],
};

export default workflow;
