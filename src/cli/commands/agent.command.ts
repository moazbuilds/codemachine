import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import type { Command } from 'commander';

import { runCodex } from '../../infra/codex/codex-runner.js';
import { MemoryAdapter } from '../../infra/fs/memory-adapter.js';
import { MemoryStore } from '../../agents/memory/memory-store.js';

type AgentCommandOptions = {
  profile?: string;
};

type AgentConfig = {
  id: string;
  name: string;
  description?: string;
  promptPath: string;
};

const DEFAULT_PROFILE = 'default';

async function loadAgentTemplate(agentId: string): Promise<string> {
  const require = createRequire(import.meta.url);
  const agentsPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../inputs/agents.js');
  const agents = require(agentsPath) as AgentConfig[];
  const config = agents.find((a) => a.id === agentId);
  if (!config) {
    throw new Error(`Unknown agent id: ${agentId}`);
  }
  const content = await fs.readFile(config.promptPath, 'utf-8');
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
    .argument('<id>', 'Agent id from inputs/agents.js')
    .argument('<prompt...>', 'User request to send to the agent')
    .option('--profile <profile>', 'Codex profile to use', DEFAULT_PROFILE)
    .action(async (id: string, promptParts: string[], options: AgentCommandOptions) => {
      const profile = options.profile ?? DEFAULT_PROFILE;
      const prompt = promptParts.join(' ').trim();
      if (!prompt) {
        throw new Error('Prompt is required');
      }

      const workingDir = process.cwd();

      const memoryDir = path.resolve(workingDir, 'memory');
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

