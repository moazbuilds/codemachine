export default {
  name: 'Default Workflow',
  steps: [
    resolveStep('agents-builder'),
    resolveStep('tasks-generator'),
    resolveStep('project-manager'),
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
