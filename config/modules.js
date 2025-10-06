const path = require('node:path');

const promptsDir = path.join(__dirname, '..', 'prompts');

module.exports = [
  {
    id: 'check-task',
    name: 'Check Task',
    description: 'Validates that all tasks are completed and signals whether to repeat workflow steps.',
    promptPath: path.join(promptsDir, 'templates', 'codemachine', 'tasks-checker.md'),
    model: 'gpt-5',
    modelReasoningEffort: 'low',
    behavior: {
      type: 'loop',
      action: 'stepBack',
    },
  },
];
