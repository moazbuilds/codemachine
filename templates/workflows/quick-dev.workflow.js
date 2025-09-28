import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const promptsDir = path.resolve(dirname, '..', '..', 'prompts', 'agents');

const workflow = {
  name: 'Quick Development',
  steps: [
    {
      type: 'module',
      module: 'project-manager',
      agentId: 'master-mind',
      agentName: 'Project Manager',
      promptPath: path.join(promptsDir, 'master-mind.md'),
    },
  ],
};

export default workflow;