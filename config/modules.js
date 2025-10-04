const path = require('node:path');

const promptsDir = path.join(__dirname, '..', 'prompts', 'modules');

module.exports = [
  {
    id: 'check-task',
    name: 'Check Task',
    description: 'Validates that all tasks are completed and signals whether to repeat workflow steps.',
    promptPath: path.join(promptsDir, 'check-task.md'),
    model: 'gpt-5',
    modelReasoningEffort: 'low',
    behavior: {
      type: 'loop',
      action: 'stepBack',
    },
  },
];
