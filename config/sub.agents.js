const path = require('node:path');

module.exports = [
  {
    id: 'uxui-designer',
    name: 'UX/UI Designer',
    description: 'Handle UX and UI design tasks',
    promptPath: path.join(__dirname, '..', 'prompts', 'ux-ui-designer.md'),
  },
  {
    id: 'frontend-dev',
    name: 'Frontend Developer',
    description: 'Handle frontend development tasks',
    promptPath: path.join(__dirname, '..', 'prompts', 'frontend-developer.md'),
  },
  {
    id: 'backend-dev',
    name: 'Backend Developer',
    description: 'Handle backend development tasks',
    promptPath: path.join(__dirname, '..', 'prompts', 'backend-developer.md'),
  },
  {
    id: 'solution-architect',
    name: 'Solution Architect',
    description: 'Handle solution architecture tasks',
    promptPath: path.join(__dirname, '..', 'prompts', 'solution-architect.md'),
  },
  {
    id: 'technical-writer',
    name: 'Technical Writer / Documentation Specialist',
    description: 'Handle documentation and writing tasks',
    promptPath: path.join(__dirname, '..', 'prompts', 'technical-writer.md'),
  },
  {
    id: 'qa-engineer',
    name: 'QA/Test Engineer',
    description: 'Handle testing and QA tasks',
    promptPath: path.join(__dirname, '..', 'prompts', 'qa-test-engineer.md'),
  },
  {
    id: 'performance-engineer',
    name: 'Performance Engineer',
    description: 'Handle performance profiling and optimization tasks',
    promptPath: path.join(__dirname, '..', 'prompts', 'performance-engineer.md'),
  },
  {
    id: 'software-architect',
    name: 'Software Architect',
    description:
      'Handle software architecture planning, directory structure design, and project organization tasks',
    promptPath: path.join(__dirname, '..', 'prompts', 'software-architect.md'),
  },
];
