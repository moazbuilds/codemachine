export default {
  name: 'Simple Workflow',
  steps: [
    resolveStep('test-agent', { agentName: 'Test Agent' }),
    resolveModules('check-task', { agentName: 'Tasks Complete Checker', loopTrigger: 'TASKS_COMPLETED=FALSE' }),
  ],
};
