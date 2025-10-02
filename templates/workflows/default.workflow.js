import { resolveStep } from '../../src/core/workflows/workflow-utils.ts';

const workflow = {
  name: 'Default Workflow',
  steps: [
    resolveStep('agents-builder'),
    resolveStep('tasks-generator'),
    resolveStep('project-manager'),
  ],
};

export default workflow;
