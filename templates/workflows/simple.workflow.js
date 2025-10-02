import { resolveStep } from '../../src/core/workflows/workflow-utils.js';

const workflow = {
  name: 'Simple Workflow',
  steps: [
    resolveStep('project-manager', { agentName: 'Project Manager' }),
  ],
};

export default workflow;
