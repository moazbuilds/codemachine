import { resolveStep } from '../../src/core/workflows/workflow-utils.js';

const workflow = {
  name: 'Default Workflow',
  steps: [
    resolveStep('agents-builder'),
    resolveStep('tasks-generator'),
    resolveStep('project-manager'),
  ],
};

export default workflow;
