import { loadAgentTemplate } from './config.js';
import type { MemoryStore } from '../memory/memory-store.js';

/**
 * Builds a composite prompt combining system template, memory, and user request
 */
export async function buildCompositePrompt(
  agentId: string,
  request: string,
  store: MemoryStore,
  projectRoot?: string,
): Promise<string> {
  const template = await loadAgentTemplate(agentId, projectRoot);
  const entries = await store.list(agentId);
  const memoryText = entries.map((e) => e.content).join('\n');
  const composite = `[SYSTEM]\n${template}\n\n[MEMORY]\n${memoryText}\n\n[REQUEST]\n${request}`;
  return composite;
}
