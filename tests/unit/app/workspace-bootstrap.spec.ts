import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { bootstrapWorkspace } from '../../../src/app/services/workspace-bootstrap.js';

const require = createRequire(import.meta.url);

const AGENTS_FIXTURE = `module.exports = [
  { id: 'frontend-dev', name: 'Frontend Developer' },
  { id: 'custom-agent', name: 'Custom Agent' }
];`;

async function createProject(root: string): Promise<string> {
  const projectRoot = join(root, 'project');
  await mkdir(join(projectRoot, 'config'), { recursive: true });
  await writeFile(join(projectRoot, 'config', 'package.json'), '{"type":"commonjs"}\n', 'utf8');
  await writeFile(join(projectRoot, 'config', 'agents.js'), AGENTS_FIXTURE, 'utf8');
  return projectRoot;
}

describe('bootstrapWorkspace', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'workspace-bootstrap-'));
    originalCwd = process.cwd();
  });

  afterEach(async () => {
    try {
      process.chdir(originalCwd);
    } catch {}
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates missing directories and files', async () => {
    const projectRoot = await createProject(tempDir);
    const desiredCwd = join(tempDir, 'projects', 'new-app');

    await bootstrapWorkspace({ projectRoot, cwd: desiredCwd });

    // Working directory directory is created (chdir may be disallowed in test worker threads)
    const desiredStat = await stat(desiredCwd);
    expect(desiredStat.isDirectory()).toBe(true);

    // Directories exist
    const specsPath = join(desiredCwd, '.codemachine', 'inputs', 'specifications.md');
    const memoryDir = join(desiredCwd, '.codemachine', 'memory');
    const planDir = join(desiredCwd, '.codemachine', 'plan');
    const agentsJson = join(desiredCwd, '.codemachine', 'agents', 'agents-config.json');

    // files/dirs existence checks via stat
    await Promise.all([
      stat(specsPath),
      stat(memoryDir),
      stat(planDir),
      stat(agentsJson)
    ]);

    const agentsContent = await readFile(agentsJson, 'utf8');
    const parsed = JSON.parse(agentsContent);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toEqual([
      { id: 'frontend-dev', name: 'Frontend Developer' },
      { id: 'custom-agent', name: 'Custom Agent' }
    ]);
  });

  it('mirrors config/agents.js to JSON and is idempotent', async () => {
    const projectRoot = await createProject(tempDir);
    const desiredCwd = join(tempDir, 'projects', 'sample-app');

    await bootstrapWorkspace({ projectRoot, cwd: desiredCwd });

    const agentsJson = join(desiredCwd, '.codemachine', 'agents', 'agents-config.json');
    const first = await stat(agentsJson);

    // Short delay to ensure mtime would differ if rewritten
    await delay(100);

    await bootstrapWorkspace({ projectRoot, cwd: desiredCwd });
    const second = await stat(agentsJson);

    // unchanged when config/agents.js unchanged
    expect(second.mtimeMs).toBe(first.mtimeMs);

    // Now, change agents.js and expect JSON to refresh
    const UPDATED_AGENTS = `module.exports = [ { id: 'only-one' } ];`;
    await writeFile(join(projectRoot, 'config', 'agents.js'), UPDATED_AGENTS, 'utf8');

    // ensure filesystem mtime can change on many FS
    await delay(1100);
    await bootstrapWorkspace({ projectRoot, cwd: desiredCwd });
    const third = await stat(agentsJson);
    expect(third.mtimeMs).toBeGreaterThanOrEqual(second.mtimeMs);

    const updatedContent = JSON.parse(await readFile(agentsJson, 'utf8'));
    expect(updatedContent).toEqual([{ id: 'only-one' }]);
  });

  it('respects CODEMACHINE_CWD environment override when cwd not provided', async () => {
    const projectRoot = await createProject(tempDir);
    const envCwd = join(tempDir, 'env', 'codemachine-cwd');

    const prev = process.env.CODEMACHINE_CWD;
    process.env.CODEMACHINE_CWD = envCwd;
    try {
      await bootstrapWorkspace({ projectRoot });
    } finally {
      if (prev === undefined) delete process.env.CODEMACHINE_CWD;
      else process.env.CODEMACHINE_CWD = prev;
    }

    // Working directory was created (switching CWD may be disallowed in thread pool)
    const st = await stat(envCwd);
    expect(st.isDirectory()).toBe(true);

    // Ensure .codemachine was created under the env-directed workspace
    const specsPath = join(envCwd, '.codemachine', 'inputs', 'specifications.md');
    const agentsJson = join(envCwd, '.codemachine', 'agents', 'agents-config.json');
    await Promise.all([stat(specsPath), stat(agentsJson)]);
  });

  it('falls back to the CLI agents catalog when workspace has no config', async () => {
    const desiredCwd = join(tempDir, 'projects', 'bare-app');

    await bootstrapWorkspace({ cwd: desiredCwd });

    const agentsJson = join(desiredCwd, '.codemachine', 'agents', 'agents-config.json');
    const parsedAgents = JSON.parse(await readFile(agentsJson, 'utf8'));
    const cliAgents = require('../../../config/agents.js');

    expect(parsedAgents).toEqual(cliAgents);
  });
});
