import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const promptsDir = path.resolve(dirname, '..', '..', 'prompts', 'agents');

const workflow = {
  name: 'Default Workflow',
  steps: [
    {
      type: 'module',
      agentId: 'agents-builder',
      agentName: 'Agent Builder',
      promptPath: path.join(promptsDir, 'agents-builder.md'),
    },
    {
      type: 'module',
      agentId: 'master-mind',
      agentName: 'Planner',
      promptPath: path.join(promptsDir, 'master-mind.md'),
    },
    {
      type: 'module',
      agentId: 'master-mind',
      agentName: 'Project Manager',
      promptPath: path.join(promptsDir, 'master-mind.md'),
    },
  ],
};

export default workflow;
