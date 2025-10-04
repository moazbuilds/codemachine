export default {
  name: 'CodeMachine Workflow',
  steps: [
    resolveStep('arch-agent'), // Define system architecture and technical design decisions
    resolveStep('plan-agent'), // Generate comprehensive iterative development plan with architectural artifacts
    resolveStep('git-commit'), // Commit the plan to git
    resolveStep('task-breakdown'), // Extract and structure tasks from project plan into JSON format
    resolveStep('git-commit'), // Commit the task breakdown to git
    resolveStep('code-generation'), // Generate code implementation based on task specifications and design artifacts
    resolveStep('runtime-prep'), // Generate robust shell scripts for project automation (install, run, lint, test)
    resolveStep('task-sanity-check'), // Verify generated code against task requirements and acceptance criteria
    resolveStep('git-commit'), // Commit the generated and verified code
    resolveStep('task-complete'), // Check if all tasks are completed
    resolveModules('check-task', { agentName: 'Tasks Complete Checker', loopTrigger: 'TASKS_COMPLETED=FALSE', loopSteps: 5, loopMaxIterations: 5, loopSkip: ['runtime-prep'] }), // Loop back if tasks are not completed
    resolveStep('git-commit'), // Commit the automation scripts
  ],
  subAgentIds: [],
};
