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
      model: 'gpt-5-codex',
      modelReasoningEffort: 'high',
    },
    {
      type: 'module',
      agentId: 'tasks-generator',
      agentName: 'Tasks Generator',
      promptPath: path.join(promptsDir, 'tasks-generator.md'),
      model: 'gpt-5-codex',
      modelReasoningEffort: 'high',
    },
    {
      type: 'module',
      agentId: 'project-manager',
      agentName: 'Project Manager',
      promptPath: path.join(promptsDir, 'project-manager.md'),
      model: 'gpt-5-codex',
      modelReasoningEffort: 'high',
    },
  ],
};

export default workflow;
