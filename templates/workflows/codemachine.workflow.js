export default {
  name: 'CodeMachine Workflow',
  steps: [
    resolveStep('git-commit', { executeOnce: true }), // Commit the initial project specification to git
    resolveStep('arch-agent', { executeOnce: true, engine: 'claude' }), // Define system architecture and technical design decisions
    resolveStep('plan-agent', { executeOnce: true, engine: 'claude' }), // Generate comprehensive iterative development plan with architectural artifacts
    resolveStep('task-breakdown', { executeOnce: true, engine: 'claude' }), // Extract and structure tasks from project plan into JSON format
    resolveStep('git-commit', { executeOnce: true, engine: 'codex', model: 'gpt-5', modelReasoningEffort: 'low' }), // Commit the task breakdown to git
    resolveStep('code-generation'), // Generate code implementation based on task specifications and design artifacts
    resolveStep('runtime-prep', { executeOnce: true }), // Generate robust shell scripts for project automation (install, run, lint, test)
    resolveStep('task-sanity-check'), // Verify generated code against task requirements and acceptance criteria
    resolveStep('git-commit', { engine: 'codex', model: 'gpt-5', modelReasoningEffort: 'low' }), // Commit the generated and verified code
    resolveModule('check-task', { loopTrigger: 'TASKS_COMPLETED=FALSE', loopSteps: 4, loopMaxIterations: 20, loopSkip: ['runtime-prep'] }), // Loop back if tasks are not completed
  ],
  subAgentIds: [],
};
