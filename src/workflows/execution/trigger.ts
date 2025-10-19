import * as path from 'node:path';
import type { EngineType } from '../../infra/engines/index.js';
import { getEngine, registry } from '../../infra/engines/index.js';
import { loadAgentConfig, loadAgentTemplate } from '../../agents/execution/index.js';
import { MemoryAdapter } from '../../infra/fs/memory-adapter.js';
import { MemoryStore } from '../../agents/memory/memory-store.js';
import { formatAgentLog } from '../../shared/logging/index.js';
import { processPromptString } from '../../shared/prompts/index.js';

export interface TriggerExecutionOptions {
  triggerAgentId: string;
  cwd: string;
  engineType: EngineType;
  logger: (chunk: string) => void;
  stderrLogger: (chunk: string) => void;
  sourceAgentId: string; // The agent that triggered this execution
}

/**
 * Executes a triggered agent by loading it from config/main.agents.js
 * This bypasses the workflow and allows triggering any agent, even outside the workflow
 */
export async function executeTriggerAgent(options: TriggerExecutionOptions): Promise<void> {
  const { triggerAgentId, cwd, engineType, logger, stderrLogger, sourceAgentId } = options;

  try {
    // Load agent config and template from config/main.agents.js
    const triggeredAgentConfig = await loadAgentConfig(triggerAgentId, cwd);
    const rawTemplate = await loadAgentTemplate(triggerAgentId, cwd);
    const triggeredAgentTemplate = await processPromptString(rawTemplate, cwd);

    console.log(formatAgentLog(sourceAgentId, `Executing triggered agent: ${triggeredAgentConfig.name}`));
    console.log('═'.repeat(80));
    console.log(formatAgentLog(triggerAgentId, `${triggeredAgentConfig.name} started to work (triggered).`));

    // Build prompt for triggered agent (memory write-only, no read)
    const memoryDir = path.resolve(cwd, '.codemachine', 'memory');
    const adapter = new MemoryAdapter(memoryDir);
    const store = new MemoryStore(adapter);
    const compositePrompt = `[SYSTEM]\n${triggeredAgentTemplate}`;

    // Get engine and resolve model/reasoning
    const engine = getEngine(engineType);
    const engineModule = registry.get(engineType);
    const triggeredModel = (triggeredAgentConfig.model as string | undefined) ?? engineModule?.metadata.defaultModel;
    const triggeredReasoning = (triggeredAgentConfig.modelReasoningEffort as 'low' | 'medium' | 'high' | undefined) ?? engineModule?.metadata.defaultModelReasoningEffort;

    // Execute triggered agent
    let totalTriggeredStdout = '';
    const triggeredResult = await engine.run({
      prompt: compositePrompt,
      workingDir: cwd,
      model: triggeredModel,
      modelReasoningEffort: triggeredReasoning,
      onData: (chunk) => {
        totalTriggeredStdout += chunk;
        logger(chunk);
      },
      onErrorData: (chunk) => {
        stderrLogger(chunk);
      },
    });

    // Store output in memory
    const triggeredStdout = triggeredResult.stdout || totalTriggeredStdout;
    const triggeredSlice = triggeredStdout.slice(-2000);
    await store.append({
      agentId: triggerAgentId,
      content: triggeredSlice,
      timestamp: new Date().toISOString(),
    });

    console.log(formatAgentLog(triggerAgentId, `${triggeredAgentConfig.name} (triggered) has completed their work.`));
    console.log('═'.repeat(80));
  } catch (triggerError) {
    console.error(
      formatAgentLog(
        sourceAgentId,
        `Triggered agent '${triggerAgentId}' failed: ${triggerError instanceof Error ? triggerError.message : String(triggerError)}`,
      ),
    );
    // Continue with workflow even if triggered agent fails
    throw triggerError;
  }
}
