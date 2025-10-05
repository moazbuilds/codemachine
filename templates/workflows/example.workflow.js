/**
 * Example Workflow - All available features
 */

export default {
  name: 'Example Workflow',

  steps: [
    // resolveStep() - Load agent from config/main.agents.js
    resolveStep('arch-agent'),

    // With executeOnce: skips this step when running /start again if already executed before (e.g., don't re-plan if plan exists)
    resolveStep('plan-agent', { executeOnce: true }), 

    // With overrides: custom model, reasoning, or name
    resolveStep('code-generation', {
      model: 'gpt-5-codex', // Available models: gpt-5-codex, gpt-5
      modelReasoningEffort: 'high', // 'low' | 'medium' | 'high'
      agentName: 'Custom Name',
    }),

    // resolveModule() - Load module from config/modules.js with loop behavior
    resolveModule('check-task', {
      loopTrigger: 'TASKS_COMPLETED=FALSE', // Loop starts when agent outputs this text (see prompts/modules/check-task.md)
      loopSteps: 3, // How many steps to go back when looping
      loopMaxIterations: 20, // Maximum iterations to run the loop
      loopSkip: ['plan-agent'], // Skip plan-agent in loop iterations
    }),

    // resolveFolder() - Load all numbered files from prompts/templates/<folder>/
    // Files: 0-file.md, 1-file.md, etc.
    ...resolveFolder('codemachine'),

    // With overrides (applies to all steps in folder)
    ...resolveFolder('spec-kit', {
      model: 'gpt-5',
      modelReasoningEffort: 'medium',
    }),
  ],

  // Sub-agents - loaded from config/sub.agents.js
  subAgentIds: [
    'frontend-dev',
    'backend-dev',
    'qa-engineer',
    'technical-writer',
    // Add more sub-agents as needed
    // this used to ochestirate the sub-agents (see prompts/orchestration/guide.md)
  ],
};
