import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mainAgents = require('../../config/main.agents.js');

function resolveStep(id) {
  const agent = mainAgents.find((entry) => entry?.id === id);
  if (!agent) {
    throw new Error(`Unknown main agent: ${id}`);
  }

  return {
    type: 'module',
    agentId: agent.id,
    agentName: agent.name,
    promptPath: agent.promptPath,
    model: agent.model,
    modelReasoningEffort: agent.modelReasoningEffort,
  };
}

const workflow = {
  name: 'Default Workflow',
  steps: [
    resolveStep('agents-builder'),
    resolveStep('tasks-generator'),
    resolveStep('project-manager'),
  ],
};

export default workflow;
