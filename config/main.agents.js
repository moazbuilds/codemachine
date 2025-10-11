const path = require('node:path');

const promptsDir = path.join(__dirname, '..', 'prompts', 'templates');

module.exports = [
  // Smart Build agents
  {
    id: 'agents-builder',
    name: 'Agent Builder',
    description: 'Generates specialized agent prompts tailored to the current workspace context',
    promptPath: path.join(promptsDir, 'smart-build', '0- agents-builder.md'),
  },
  {
    id: 'project-manager',
    name: 'Project Manager',
    description: 'Prioritizes and sequences tasks, delegating work to other agents as needed',
    promptPath: path.join(promptsDir, 'smart-build', '1- project-manager.md'),
  },
  // Codemachine agents
  {
    id: 'arch-agent',
    name: 'Architecture Agent',
    description: 'Defines system architecture and technical design decisions',
    promptPath: path.join(promptsDir, 'codemachine', 'agents', '01-architecture-agent.md'),
  },
  {
    id: 'plan-agent',
    name: 'Plan Agent',
    description: 'Analyzes requirements and generates comprehensive iterative development plans with architectural artifacts',
    promptPath: path.join(promptsDir, 'codemachine', 'agents', '02-planning-agent.md'),
  },
  {
    id: 'task-breakdown',
    name: 'Task Breakdown Agent',
    description: 'Extracts and structures tasks from project plans into JSON format',
    promptPath: path.join(promptsDir, 'codemachine', 'agents', '03-task-breakdown-agent.md'),
  },
  {
    id: 'context-manager',
    name: 'Context Manager Agent',
    description: 'Gathers and prepares relevant context from architecture, plan, and codebase for task execution',
    promptPath: path.join(promptsDir, 'codemachine', 'agents', '04-context-manager-agent.md'),
  },
  {
    id: 'code-generation',
    name: 'Code Generation Agent',
    description: 'Generates code implementation based on task specifications and design artifacts',
    promptPath: path.join(promptsDir, 'codemachine', 'agents', '05-code-generation-agent.md'),
  },
  {
    id: 'task-sanity-check',
    name: 'Task Verification Agent',
    description: 'Verifies generated code against task requirements and acceptance criteria',
    promptPath: path.join(promptsDir, 'codemachine', 'agents', '06-task-validation-agent.md'),
  },
  {
    id: 'runtime-prep',
    name: 'Runtime Preparation Agent',
    description: 'Generates robust shell scripts for project automation (install, run, lint, test)',
    promptPath: path.join(promptsDir, 'codemachine', 'agents', '07-runtime-preparation-agent.md'),
  },
  {
    id: 'git-commit',
    name: 'Git Commit Agent',
    description: 'Handles git commit operations and commit message generation',
    promptPath: path.join(promptsDir, 'codemachine', 'workflows', 'git-commit-workflow.md'),
  },
  {
    id: 'plan-fallback',
    name: 'Plan Fallback Agent',
    description: 'Fixes and validates plan generation issues when plan-agent fails',
    promptPath: path.join(promptsDir, 'codemachine', 'fallback-agents', 'planning-fallback.md'),
  },
  {
    id: 'task-fallback',
    name: 'Task Fallback Agent',
    description: 'Fixes and validates task breakdown issues when task-breakdown fails',
    promptPath: path.join(promptsDir, 'codemachine', 'fallback-agents', 'task-breakdown-fallback.md'),
  },

  // Folder configurations - applies settings to all agents in the folder
  {
    type: 'folder',
    id: 'codemachine',
    name: 'Codemachine',
    description: 'Core codemachine workflow agents',
    folderPath: path.join(promptsDir, 'codemachine'),
  },
  {
    type: 'folder',
    id: 'spec-kit',
    name: 'Spec Kit',
    description: 'Specification and planning agents for project setup',
    folderPath: path.join(promptsDir, 'spec-kit'),
  },
];
