import { resolveStep, resolveFolder } from '../../src/core/workflows/workflow-utils.ts';

const workflow = {
  name: 'Spec Kit Workflow',
  steps: [
    ...resolveFolder('spec-kit'),  // This will expand to all ordered files in prompts/agents/spec-kit/
    resolveStep('project-manager'),
  ],
};

export default workflow;
