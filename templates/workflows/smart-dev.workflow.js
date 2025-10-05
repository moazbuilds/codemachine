/**
 * Smart Development Workflow
 *
 * Orchestrated coding workflow using agents and project management
 */

export default {
  name: 'Smart Development',

  steps: [
    resolveStep('agents-builder', { executeOnce: true }),
    resolveStep('tasks-generator', { executeOnce: true }),
    resolveStep('project-manager'),
    resolveModule('check-task', { loopTrigger: 'TASKS_COMPLETED=FALSE', loopSteps: 1, loopMaxIterations: 20, }),
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
