import { describe, expect, it } from 'vitest';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getAgent, listAgents, requireAgent } from './index.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function toPosix(value: string): string {
  return value.replace(/\\+/g, '/');
}

describe('agent registry', () => {
  it('listAgents returns known ids with absolute prompt paths', async () => {
    const agents = await listAgents(projectRoot);

    const ids = agents.map((agent) => agent.id);
    expect(ids).toEqual(expect.arrayContaining(['agents-builder', 'master-mind', 'project-summarizer']));

    agents.forEach((agent) => {
      expect(isAbsolute(agent.promptPath)).toBe(true);
    });
  });

  it('getAgent returns agents-builder with expected prompt path', async () => {
    const agent = await getAgent('agents-builder', projectRoot);
    expect(agent).toBeDefined();
    expect(agent?.id).toBe('agents-builder');
    expect(toPosix(agent!.promptPath)).toMatch(/\/prompts\/agents\/agents-builder\.md$/);
  });

  it('requireAgent throws for unknown id', async () => {
    await expect(requireAgent('unknown', projectRoot)).rejects.toThrowError(
      /Agent with id "unknown" was not found/
    );
  });
});
