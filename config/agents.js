const path = require('node:path');

module.exports = [
  {
    id: 'agents-builder',
    name: 'Agents Builder',
    description: 'Create and customize project-specific agent prompts and scaffolding.',
    promptPath: path.join(__dirname, '..', 'prompts', 'agents', 'agents-builder.md'),
  },
  {
    id: 'master-mind',
    name: 'Master Mind',
    description: 'Coordinate multi-agent execution and drive the project plan.',
    promptPath: path.join(__dirname, '..', 'prompts', 'agents', 'master-mind.md'),
  },
  {
    id: 'project-summarizer',
    name: 'Project Summarizer',
    description: 'Capture end-of-run status, risks, and recommended next steps.',
    promptPath: path.join(__dirname, '..', 'prompts', 'agents', 'project-summarizer.md'),
  },
];
