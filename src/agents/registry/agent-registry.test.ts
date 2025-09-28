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
    expect(ids).toEqual(expect.arrayContaining([
      'uxui-designer',
      'frontend-dev',
      'backend-dev',
      'solution-architect',
      'technical-writer',
      'qa-engineer',
      'performance-engineer',
      'software-architect',
    ]));

    agents.forEach((agent) => {
      expect(isAbsolute(agent.promptPath)).toBe(true);
    });
  });

  it('getAgent returns frontend-dev with expected prompt path', async () => {
    const agent = await getAgent('frontend-dev', projectRoot);
    expect(agent).toBeDefined();
    expect(agent?.id).toBe('frontend-dev');
    expect(toPosix(agent!.promptPath)).toMatch(/\/prompts\/frontend-developer\.md$/);
  });

  it('requireAgent throws for unknown id', async () => {
    await expect(requireAgent('unknown', projectRoot)).rejects.toThrowError(
      /Agent with id "unknown" was not found/
    );
  });
});
