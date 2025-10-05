const path = require('node:path');

const promptsDir = path.join(__dirname, '..', 'prompts', 'templates');

module.exports = [
  // Smart Build agents
  {
    id: 'agents-builder',
    name: 'Agent Builder',
    description: 'Generates specialized agent prompts tailored to the current workspace context',
    promptPath: path.join(promptsDir, 'smart-build', '0- agents-builder.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'high',
  },
  {
    id: 'project-manager',
    name: 'Project Manager',
    description: 'Prioritizes and sequences tasks, delegating work to other agents as needed',
    promptPath: path.join(promptsDir, 'smart-build', '1- project-manager.md'),
    model: 'gpt-5',
    modelReasoningEffort: 'high',
  },
  // Codemachine agents
  {
    id: 'arch-agent',
    name: 'Architecture Agent',
    description: 'Defines system architecture and technical design decisions',
    promptPath: path.join(promptsDir, 'codemachine', '0- arch-agent.md'),
    model: 'gpt-5',
    modelReasoningEffort: 'high',
  },
  {
    id: 'plan-agent',
    name: 'Plan Agent',
    description: 'Analyzes requirements and generates comprehensive iterative development plans with architectural artifacts',
    promptPath: path.join(promptsDir, 'codemachine', '1- plan-agent.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'high',
  },
  {
    id: 'task-breakdown',
    name: 'Task Breakdown Agent',
    description: 'Extracts and structures tasks from project plans into JSON format',
    promptPath: path.join(promptsDir, 'codemachine', '2- task-breakdown.md'),
    model: 'gpt-5',
    modelReasoningEffort: 'medium',
  },
  {
    id: 'code-generation',
    name: 'Code Generation Agent',
    description: 'Generates code implementation based on task specifications and design artifacts',
    promptPath: path.join(promptsDir, 'codemachine', '3- code-generation.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'medium',
  },
  {
    id: 'task-sanity-check',
    name: 'Task Verification Agent',
    description: 'Verifies generated code against task requirements and acceptance criteria',
    promptPath: path.join(promptsDir, 'codemachine', '4- task-sanity-check.md'),
    model: 'gpt-5',
    modelReasoningEffort: 'medium',
  },
  {
    id: 'runtime-prep',
    name: 'Runtime Preparation Agent',
    description: 'Generates robust shell scripts for project automation (install, run, lint, test)',
    promptPath: path.join(promptsDir, 'codemachine', '5- runtime-perp.md'),
    model: 'gpt-5',
    modelReasoningEffort: 'low',
  },
  {
    id: 'git-commit',
    name: 'Git Commit Agent',
    description: 'Handles git commit operations and commit message generation',
    promptPath: path.join(promptsDir, 'codemachine', 'git-commit.md'),
    model: 'gpt-5',
    modelReasoningEffort: 'low',
  },

  // Folder configurations - applies settings to all agents in the folder
  {
    type: 'folder',
    id: 'codemachine',
    name: 'Codemachine',
    description: 'Core codemachine workflow agents',
    folderPath: path.join(promptsDir, 'codemachine'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'high',
  },
];
