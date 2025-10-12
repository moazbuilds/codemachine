export default {
  name: 'CodeMachine Workflow',
  steps: [
    resolveStep('git-commit', { executeOnce: true }), // Commit the initial project specification to git
    resolveStep('arch-agent', { executeOnce: true, engine: 'claude' }), // Define system architecture and technical design decisions
    resolveStep('plan-agent', { executeOnce: true, engine: 'claude', notCompletedFallback: 'plan-fallback' }), // Generate comprehensive iterative development plan with architectural artifacts
    resolveStep('task-breakdown', { executeOnce: true, engine: 'claude', notCompletedFallback: 'task-fallback' }), // Extract and structure tasks from project plan into JSON format
    resolveStep('git-commit', { executeOnce: true, engine: 'codex', model: 'gpt-5', modelReasoningEffort: 'low' }), // Commit the task breakdown to git
    resolveStep('context-manager', { engine: 'codex' , model: 'gpt-5', modelReasoningEffort: 'medium' }), // Gather and prepare relevant context from architecture, plan, and codebase for task execution
    resolveStep('code-generation', { engine: 'codex' , model: 'gpt-5', modelReasoningEffort: 'medium' }), // Generate code implementation based on task specifications and design artifacts
    resolveStep('cleanup-code-fallback', { engine: 'codex', model: 'gpt-5', modelReasoningEffort: 'low' }), // Simple cleanup task: delete .codemachine/prompts/code_fallback.md if present
    resolveStep('runtime-prep', { executeOnce: true }), // Generate robust shell scripts for project automation (install, run, lint, test)
    resolveStep('task-sanity-check', { engine: 'codex' , model: 'gpt-5', modelReasoningEffort: 'medium' }), // Verify generated code against task requirements and acceptance criteria
    resolveStep('git-commit', { engine: 'codex', model: 'gpt-5', modelReasoningEffort: 'low' }), // Commit the generated and verified code
    resolveModule('check-task', { loopSteps: 6, loopMaxIterations: 20, loopSkip: ['runtime-prep'] }), // Loop back if tasks are not completed
  ],
  subAgentIds: [],
};
