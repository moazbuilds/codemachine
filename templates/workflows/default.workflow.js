// Default workflow template: ordered steps to run at `/start`.
// Each step is either a `prompt` (run a Codex agent with a prompt file)
// or a `module` (invoke built-in orchestrators).

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workflow = [
  {
    type: 'prompt',
    name: 'Master Mind PM Spec',
    // Use an existing architect-like profile to internalize the PM spec prompt
    agent: 'software-architect',
    // Prefer prompts folder; fallback path resolves relative to repo root
    promptPath: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'prompts', 'master-mind.md'),
  },
  {
    type: 'module',
    module: 'agents-builder',
  },
  {
    type: 'module',
    module: 'planning-workflow',
  },
  {
    type: 'module',
    module: 'project-manager',
  },
];

export default workflow;
