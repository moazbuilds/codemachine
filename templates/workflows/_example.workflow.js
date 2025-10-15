/**
 * Example Workflow - All available features and overrides
 */

export default {
  name: 'Example Workflow',

  steps: [
    // ============================================
    // BASIC USAGE - Uses agent's default settings
    // ============================================
    resolveStep('arch-agent'),

    // ============================================
    // EXECUTE ONCE - Skips if already executed
    // ============================================
    resolveStep('plan-agent', {
      executeOnce: true, // Won't run again on /start if already executed
    }),

    // ============================================
    // ENGINE OVERRIDE - Force specific engine
    // ============================================
    resolveStep('git-commit', {
      engine: 'claude', // Override to use Claude (even if agent config says 'codex')
      executeOnce: true,
    }),

    // ============================================
    // MODEL OVERRIDE - Change AI model
    // ============================================
    resolveStep('code-generation', {
      model: 'gpt-5-codex', // Available: gpt-5-codex, gpt-5, gpt-4, etc.
    }),

    // ============================================
    // ENGINE + MODEL OVERRIDE
    // ============================================
    resolveStep('code-review', {
      engine: 'claude',  // Use Claude engine
      model: 'opus',     // With Opus model (maps to claude-opus)
    }),

    // ============================================
    // REASONING EFFORT OVERRIDE
    // ============================================
    resolveStep('complex-analysis', {
      modelReasoningEffort: 'high', // 'low' | 'medium' | 'high'
    }),

    // ============================================
    // CUSTOM AGENT NAME - Override display name
    // ============================================
    resolveStep('implementation-agent', {
      agentName: 'Senior Backend Developer', // Custom display name
    }),

    // ============================================
    // CUSTOM PROMPT PATH - Use different prompt
    // ============================================
    resolveStep('testing-agent', {
      promptPath: './prompts/custom/e2e-testing.txt', // Different prompt file
    }),

    // ============================================
    // COMPLETE OVERRIDE - All options combined
    // ============================================
    resolveStep('full-featured-agent', {
      engine: 'codex',                       // Use Codex
      model: 'gpt-5',                        // With GPT-5 model
      modelReasoningEffort: 'high',           // Maximum thinking
      agentName: 'AI Architect Pro',          // Custom name
      promptPath: './prompts/custom/arch.txt', // Custom prompt
      executeOnce: true,                      // Only run once
    }),

    // ============================================
    // MODULE WITH LOOP BEHAVIOR
    // ============================================
    resolveModule('check-task', {
      loopSteps: 3,                          // Go back 3 steps when looping
      loopMaxIterations: 20,                 // Max 20 loop iterations
      loopSkip: ['plan-agent'],              // Skip these steps in loop
      engine: 'claude',                      // Also supports engine override
    }),

    // ============================================
    // FOLDER RESOLUTION - Load multiple steps
    // ============================================
    // Loads all numbered files: 0-*.md, 1-*.md, etc.
    ...resolveFolder('codemachine'),

    // Folder with overrides (applies to ALL steps in folder)
    ...resolveFolder('spec-kit', {
      engine: 'codex',                       // All steps use Codex
      model: 'gpt-5',                        // All steps use gpt-5
      modelReasoningEffort: 'medium',        // All steps use medium reasoning
    }),

    // ============================================
    // ENGINE MIXING - Different engines per task
    // ============================================
    resolveStep('planning', { engine: 'codex' }),    // Planning with Codex
    resolveStep('implementation', { engine: 'codex' }), // Code with Codex
    resolveStep('review', { engine: 'claude' }),     // Review with Claude (better at analysis)
    resolveStep('documentation', { engine: 'claude' }), // Docs with Claude (better at writing)
    resolveStep('testing', { engine: 'codex' }),     // Tests with Codex
  ],

  // ============================================
  // SUB-AGENTS - Orchestrated by main workflow
  // ============================================
  // These are loaded from config/sub.agents.js
  // Each sub-agent can also have engine/model configured
  subAgentIds: [
    'frontend-dev',    // Can have engine: 'claude' in config
    'backend-dev',     // Can have engine: 'codex' in config
    'qa-engineer',     // Can have engine: 'claude' in config
    'technical-writer', // Can have engine: 'claude' in config
  ],
};
