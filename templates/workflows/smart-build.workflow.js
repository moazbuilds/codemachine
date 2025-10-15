/**
 * Smart Development Workflow
 *
 * Orchestrated coding workflow using agents and project management
 */

export default {
  name: 'Smart Build',

  steps: [
    resolveStep('git-commit', { executeOnce: true, engine: 'claude' }), // Commit the initial project specification to git
    resolveStep('arch-agent', { executeOnce: true }), // Define system architecture and technical design decisions
    resolveStep('plan-agent', { executeOnce: true }), // Generate comprehensive iterative development plan with architectural artifacts
    resolveStep('task-breakdown', { executeOnce: true }), // Extract and structure tasks from project plan into JSON format
    resolveStep('git-commit', { executeOnce: true }), // Commit the task breakdown to git
    resolveStep('agents-builder', { executeOnce: true }), // Generate specialized agent prompts tailored to the current workspace context
    resolveStep('project-manager'), // Prioritizes and sequences tasks, delegating work to other agents as needed
    resolveStep('git-commit'), // Commit the project plan to git
    resolveModule('check-task', { loopSteps: 2, loopMaxIterations: 20 }),
  ],

  subAgentIds: [
    'uxui-designer',
    'frontend-dev',
    'backend-dev',
    'solution-architect',
    'technical-writer',
    'qa-engineer',
    'performance-engineer',
    'software-architect',
  ],
};
