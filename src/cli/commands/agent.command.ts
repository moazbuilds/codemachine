import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import type { Command } from 'commander';

import { runCodex } from '../../infra/engines/codex/index.js';
import { MemoryAdapter } from '../../infra/fs/memory-adapter.js';
import { MemoryStore } from '../../agents/memory/memory-store.js';
import { resolveAgentsModulePath } from '../../shared/agents/paths.js';

type AgentCommandOptions = {
  profile?: string;
};

type AgentConfig = {
  id: string;
  name: string;
  description?: string;
  promptPath: string;
};

async function loadAgentTemplate(agentId: string): Promise<string> {
  const lookupBase = process.env.CODEMACHINE_CWD || process.cwd();
  const agentsPath = resolveAgentsModulePath({ projectRoot: lookupBase });

  if (!agentsPath) {
    throw new Error('Unable to locate agents configuration. Expected config/sub.agents.js, config/main.agents.js, or .codemachine/agents/agents-config.json in the project root.');
  }

  const require = createRequire(import.meta.url);
  try {
    delete require.cache[require.resolve(agentsPath)];
  } catch {
    // ignore cache miss
  }

  const agents = require(agentsPath) as AgentConfig[];
  const config = agents.find((a) => a.id === agentId);
  if (!config) {
    throw new Error(`Unknown agent id: ${agentId}`);
  }

  const promptBase = path.dirname(agentsPath);
  const promptPath = path.isAbsolute(config.promptPath) ? config.promptPath : path.resolve(promptBase, config.promptPath);
  const content = await fs.readFile(promptPath, 'utf-8');
  return content;
}

async function buildCompositePrompt(agentId: string, request: string, store: MemoryStore): Promise<string> {
  const template = await loadAgentTemplate(agentId);
  const entries = await store.list(agentId);
  const memoryText = entries.map((e) => e.content).join('\n');
  const composite = `[SYSTEM]\n${template}\n\n[MEMORY]\n${memoryText}\n\n[REQUEST]\n${request}`;
  return composite;
}

export function registerAgentCommand(program: Command): void {
  program
    .command('agent')
    .description('Execute Codex with an agent wrapper')
    .argument('<id>', 'Agent id from config/sub.agents.js or config/main.agents.js')
    .argument('<prompt...>', 'User request to send to the agent')
    .option('--profile <profile>', 'Codex profile to use (defaults to the agent id)')
    .action(async (id: string, promptParts: string[], options: AgentCommandOptions) => {
      const profile = options.profile ?? id;
      const prompt = promptParts.join(' ').trim();
      if (!prompt) {
        throw new Error('Prompt is required');
      }

      const workingDir = process.cwd();

      const memoryDir = path.resolve(workingDir, '.codemachine', 'memory');
      const adapter = new MemoryAdapter(memoryDir);
      const store = new MemoryStore(adapter);

      const compositePrompt = await buildCompositePrompt(id, prompt, store);

      let totalStdout = '';
      const result = await runCodex({
        profile,
        prompt: compositePrompt,
        workingDir,
        onData: (chunk) => {
          totalStdout += chunk;
          try {
            process.stdout.write(chunk);
          } catch {
            // ignore streaming failures in minimal wrapper
          }
        },
      });

      const stdout = result.stdout || totalStdout;
      const slice = stdout.slice(-2000);
      await store.append({
        agentId: id,
        content: slice,
        timestamp: new Date().toISOString(),
      });
    });
}
