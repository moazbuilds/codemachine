const path = require('node:path');

const promptsDir = path.join(__dirname, '..', 'prompts');

module.exports = [
  {
    id: 'check-task',
    name: 'Task Completion Checker',
    description: 'Validates that all tasks are completed and signals whether to repeat workflow steps.',
    promptPath: path.join(promptsDir, 'templates', 'codemachine', 'workflows', 'task-verification-workflow.md'),
    behavior: {
      type: 'loop',
      action: 'stepBack',
    },
  },
  {
    id: 'iteration-checker',
    name: 'Iteration Checker',
    description: 'Checks if additional iterations are needed and can trigger other agents dynamically.',
    promptPath: path.join(promptsDir, 'templates', 'codemachine', 'workflows', 'iteration-verification-workflow.md'),
    behavior: {
      type: 'trigger',
      action: 'mainAgentCall',
      triggerAgentId: 'git-commit', // Default agent to trigger, can be overridden by behavior.json
    },
  },
  {
    id: 'auto-loop',
    name: 'Auto Loop',
    description: 'Simple auto loop module for testing - always signals to continue looping.',
    promptPath: path.join(promptsDir, 'templates', 'test-workflows', 'auto-loop.md'),
    behavior: {
      type: 'loop',
      action: 'stepBack',
    },
  },
];
