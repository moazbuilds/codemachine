export default {
  name: 'Simple Workflow',
  steps: [
    resolveStep('test-agent', { agentName: 'Test Agent' }),
    resolveStep('git-commit'), // Commit the automation scripts
    resolveModules('check-task', { agentName: 'Tasks Complete Checker', loopTrigger: 'TASKS_COMPLETED=FALSE', loopSteps: 5, loopMaxIterations: 5, loopSkip: ['git-commit'] }), // Loop back if tasks are not completed

  ],
  subAgentIds: [
    'frontend-dev',
    'backend-dev',
  ],
};
