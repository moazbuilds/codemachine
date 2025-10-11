
module.exports = {
  // Paths relative to user's project directory
  userDir: {
    // Project specification document
    specifications: '.codemachine/inputs/specifications.md',
    architecture: '.codemachine/artifacts/architecture/*.md',
    plan: '.codemachine/artifacts/plan.md',
    tasks: '.codemachine/artifacts/tasks.json',
    // Add more placeholders as needed:
  },

  // Paths relative to codemachine package root
  packageDir: {
    orchestration_guide: 'prompts/orchestration/guide.md',
    arch_output_format: 'prompts/templates/codemachine/output_format/arch_output.md',
    plan_output_format: 'prompts/templates/codemachine/output_format/plan_output.md',
    plan_exec_strategy: 'prompts/templates/codemachine/helpers/plan_exec_strategy.md',
    // Add codemachine package-level placeholders here
  }
};
