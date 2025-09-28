module.exports = [
  {
    id: 'uxui-designer',
    name: 'UX/UI Designer',
    description: 'Execute Codex for UX and UI design tasks',
    promptPath: require('path').join(__dirname, '..', 'prompts', 'ux-ui-designer.md')
  },
  {
    id: 'frontend-dev',
    name: 'Frontend Developer',
    description: 'Execute Codex for frontend development tasks',
    promptPath: require('path').join(__dirname, '..', 'prompts', 'frontend-developer.md')
  },
  {
    id: 'backend-dev',
    name: 'Backend Developer',
    description: 'Execute Codex for backend development tasks',
    promptPath: require('path').join(__dirname, '..', 'prompts', 'backend-developer.md')
  },
  {
    id: 'solution-architect',
    name: 'Solution Architect',
    description: 'Execute Codex for solution architecture tasks',
    promptPath: require('path').join(__dirname, '..', 'prompts', 'solution-architect.md')
  },
  {
    id: 'technical-writer',
    name: 'Technical Writer / Documentation Specialist',
    description: 'Execute Codex for documentation and writing tasks',
    promptPath: require('path').join(__dirname, '..', 'prompts', 'technical-writer.md')
  },
  {
    id: 'qa-engineer',
    name: 'QA/Test Engineer',
    description: 'Execute Codex for testing and QA tasks',
    promptPath: require('path').join(__dirname, '..', 'prompts', 'qa-test-engineer.md')
  },
  {
    id: 'performance-engineer',
    name: 'Performance Engineer',
    description: 'Execute Codex for performance profiling and optimization tasks',
    promptPath: require('path').join(__dirname, '..', 'prompts', 'performance-engineer.md')
  },
  {
    id: 'software-architect',
    name: 'Software Architect',
    description: 'Execute Codex for software architecture planning, directory structure design, and project organization tasks',
    promptPath: require('path').join(__dirname, '..', 'prompts', 'software-architect.md')
  }
];
