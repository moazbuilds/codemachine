export default {
  name: 'CodeMachine Workflow',
  steps: [
    resolveStep('init', { executeOnce: true, engine: 'codex', model: 'gpt-5', modelReasoningEffort: 'low' }), // Initialize development environment
    resolveStep('principal-analyst', { executeOnce: true, engine: 'codex', model: 'gpt-5-codex', modelReasoningEffort: 'high' }), // Review specifications and identify critical ambiguities
    resolveUI("❚❚ Human Review"),


  ],
  subAgentIds: ['founder-architect'],
};
