import { resolveStep } from '../../src/core/workflows/workflow-utils.js';

const workflow = {
  name: 'Quick Development',
  steps: [
    resolveStep('tasks-generator'),
  ],
};

export default workflow;
