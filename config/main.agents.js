const path = require('node:path');

const promptsDir = path.join(__dirname, '..', 'prompts', 'agents');

module.exports = [
  {
    id: 'agents-builder',
    name: 'Agent Builder',
    description: 'Generates specialized agent prompts tailored to the current workspace context',
    promptPath: path.join(promptsDir, 'agents-builder.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'high',
  },
  {
    id: 'tasks-generator',
    name: 'Tasks Generator',
    description: 'Breaks project requirements into actionable tasks with acceptance criteria',
    promptPath: path.join(promptsDir, 'tasks-generator.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'high',
  },
  {
    id: 'project-manager',
    name: 'Project Manager',
    description: 'Prioritizes and sequences tasks, delegating work to other agents as needed',
    promptPath: path.join(promptsDir, 'project-manager.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'high',
  },
  {
    id: 'master-mind',
    name: 'Master Mind',
    description: 'Coordinates multi-agent workflows and tracks overall project progress',
    promptPath: path.join(promptsDir, 'master-mind.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'medium',
  },
];
