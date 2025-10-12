import type { Command } from 'commander';
import * as path from 'node:path';

import { MemoryAdapter } from '../../infra/fs/memory-adapter.js';
import { MemoryStore } from '../../agents/memory/memory-store.js';
import { loadAgentTemplate, loadAgentConfig } from '../../agents/execution/index.js';
import { getEngine } from '../../infra/engines/index.js';
import type { EngineType } from '../../infra/engines/index.js';

type StepCommandOptions = {
  model?: string;
  engine?: string;
};

/**
 * Ensures the engine is authenticated
 */
async function ensureEngineAuth(engineType: EngineType, _profile: string): Promise<void> {
  const { registry } = await import('../../infra/engines/index.js');
  const engine = registry.get(engineType);

  if (!engine) {
    const availableEngines = registry.getAllIds().join(', ');
    throw new Error(
      `Unknown engine type: ${engineType}. Available engines: ${availableEngines}`
    );
  }

  const isAuthed = await engine.auth.isAuthenticated();
  if (!isAuthed) {
    console.error(`\n${engine.metadata.name} authentication required`);
    console.error(`\nRun the following command to authenticate:\n`);
    console.error(`  codemachine auth login\n`);
    throw new Error(`${engine.metadata.name} authentication required`);
  }
}

/**
 * Executes a single workflow step (agent from config/main.agents.js)
 * with optional additional prompt appended to the main prompt
 */
async function executeStep(
  agentId: string,
  additionalPrompt: string,
  options: StepCommandOptions,
): Promise<void> {
  const workingDir = process.cwd();

  // Load agent config and template
  const agentConfig = await loadAgentConfig(agentId, workingDir);
  const agentTemplate = await loadAgentTemplate(agentId, workingDir);

  // Determine engine: CLI override > agent config > first authenticated engine
  const { registry } = await import('../../infra/engines/index.js');
  let engineType: EngineType;

  if (options.engine) {
    engineType = options.engine as EngineType;
  } else if (agentConfig.engine) {
    engineType = agentConfig.engine;
  } else {
    // Fallback: find first authenticated engine by order
    const engines = registry.getAll();
    let foundEngine = null;

    for (const engine of engines) {
      const isAuth = await engine.auth.isAuthenticated();
      if (isAuth) {
        foundEngine = engine;
        break;
      }
    }

    if (!foundEngine) {
      // If no authenticated engine, use default (first by order)
      foundEngine = registry.getDefault();
    }

    if (!foundEngine) {
      throw new Error('No engines registered. Please install at least one engine.');
    }

    engineType = foundEngine.metadata.id;
    console.log(`ℹ️  No engine specified for agent '${agentId}', using ${foundEngine.metadata.name} (${engineType})`);
  }

  // Ensure authentication
  await ensureEngineAuth(engineType, agentId);

  // Get engine module for defaults
  const engineModule = registry.get(engineType);
  if (!engineModule) {
    throw new Error(`Engine not found: ${engineType}`);
  }

  // Model resolution: CLI override > agent config > engine default
  const model = options.model ?? (agentConfig.model as string | undefined) ?? engineModule.metadata.defaultModel;
  const modelReasoningEffort = (agentConfig.modelReasoningEffort as 'low' | 'medium' | 'high' | undefined) ?? engineModule.metadata.defaultModelReasoningEffort;

  // Set up memory
  const memoryDir = path.resolve(workingDir, '.codemachine', 'memory');
  const adapter = new MemoryAdapter(memoryDir);
  const store = new MemoryStore(adapter);

  // Build composite prompt
  const entries = await store.list(agentId);
  const memoryText = entries.map((e) => e.content).join('\n');

  let compositePrompt: string;
  if (additionalPrompt) {
    // If additional prompt provided, append it as a REQUEST section
    compositePrompt = `[SYSTEM]\n${agentTemplate}\n\n[MEMORY]\n${memoryText}\n\n[REQUEST]\n${additionalPrompt}`;
  } else {
    // If no additional prompt, just use the template with memory
    compositePrompt = `[SYSTEM]\n${agentTemplate}\n\n[MEMORY]\n${memoryText}`;
  }

  // Get engine and execute
  const engine = getEngine(engineType);

  console.log(`\nExecuting agent: ${agentConfig.name} (${agentId})`);
  console.log(`Engine: ${engineModule.metadata.name} (${engineType})`);
  console.log(`Model: ${model}`);
  if (modelReasoningEffort) {
    console.log(`Reasoning: ${modelReasoningEffort}`);
  }
  console.log('');

  let totalStdout = '';
  const result = await engine.run({
    prompt: compositePrompt,
    workingDir,
    model,
    modelReasoningEffort,
    onData: (chunk) => {
      totalStdout += chunk;
      try {
        process.stdout.write(chunk);
      } catch {
        // ignore streaming failures
      }
    },
    onErrorData: (chunk) => {
      try {
        process.stderr.write(chunk);
      } catch {
        // ignore streaming failures
      }
    },
  });

  // Store output in memory
  const stdout = result.stdout || totalStdout;
  const slice = stdout.slice(-2000);
  await store.append({
    agentId,
    content: slice,
    timestamp: new Date().toISOString(),
  });

  console.log('\n✓ Agent execution completed');
}

/**
 * Registers the step command
 */
export async function registerStepCommand(program: Command): Promise<void> {
  const { registry } = await import('../../infra/engines/index.js');
  const defaultEngine = registry.getDefault();
  const defaultEngineName = defaultEngine?.metadata.name ?? 'default engine';

  program
    .command('step')
    .description('Execute a single workflow step (agent from config/main.agents.js)')
    .argument('<id>', 'Agent id from config/main.agents.js')
    .argument('[prompt...]', 'Optional additional prompt to append to the agent\'s main prompt')
    .option('--model <model>', 'Model to use (overrides agent config)')
    .option('--engine <engine>', 'Engine to use (overrides agent config and defaults)')
    .action(async (id: string, promptParts: string[], options: StepCommandOptions) => {
      const additionalPrompt = promptParts.join(' ').trim();
      await executeStep(id, additionalPrompt, options);
    });
}
