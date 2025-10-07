import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import type { Command } from 'commander';

import type { EngineType } from '../../infra/engines/types.js';
import { getEngine } from '../../infra/engines/engine-factory.js';
import { claude, codex } from '../../infra/engines/index.js';
import { MemoryAdapter } from '../../infra/fs/memory-adapter.js';
import { MemoryStore } from '../../agents/index.js';
import { resolveAgentsModulePath } from '../../shared/agents/index.js';
import type { AgentDefinition } from '../../shared/agents/config/types.js';

type AgentCommandOptions = {
  profile?: string;
  model?: string;
};

type AgentConfig = AgentDefinition & {
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

async function getAgentConfig(agentId: string): Promise<AgentConfig> {
  const lookupBase = process.env.CODEMACHINE_CWD || process.cwd();
  const agentsPath = resolveAgentsModulePath({ projectRoot: lookupBase });

  if (!agentsPath) {
    throw new Error('Unable to locate agents configuration.');
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

  return config;
}

async function buildCompositePrompt(agentId: string, request: string, store: MemoryStore): Promise<string> {
  const template = await loadAgentTemplate(agentId);
  const entries = await store.list(agentId);
  const memoryText = entries.map((e) => e.content).join('\n');
  const composite = `[SYSTEM]\n${template}\n\n[MEMORY]\n${memoryText}\n\n[REQUEST]\n${request}`;
  return composite;
}

async function executeAgent(
  engineType: EngineType,
  agentId: string,
  promptParts: string[],
  options: AgentCommandOptions,
): Promise<void> {
  const profile = options.profile ?? agentId;
  const prompt = promptParts.join(' ').trim();
  if (!prompt) {
    throw new Error('Prompt is required');
  }

  // Ensure authentication for the engine
  if (engineType === 'claude') {
    const isAuthed = await claude.isAuthenticated();
    if (!isAuthed) {
      console.error(`\nClaude authentication required`);
      console.error(`\nRun the following command to authenticate:\n`);
      console.error(`  CLAUDE_CONFIG_DIR=~/.codemachine/claude claude setup-token\n`);
      throw new Error('Claude authentication required');
    }
  } else if (engineType === 'codex') {
    await codex.ensureAuth();
  }

  const workingDir = process.cwd();

  const memoryDir = path.resolve(workingDir, '.codemachine', 'memory');
  const adapter = new MemoryAdapter(memoryDir);
  const store = new MemoryStore(adapter);

  const compositePrompt = await buildCompositePrompt(agentId, prompt, store);

  // Get agent config to check for model
  const agentConfig = await getAgentConfig(agentId);
  const model = options.model ?? (agentConfig.model as string | undefined);

  const engine = getEngine(engineType);

  let totalStdout = '';
  const result = await engine.run({
    profile,
    prompt: compositePrompt,
    workingDir,
    model,
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
    agentId,
    content: slice,
    timestamp: new Date().toISOString(),
  });
}

function registerAgentSubcommand(parentCommand: Command, engineType: EngineType): void {
  parentCommand
    .command('agent')
    .description(`Execute ${engineType} with an agent wrapper`)
    .argument('<id>', 'Agent id from config/sub.agents.js or config/main.agents.js')
    .argument('<prompt...>', 'User request to send to the agent')
    .option('--profile <profile>', `${engineType} profile to use (defaults to the agent id)`)
    .option('--model <model>', 'Model to use (overrides agent config)')
    .action(async (id: string, promptParts: string[], opts: AgentCommandOptions) => {
      await executeAgent(engineType, id, promptParts, opts);
    });
}

export function registerEngineCommands(program: Command): void {
  // Register claude subcommand
  const claudeCommand = program
    .command('claude')
    .description('Use Claude engine for agent execution');

  registerAgentSubcommand(claudeCommand, 'claude');

  // Register codex subcommand
  const codexCommand = program
    .command('codex')
    .description('Use Codex engine for agent execution');

  registerAgentSubcommand(codexCommand, 'codex');
}
