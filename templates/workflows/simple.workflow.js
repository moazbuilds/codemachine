import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const promptsDir = path.resolve(dirname, '..', '..', 'prompts', 'agents');

const workflow = {
  name: 'Simple Workflow',
  steps: [
    {
      type: 'module',
      module: 'planning-workflow',
      agentId: 'master-mind',
      agentName: 'Planner',
      promptPath: path.join(promptsDir, 'master-mind.md'),
    },
  ],
};

export default workflow;