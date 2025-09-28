import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { validateSpecification } from '../../../src/core/workflows/workflow-manager.js';

describe('validateSpecification', () => {
  let tempDir: string;
  let tempSpecPath: string;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'planning-workflow-'));
    tempSpecPath = join(tempDir, 'spec.md');
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('resolves when specification file has content', async () => {
    await writeFile(tempSpecPath, '# Planning Spec\n- Outline');

    await expect(validateSpecification(tempSpecPath, false)).resolves.toBeUndefined();
  });

  it('rejects when specification file is empty', async () => {
    await writeFile(tempSpecPath, '');

    await expect(validateSpecification(tempSpecPath, false)).rejects.toThrow(/empty/);
  });
});
