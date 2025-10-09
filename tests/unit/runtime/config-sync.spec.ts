import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { syncCodexConfig } from '../../../src/infra/engines/codex/index.js';

const AGENTS_FIXTURE = `module.exports = [
  { id: 'frontend-dev' },
  { id: 'custom-agent' }
];`;

async function createProject(root: string): Promise<string> {
  const projectRoot = join(root, 'project');
  await mkdir(join(projectRoot, 'config'), { recursive: true });
  await writeFile(join(projectRoot, 'config', 'package.json'), '{"type":"commonjs"}\n', 'utf8');
  await writeFile(join(projectRoot, 'config', 'sub.agents.js'), AGENTS_FIXTURE, 'utf8');
  return projectRoot;
}

describe('syncCodexConfig', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'codex-config-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('writes the expected config structure with headings', async () => {
    const projectRoot = await createProject(tempDir);
    const codexHome = join(tempDir, 'codex-home');

    await syncCodexConfig({ projectRoot, codexHome });

    const configPath = join(codexHome, 'config.toml');
    const content = await readFile(configPath, 'utf8');

    expect(content).toContain('# Model configuration');
    expect(content).toContain('model = "gpt-5-codex"');
    expect(content).toContain('# Profile configurations (dynamically generated from workflow templates and agent catalogs)');
    // Since agents no longer have model/modelReasoningEffort in config, they use engine defaults (medium for codex)
    expect(content).toMatch(/\[profiles\.frontend-dev][\s\S]*model_reasoning_effort = "medium"/);
    expect(content).toMatch(/\[profiles\.custom-agent][\s\S]*model_reasoning_effort = "medium"/);
  });

  it('does not rewrite the config when content is unchanged', async () => {
    const projectRoot = await createProject(tempDir);
    const codexHome = join(tempDir, 'codex-home');

    await syncCodexConfig({ projectRoot, codexHome });
    const configPath = join(codexHome, 'config.toml');
    const initialStat = await stat(configPath);

    await delay(20);

    await syncCodexConfig({ projectRoot, codexHome });
    const finalStat = await stat(configPath);

    expect(finalStat.mtimeMs).toBe(initialStat.mtimeMs);
  });

  it('respects the CODEX_HOME environment override', async () => {
    const projectRoot = await createProject(tempDir);
    const overrideHome = join(tempDir, 'env-home');
    const original = process.env.CODEX_HOME;

    process.env.CODEX_HOME = overrideHome;
    try {
      await syncCodexConfig({ projectRoot });
    } finally {
      if (original === undefined) {
        delete process.env.CODEX_HOME;
      } else {
        process.env.CODEX_HOME = original;
      }
    }

    const configPath = join(overrideHome, 'config.toml');
    const content = await readFile(configPath, 'utf8');

    expect(content).toContain('model = "gpt-5-codex"');
  });

  it('appends additional agent ids when provided', async () => {
    const projectRoot = await createProject(tempDir);
    const codexHome = join(tempDir, 'codex-extra');

    await syncCodexConfig({
      projectRoot,
      codexHome,
      additionalAgents: [
        { id: 'agents-builder', modelReasoningEffort: 'high' },
        { id: 'master-mind', modelReasoningEffort: 'high' },
        { id: 'custom-agent', modelReasoningEffort: 'low' },
      ],
    });

    const configPath = join(codexHome, 'config.toml');
    const content = await readFile(configPath, 'utf8');

    expect(content).toContain('[profiles.frontend-dev]');
    expect(content).toContain('[profiles.custom-agent]');
    expect(content).toContain('[profiles.agents-builder]');
    expect(content).toContain('[profiles.master-mind]');

    const builderCount = content.split('[profiles.agents-builder]').length - 1;
    expect(builderCount).toBe(1);

    const customCount = content.split('[profiles.custom-agent]').length - 1;
    expect(customCount).toBe(1);
    expect(content).toContain('model_reasoning_effort = "low"');
  });
});
