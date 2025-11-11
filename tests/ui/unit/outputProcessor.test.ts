import { describe, it, expect } from 'bun:test';
import { processOutputChunk } from '../../../src/ui/utils/outputProcessor';

describe('OutputProcessor', () => {
  describe('Tool detection', () => {
    it('should detect TOOL STARTED', () => {
      const chunk = '[GRAY]● Command: Read src/main.ts';
      const result = processOutputChunk(chunk);

      expect(result.type).toBe('tool');
      expect(result.toolName).toBe('Read src/main.ts');
    });

    it('should detect TOOL COMPLETED', () => {
      const chunk = '[GREEN]⎿ Read completed successfully';
      const result = processOutputChunk(chunk);

      expect(result.type).toBe('tool');
    });

    it('should detect TOOL usage', () => {
      const chunk = '[GRAY]● Command: Grep "TODO"';
      const result = processOutputChunk(chunk);

      expect(result.type).toBe('tool');
      expect(result.toolName).toBe('Grep "TODO"');
    });

    it('should detect COMMAND', () => {
      const chunk = '[GRAY]● Command: npm test';
      const result = processOutputChunk(chunk);

      expect(result.type).toBe('tool');
      expect(result.toolName).toBe('npm test');
    });
  });

  describe('Thinking detection', () => {
    it('should detect THINKING blocks', () => {
      const chunk = '[ORANGE]● Thinking: Need to check for common issues';
      const result = processOutputChunk(chunk);

      expect(result.type).toBe('thinking');
      expect(result.content).toContain('Thinking');
    });
  });

  describe('Telemetry detection', () => {
    it('should detect telemetry and extract data', () => {
      const chunk = '⏱️  Duration: 1234ms | Cost: $0.0234 | Tokens: 500in/200out';
      const result = processOutputChunk(chunk);

      expect(result.type).toBe('telemetry');
      expect(result.telemetry).toBeDefined();
      expect(result.telemetry?.tokensIn).toBe(500);
      expect(result.telemetry?.tokensOut).toBe(200);
    });
  });

  describe('Error detection', () => {
    it('should detect ERROR keyword', () => {
      const chunk = 'ERROR: Test framework not configured';
      const result = processOutputChunk(chunk);

      expect(result.type).toBe('error');
    });

    it('should detect failure symbol', () => {
      const chunk = '✗ Build failed';
      const result = processOutputChunk(chunk);

      expect(result.type).toBe('error');
    });
  });

  describe('Text detection', () => {
    it('should detect TEXT messages', () => {
      const chunk = '[GRAY]● Message: Starting analysis...';
      const result = processOutputChunk(chunk);

      expect(result.type).toBe('text');
    });

    it('should detect MESSAGE', () => {
      const chunk = '[GRAY]● Message: Running tests...';
      const result = processOutputChunk(chunk);

      expect(result.type).toBe('text');
    });

    it('should default to text for unknown patterns', () => {
      const chunk = 'Some random output';
      const result = processOutputChunk(chunk);

      expect(result.type).toBe('text');
      expect(result.content).toBe('Some random output');
    });
  });
});
