export default {
  name: 'Simple Workflow',
  steps: [
    // resolveStep('test-agent', { agentName: 'Test Agent' }),
    // resolveStep('arch-agent'), // Define system architecture and technical design decisions
    // resolveStep('plan-agent'), // Generate comprehensive iterative development plan with architectural artifacts
    // resolveStep('task-breakdown'), // Extract and structure tasks from project plan into JSON format
    resolveStep('code-generation'), // Generate code implementation based on task specifications and design artifacts
    
    // resolveStep('git-commit'), // Commit the automation scripts
    // resolveModule('check-task', { agentName: 'Tasks Complete Checker', loopTrigger: 'TASKS_COMPLETED=FALSE', loopSteps: 5, loopMaxIterations: 5, loopSkip: ['git-commit'] }), // Loop back if tasks are not completed

  ],
  subAgentIds: [],
};
