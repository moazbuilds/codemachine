const path = require('node:path');

const promptsDir = path.join(__dirname, '..', 'prompts');

module.exports = [
  {
    id: 'check-task',
    name: 'Check Task',
    description: 'Validates that all tasks are completed and signals whether to repeat workflow steps.',
    promptPath: path.join(promptsDir, 'templates', 'codemachine', 'workflows', 'task-verification-workflow.md'),
    behavior: {
      type: 'loop',
      action: 'stepBack',
    },
  },
];
