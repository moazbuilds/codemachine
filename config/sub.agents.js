module.exports = [
  {
    id: 'uxui-designer',
    name: 'UX/UI Designer',
    description: 'Handle UX and UI design tasks',
  },
  {
    id: 'frontend-dev',
    name: 'Frontend Developer',
    description: 'Handle frontend development tasks',
  },
  {
    id: 'backend-dev',
    name: 'Backend Developer',
    description: 'Handle backend development tasks',
  },
  {
    id: 'solution-architect',
    name: 'Solution Architect',
    description: 'Handle solution architecture tasks',
  },
  {
    id: 'technical-writer',
    name: 'Technical Writer / Documentation Specialist',
    description: 'Handle documentation and writing tasks',
  },
  {
    id: 'qa-engineer',
    name: 'QA/Test Engineer',
    description: 'Handle testing and QA tasks',
  },
  {
    id: 'performance-engineer',
    name: 'Performance Engineer',
    description: 'Handle performance profiling and optimization tasks',
  },
  {
    id: 'software-architect',
    name: 'Software Architect',
    description: 'Handle software architecture planning, directory structure design, and project organization tasks',
  },
  {
    id: 'system-analyst',
    name: 'System Analyst',
    description: 'Handle system analysis and requirements gathering tasks',
  },

  // dev-codemachine sub-agents
  {
    id: 'founder-architect',
    name: 'Founder Architect',
    description: 'Handle foundational architecture tasks',
    mirrorPath: 'prompts/templates/dev-codemachine/sub-agents/architecture/01-founder-architect.md',
  },
  {
    id: 'structural-data-architect',
    name: 'Structural & Data Architect',
    description: 'Define the static structure of the system, components hierarchy, and data organization',
    mirrorPath: 'prompts/templates/dev-codemachine/sub-agents/architecture/02-structural-data-architect.md',
  },
  {
    id: 'behavior-architect',
    name: 'Behavior & Communication Architect',
    description: 'Define dynamic interactions, data flows, and communication patterns between components',
    mirrorPath: 'prompts/templates/dev-codemachine/sub-agents/architecture/03-behavior-architect.md',
  },
  {
    id: 'ui-ux-architect',
    name: 'UI/UX & Interface Architect',
    description: 'Define user interface architecture, design systems, component hierarchies, and user experience patterns',
    mirrorPath: 'prompts/templates/dev-codemachine/sub-agents/architecture/05-ui-ux-architect.md',
  },
  {
    id: 'operational-architect',
    name: 'Operational & Documentation Architect',
    description: 'Handle deployment, operations, security, and documentation architecture',
    mirrorPath: 'prompts/templates/dev-codemachine/sub-agents/architecture/04-operational-architect.md',
  },
  {
    id: 'file-assembler',
    name: 'File Assembler',
    description: 'Execute commands and create manifest files from architecture outputs',
    mirrorPath: 'prompts/templates/dev-codemachine/sub-agents/architecture/06-file-assembler.md',
  }
];
