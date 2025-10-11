
module.exports = {
  // Paths relative to user's project directory
  userDir: {
    // Project specification document
    specifications: '.codemachine/inputs/specifications.md',
    architecture: '.codemachine/artifacts/architecture/*.md',
    architecture_manifest_json: '.codemachine/artifacts/architecture/architecture_manifest.json',
    plan: '.codemachine/artifacts/plan/*.md',
    plan_manifest_json: '.codemachine/artifacts/plan/plan_manifest.json',
    plan_fallback: '.codemachine/prompts/plan_fallback.md',
    tasks: '.codemachine/artifacts/tasks.json',
    all_tasks_json: '.codemachine/artifacts/tasks/*.json',
    task_fallback: '.codemachine/prompts/task_fallback.md',
    // Add more placeholders as needed:
  },

  // Paths relative to codemachine package root
  packageDir: {
    orchestration_guide: 'prompts/orchestration/guide.md',
    arch_output_format: 'prompts/templates/codemachine/output-formats/architecture-output.md',
    plan_output_format: 'prompts/templates/codemachine/output-formats/planning-output.md',
    task_output_format: 'prompts/templates/codemachine/output-formats/task-breakdown-output.md',
    context_output_format: 'prompts/templates/codemachine/output-formats/context-output.md',
    // Add codemachine package-level placeholders here
  }
};
