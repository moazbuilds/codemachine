import { loadAgentTemplate } from './config.js';
import { processPromptString } from '../../shared/prompts/index.js';

/**
 * Builds a composite prompt combining system template and user request
 * @deprecated Memory read functionality has been removed. This now only combines template and request.
 */
export async function buildCompositePrompt(
  agentId: string,
  request: string,
  projectRoot?: string,
): Promise<string> {
  const rawTemplate = await loadAgentTemplate(agentId, projectRoot);
  const template = await processPromptString(rawTemplate, projectRoot ?? process.cwd());
  const composite = `[SYSTEM]\n${template}\n\n[REQUEST]\n${request}`;
  return composite;
}
