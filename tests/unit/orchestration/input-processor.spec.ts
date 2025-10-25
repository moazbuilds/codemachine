import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { InputFileProcessor } from '../../../src/agents/orchestration/input-processor';

const tempRoot = path.resolve('.tmp/input-processor-tests');

describe('InputFileProcessor', () => {
  const processor = new InputFileProcessor();

  beforeEach(async () => {
    await fs.mkdir(tempRoot, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  describe('loadInputFiles', () => {
    it('should load single file', async () => {
      const filePath = path.join(tempRoot, 'test.md');
      await fs.writeFile(filePath, 'Test content', 'utf-8');

      const result = await processor.loadInputFiles(['test.md'], tempRoot);

      expect(result).toContain('=== File: test.md ===');
      expect(result).toContain('Test content');
    });

    it('should load multiple files', async () => {
      const file1 = path.join(tempRoot, 'file1.md');
      const file2 = path.join(tempRoot, 'file2.md');

      await fs.writeFile(file1, 'Content 1', 'utf-8');
      await fs.writeFile(file2, 'Content 2', 'utf-8');

      const result = await processor.loadInputFiles(['file1.md', 'file2.md'], tempRoot);

      expect(result).toContain('=== File: file1.md ===');
      expect(result).toContain('Content 1');
      expect(result).toContain('=== File: file2.md ===');
      expect(result).toContain('Content 2');
    });

    it('should handle absolute paths', async () => {
      const absolutePath = path.join(tempRoot, 'absolute.md');
      await fs.writeFile(absolutePath, 'Absolute content', 'utf-8');

      const result = await processor.loadInputFiles([absolutePath], tempRoot);

      expect(result).toContain('Absolute content');
    });

    it('should handle missing files gracefully', async () => {
      const result = await processor.loadInputFiles(['nonexistent.md'], tempRoot);

      expect(result).toContain('=== File: nonexistent.md (FAILED TO LOAD) ===');
      expect(result).toContain('Error:');
    });

    it('should return empty string for empty array', async () => {
      const result = await processor.loadInputFiles([], tempRoot);
      expect(result).toBe('');
    });

    it('should continue loading after encountering error', async () => {
      const file1 = path.join(tempRoot, 'file1.md');
      await fs.writeFile(file1, 'Content 1', 'utf-8');

      const result = await processor.loadInputFiles(
        ['file1.md', 'nonexistent.md', 'file1.md'],
        tempRoot
      );

      // Should contain successful loads
      expect(result).toContain('Content 1');
      // Should contain error for missing file
      expect(result).toContain('nonexistent.md (FAILED TO LOAD)');
    });
  });

  describe('buildCompositePrompt', () => {
    it('should build prompt with all sections', () => {
      const inputContent = 'Input file content';
      const template = 'Agent template';
      const userPrompt = 'User request';

      const result = processor.buildCompositePrompt(inputContent, template, userPrompt);

      expect(result).toContain('[INPUT FILES]');
      expect(result).toContain('Input file content');
      expect(result).toContain('[SYSTEM]');
      expect(result).toContain('Agent template');
      expect(result).toContain('[REQUEST]');
      expect(result).toContain('User request');
    });

    it('should handle missing input content', () => {
      const result = processor.buildCompositePrompt('', 'Template', 'Prompt');

      expect(result).not.toContain('[INPUT FILES]');
      expect(result).toContain('[SYSTEM]');
      expect(result).toContain('[REQUEST]');
    });

    it('should handle missing user prompt', () => {
      const result = processor.buildCompositePrompt('Input', 'Template');

      expect(result).toContain('[INPUT FILES]');
      expect(result).toContain('[SYSTEM]');
      expect(result).not.toContain('[REQUEST]');
    });

    it('should handle only template', () => {
      const result = processor.buildCompositePrompt('', 'Template only', '');

      expect(result).toContain('[SYSTEM]');
      expect(result).toContain('Template only');
      expect(result).not.toContain('[INPUT FILES]');
      expect(result).not.toContain('[REQUEST]');
    });

    it('should build correct structure with input and template only', () => {
      const result = processor.buildCompositePrompt('Input content', 'Template content');

      const lines = result.split('\n');
      const inputIndex = lines.findIndex(l => l.includes('[INPUT FILES]'));
      const systemIndex = lines.findIndex(l => l.includes('[SYSTEM]'));

      expect(inputIndex).toBeGreaterThan(-1);
      expect(systemIndex).toBeGreaterThan(inputIndex);
    });
  });
});
