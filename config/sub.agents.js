const path = require('node:path');

module.exports = [
  {
    id: 'uxui-designer',
    name: 'UX/UI Designer',
    description: 'Execute Codex for UX and UI design tasks',
    promptPath: path.join(__dirname, '..', 'prompts', 'ux-ui-designer.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'medium',
  },
  {
    id: 'frontend-dev',
    name: 'Frontend Developer',
    description: 'Execute Codex for frontend development tasks',
    promptPath: path.join(__dirname, '..', 'prompts', 'frontend-developer.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'medium',
  },
  {
    id: 'backend-dev',
    name: 'Backend Developer',
    description: 'Execute Codex for backend development tasks',
    promptPath: path.join(__dirname, '..', 'prompts', 'backend-developer.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'high',
  },
  {
    id: 'solution-architect',
    name: 'Solution Architect',
    description: 'Execute Codex for solution architecture tasks',
    promptPath: path.join(__dirname, '..', 'prompts', 'solution-architect.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'high',
  },
  {
    id: 'technical-writer',
    name: 'Technical Writer / Documentation Specialist',
    description: 'Execute Codex for documentation and writing tasks',
    promptPath: path.join(__dirname, '..', 'prompts', 'technical-writer.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'low',
  },
  {
    id: 'qa-engineer',
    name: 'QA/Test Engineer',
    description: 'Execute Codex for testing and QA tasks',
    promptPath: path.join(__dirname, '..', 'prompts', 'qa-test-engineer.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'medium',
  },
  {
    id: 'performance-engineer',
    name: 'Performance Engineer',
    description: 'Execute Codex for performance profiling and optimization tasks',
    promptPath: path.join(__dirname, '..', 'prompts', 'performance-engineer.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'high',
  },
  {
    id: 'software-architect',
    name: 'Software Architect',
    description:
      'Execute Codex for software architecture planning, directory structure design, and project organization tasks',
    promptPath: path.join(__dirname, '..', 'prompts', 'software-architect.md'),
    model: 'gpt-5-codex',
    modelReasoningEffort: 'medium',
  },
];
