import { resolveModule, resolveStep } from '../../src/core/workflows/workflow-utils.ts';

const workflow = {
  name: 'Simple Workflow',
  steps: [
    resolveStep('test-agent', { agentName: 'Test Agent' }),
    resolveModule('check-task', { agentName: 'Tasks Complete Checker', loopTrigger: 'TASKS_COMPLETED=FALSE',}),
  ],
};

export default workflow;
