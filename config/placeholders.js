const path = require('node:path');

module.exports = {
  // Paths relative to user's project directory
  userDir: {
    // Project specification document
    specifications: path.join('.codemachine', 'inputs', 'specifications.md'),
    architecture: path.join('.codemachine', 'artifacts', 'architecture', '*.md'),
    architecture_manifest_json: path.join('.codemachine', 'artifacts', 'architecture', 'architecture_manifest.json'),
    foundation: path.join('.codemachine', 'artifacts', 'architecture', '01_Blueprint_Foundation.md'),
    plan: path.join('.codemachine', 'artifacts', 'plan', '*.md'),
    plan_manifest_json: path.join('.codemachine', 'artifacts', 'plan', 'plan_manifest.json'),
    plan_fallback: path.join('.codemachine', 'prompts', 'plan_fallback.md'),
    tasks: path.join('.codemachine', 'artifacts', 'tasks.json'),
    all_tasks_json: path.join('.codemachine', 'artifacts', 'tasks', '*.json'),
    task_fallback: path.join('.codemachine', 'prompts', 'task_fallback.md'),
    context: path.join('.codemachine', 'prompts', 'context.md'),
    code_fallback: path.join('.codemachine', 'prompts', 'code_fallback.md'),
    // Add more placeholders as needed:
  },

  // Paths relative to codemachine package root
  packageDir: {
    orchestration_guide: path.join('prompts', 'orchestration', 'guide.md'),
    arch_output_format: path.join('prompts', 'templates', 'codemachine', 'output-formats', 'architecture-output.md'),
    plan_output_format: path.join('prompts', 'templates', 'codemachine', 'output-formats', 'planning-output.md'),
    task_output_format: path.join('prompts', 'templates', 'codemachine', 'output-formats', 'task-breakdown-output.md'),
    context_output_format: path.join('prompts', 'templates', 'codemachine', 'output-formats', 'context-output.md'),
    task_validation_output_format: path.join('prompts', 'templates', 'codemachine', 'output-formats', 'task-validation-output.md'),
    // dev.codemachine
    smart_anchor: path.join('prompts', 'templates', 'dev-codemachine', 'sub-agents', 'shared-instructions', 'smart-anchor.md'),
    command_constraints: path.join('prompts', 'templates', 'dev-codemachine', 'sub-agents', 'shared-instructions', 'command-constraints.md'),
    atomic_generation: path.join('prompts', 'templates', 'dev-codemachine', 'sub-agents', 'shared-instructions', 'atomic-generation.md'),
    // Add codemachine package-level placeholders here
  }
};
