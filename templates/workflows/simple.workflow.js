import { resolveStep } from '../../src/core/workflows/workflow-utils.ts';

const workflow = {
  name: 'Simple Workflow',
  steps: [
    resolveStep('project-manager', { agentName: 'Project Manager' }),
  ],
};

export default workflow;
