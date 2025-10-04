/**
 * Configuration for prompt template placeholders
 *
 * Define placeholders that can be used in agent prompts.
 * Each placeholder key will be replaced with the content from the specified file path.
 *
 * Format:
 * {
 *   'placeholder_name': 'relative/path/from/project/root.md'
 * }
 *
 * Usage in prompts:
 * Use {placeholder_name} in your prompt markdown files, and it will be replaced
 * with the content of the file specified in this config.
 */

module.exports = {
  // Project specification document
  specifications: '.codemachine/inputs/specifications.md',
  architecture: '.codemachine/plan/architecture.md',
  plan: '.codemachine/plan/plan.md',
  tasks: '.codemachine/plan/tasks.json',
  // Add more placeholders as needed:
  // requirements: '.codemachine/inputs/requirements.md',
  // architecture: '.codemachine/inputs/architecture.md',
};
