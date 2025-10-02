import { resolveStep } from '../../src/core/workflows/workflow-utils.ts';

const workflow = {
  name: 'Quick Development',
  steps: [
    resolveStep('tasks-generator'),
  ],
};

export default workflow;
