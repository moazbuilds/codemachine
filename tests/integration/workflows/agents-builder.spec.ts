import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runAgentsBuilder } from '../../../src/agents/runtime/agents-builder.js';

const AGENTS_FIXTURE = (promptsRoot: string) => `module.exports = [
  {
    id: 'frontend-dev',
    name: 'Frontend Developer',
    promptPath: require('path').join(${JSON.stringify(promptsRoot)}, 'frontend-developer.md')
  },
  {
    id: 'backend-dev',
    name: 'Backend Developer',
    promptPath: require('path').join(${JSON.stringify(promptsRoot)}, 'backend-developer.md')
  }
];`;

describe('agents-builder integration', () => {
  let projectRoot: string;

  beforeEach(async () => {
    // Use workspace-local tmp directory to avoid external /tmp dependencies
    const baseTmp = join(process.cwd(), '.tmp-tests');
    await mkdir(baseTmp, { recursive: true });
    projectRoot = await mkdtemp(join(baseTmp, 'agents-builder-'));
    // minimal project layout
    await mkdir(join(projectRoot, 'inputs'), { recursive: true });
    await mkdir(join(projectRoot, 'prompts'), { recursive: true });
    await writeFile(join(projectRoot, 'prompts', 'frontend-developer.md'), '# Frontend Dev\n', 'utf8');
    await writeFile(join(projectRoot, 'prompts', 'backend-developer.md'), '# Backend Dev\n', 'utf8');
    await writeFile(
      join(projectRoot, 'inputs', 'agents.cjs'),
      AGENTS_FIXTURE(join(projectRoot, 'prompts')),
      'utf8',
    );
    await mkdir(join(projectRoot, 'runner-prompts'), { recursive: true });
    await writeFile(join(projectRoot, 'runner-prompts', 'user-input.md'), '# Spec\n', 'utf8');
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('creates per-agent prompts and a non-empty tasks.json', async () => {
    await runAgentsBuilder({
      workingDir: projectRoot,
      force: true,
      specPath: join(projectRoot, 'runner-prompts', 'user-input.md'),
    });

    const agent1 = join(projectRoot, '.codemachine', 'agents', 'frontend-dev.md');
    const agent2 = join(projectRoot, '.codemachine', 'agents', 'backend-dev.md');
    const tasks = join(projectRoot, '.codemachine', 'plan', 'tasks.json');

    // files exist
    await Promise.all([stat(agent1), stat(agent2), stat(tasks)]);

    // tasks.json non-empty and parsable
    const content = await readFile(tasks, 'utf8');
    expect(content.trim().length).toBeGreaterThan(0);
    const parsed = JSON.parse(content);
    expect(Array.isArray(parsed.tasks)).toBe(true);
    expect(parsed.tasks.length).toBeGreaterThan(0);
  });

  it('is idempotent for agent prompts without force and refreshes with force', async () => {
    const agentFile = join(projectRoot, '.codemachine', 'agents', 'frontend-dev.md');

    await runAgentsBuilder({ workingDir: projectRoot, force: true });
    const first = await stat(agentFile);

    await delay(1000); // ensure mtime can differ
    await runAgentsBuilder({ workingDir: projectRoot, force: false });
    const second = await stat(agentFile);
    expect(second.mtimeMs).toBe(first.mtimeMs);

    await delay(1000);
    await runAgentsBuilder({ workingDir: projectRoot, force: true });
    const third = await stat(agentFile);
    expect(third.mtimeMs).toBeGreaterThanOrEqual(second.mtimeMs);
  });

  // TODO: add content sanity checks (e.g., agent prompt includes project-specific section)
});
