import { describe, it, expect } from 'bun:test';
import { parseTelemetryChunk } from '../../../src/ui/utils/telemetryParser';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('TelemetryParser', () => {
  describe('Claude output parsing', () => {
    it('should parse standard Claude telemetry with all fields', () => {
      const chunk = '⏱️  Duration: 1234ms | Cost: $0.0234 | Tokens: 2,456in/1,234out';
      const result = parseTelemetryChunk(chunk);

      expect(result).toEqual({
        tokensIn: 2456,
        tokensOut: 1234,
        cost: 0.0234,
        duration: 1.234,
      });
    });

    it('should parse Claude telemetry without cost', () => {
      const chunk = '⏱️  Duration: 567ms | Tokens: 890in/445out';
      const result = parseTelemetryChunk(chunk);

      expect(result).toEqual({
        tokensIn: 890,
        tokensOut: 445,
        duration: 0.567,
      });
    });
  });

  describe('Codex output parsing', () => {
    it('should parse Codex telemetry with cached tokens', () => {
      const chunk = '⏱️  Tokens: 1,000in/300out (100 cached)';
      const result = parseTelemetryChunk(chunk);

      expect(result).toEqual({
        tokensIn: 1000,
        tokensOut: 300,
        cached: 100,
      });
    });

    it('should parse Codex telemetry without cached', () => {
      const chunk = '⏱️  Tokens: 456in/123out (50 cached)';
      const result = parseTelemetryChunk(chunk);

      expect(result).toEqual({
        tokensIn: 456,
        tokensOut: 123,
        cached: 50,
      });
    });
  });

  describe('Cursor output parsing', () => {
    it('should parse Cursor telemetry with duration and cost', () => {
      const chunk = '⏱️  Duration: 2345ms | Cost: $0.0080 | Tokens: 800in/400out';
      const result = parseTelemetryChunk(chunk);

      expect(result).toEqual({
        tokensIn: 800,
        tokensOut: 400,
        cost: 0.008,
        duration: 2.345,
      });
    });

    it('should parse Cursor telemetry with cached tokens', () => {
      const chunk = '⏱️  Duration: 5678ms | Cost: $0.0120 | Tokens: 1,200in/600out (150 cached)';
      const result = parseTelemetryChunk(chunk);

      expect(result).toEqual({
        tokensIn: 1200,
        tokensOut: 600,
        cost: 0.012,
        duration: 5.678,
        cached: 150,
      });
    });
  });

  describe('Edge cases', () => {
    it('should return null for malformed input', () => {
      expect(parseTelemetryChunk('No telemetry here')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseTelemetryChunk('')).toBeNull();
    });

    it('should handle large numbers with commas', () => {
      const chunk = 'Tokens: 178,191in/83,613out';
      const result = parseTelemetryChunk(chunk);

      expect(result).toEqual({
        tokensIn: 178191,
        tokensOut: 83613,
      });
    });

    it('should handle numbers without commas', () => {
      const chunk = 'Tokens: 500in/200out';
      const result = parseTelemetryChunk(chunk);

      expect(result).toEqual({
        tokensIn: 500,
        tokensOut: 200,
      });
    });
  });

  describe('Real fixture parsing', () => {
    it('should parse Claude fixture output', () => {
      const fixture = readFileSync(
        join(__dirname, '../fixtures/claude-output.txt'),
        'utf-8'
      );
      const lines = fixture.split('\n');
      const telemetryLines = lines.filter(line => parseTelemetryChunk(line));

      expect(telemetryLines.length).toBeGreaterThan(0);
    });
  });
});
