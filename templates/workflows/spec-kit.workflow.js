export default {
  name: 'Spec Kit Workflow',
  steps: [
    ...resolveFolder('spec-kit'),  // This will expand to all ordered files in prompts/agents/spec-kit/
    resolveStep('project-manager'),
  ],
  subAgentIds: [
    'solution-architect',
    'technical-writer',
    'software-architect',
    'uxui-designer',
  ],
};
