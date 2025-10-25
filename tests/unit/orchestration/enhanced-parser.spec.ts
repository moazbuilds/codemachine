import { describe, it, expect } from 'vitest';
import { EnhancedCommandParser } from '../../../src/agents/orchestration/enhanced-parser';

describe('EnhancedCommandParser', () => {
  const parser = new EnhancedCommandParser();

  describe('tryParseEnhanced', () => {
    it('should parse agent with single input file', () => {
      const result = parser.tryParseEnhanced("agent[input:file.md] 'prompt'");
      expect(result).not.toBeNull();
      expect(result?.name).toBe('agent');
      expect(result?.input).toEqual(['file.md']);
      expect(result?.prompt).toBe('prompt');
    });

    it('should parse agent with multiple input files (semicolon-separated)', () => {
      const result = parser.tryParseEnhanced("agent[input:file1.md;file2.md;file3.md]");
      expect(result).not.toBeNull();
      expect(result?.name).toBe('agent');
      expect(result?.input).toEqual(['file1.md', 'file2.md', 'file3.md']);
      expect(result?.prompt).toBeUndefined();
    });

    it('should parse agent with tail option', () => {
      const result = parser.tryParseEnhanced("agent[tail:100] 'prompt'");
      expect(result).not.toBeNull();
      expect(result?.name).toBe('agent');
      expect(result?.tail).toBe(100);
      expect(result?.prompt).toBe('prompt');
    });

    it('should parse agent with combined options', () => {
      const result = parser.tryParseEnhanced("agent[input:file1.md;file2.md,tail:50] 'prompt'");
      expect(result).not.toBeNull();
      expect(result?.name).toBe('agent');
      expect(result?.input).toEqual(['file1.md', 'file2.md']);
      expect(result?.tail).toBe(50);
      expect(result?.prompt).toBe('prompt');
    });

    it('should parse agent with prompt in options', () => {
      const result = parser.tryParseEnhanced('agent[input:file.md,prompt:"analyze this"]');
      expect(result).not.toBeNull();
      expect(result?.name).toBe('agent');
      expect(result?.input).toEqual(['file.md']);
      expect(result?.prompt).toBe('analyze this');
    });

    it('should parse agent with no prompt', () => {
      const result = parser.tryParseEnhanced("agent[input:file.md]");
      expect(result).not.toBeNull();
      expect(result?.name).toBe('agent');
      expect(result?.input).toEqual(['file.md']);
      expect(result?.prompt).toBeUndefined();
    });

    it('should parse agent with double quotes in prompt', () => {
      const result = parser.tryParseEnhanced('agent[tail:100] "prompt here"');
      expect(result).not.toBeNull();
      expect(result?.name).toBe('agent');
      expect(result?.tail).toBe(100);
      expect(result?.prompt).toBe('prompt here');
    });

    it('should handle extra options', () => {
      const result = parser.tryParseEnhanced("agent[custom:value,input:file.md]");
      expect(result).not.toBeNull();
      expect(result?.name).toBe('agent');
      expect(result?.input).toEqual(['file.md']);
      expect(result?.options?.custom).toBe('value');
    });

    it('should return null for non-enhanced syntax', () => {
      const result = parser.tryParseEnhanced("agent 'prompt'");
      expect(result).toBeNull();
    });

    it('should return null for invalid syntax', () => {
      const result = parser.tryParseEnhanced("agent[");
      expect(result).toBeNull();
    });

    it('should handle quoted values in options', () => {
      const result = parser.tryParseEnhanced('agent[input:"path/with spaces.md"] "prompt"');
      expect(result).not.toBeNull();
      expect(result?.name).toBe('agent');
      expect(result?.input).toEqual(['path/with spaces.md']);
      expect(result?.prompt).toBe('prompt');
    });

    it('should handle absolute paths', () => {
      const result = parser.tryParseEnhanced('agent[input:/absolute/path.md;relative/path.md]');
      expect(result).not.toBeNull();
      expect(result?.input).toEqual(['/absolute/path.md', 'relative/path.md']);
    });

    it('should handle tail with no prompt', () => {
      const result = parser.tryParseEnhanced('agent[tail:50]');
      expect(result).not.toBeNull();
      expect(result?.name).toBe('agent');
      expect(result?.tail).toBe(50);
      expect(result?.prompt).toBeUndefined();
    });

    it('should ignore invalid tail values', () => {
      const result = parser.tryParseEnhanced('agent[tail:invalid]');
      expect(result).not.toBeNull();
      expect(result?.tail).toBeUndefined();
    });
  });
});
