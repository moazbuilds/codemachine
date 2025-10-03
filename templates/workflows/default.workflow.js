export default {
  name: 'Default Workflow',
  steps: [
    resolveStep('agents-builder'),
    resolveStep('tasks-generator'),
    resolveStep('project-manager'),
  ],
};
