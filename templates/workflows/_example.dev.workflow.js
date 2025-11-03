export default {
  name: 'CodeMachine Workflow',
  steps: [
    resolveStep('init', { executeOnce: true, engine: 'codex', model: 'gpt-5', modelReasoningEffort: 'low' }), // Initialize development environment
    resolveStep('principal-analyst', { executeOnce: true }), // Review specifications and identify critical ambiguities
    resolveUI("❚❚ Human Review"),
    resolveStep('specifications-indexer', { executeOnce: true }), // Index and structure project specifications
    resolveStep('blueprint-orchestrator', { executeOnce: true }), // Orchestrate architecture blueprint generation
  ],
  subAgentIds: [
    // architecture sub-agents
    'founder-architect',
    'structural-data-architect',
    'behavior-architect',
    'operational-architect',
    'file-assembler'
  ],
};
