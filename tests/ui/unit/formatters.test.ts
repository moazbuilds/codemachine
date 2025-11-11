import { describe, it, expect } from 'bun:test';
import {
  formatDuration,
  formatRuntime,
  formatNumber,
  formatTokens,
  formatCost,
  formatTimestamp,
  truncate,
} from '../../../src/ui/utils/formatters';

describe('Formatters', () => {
  describe('formatDuration', () => {
    it('should format seconds to MM:SS', () => {
      expect(formatDuration(125)).toBe('02:05');
    });

    it('should format seconds to HH:MM:SS', () => {
      expect(formatDuration(3665)).toBe('01:01:05');
    });

    it('should handle zero', () => {
      expect(formatDuration(0)).toBe('00:00');
    });

    it('should pad single digits', () => {
      expect(formatDuration(5)).toBe('00:05');
    });
  });

  describe('formatRuntime', () => {
    it('should calculate elapsed time from start', () => {
      const startTime = Date.now() - 5000; // 5 seconds ago
      const result = formatRuntime(startTime);
      expect(result).toMatch(/00:0[45]/); // Allow 4-5 seconds
    });
  });

  describe('formatNumber', () => {
    it('should format with commas', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
    });

    it('should handle small numbers', () => {
      expect(formatNumber(42)).toBe('42');
    });
  });

  describe('formatTokens', () => {
    it('should format token counts', () => {
      expect(formatTokens(1000, 500)).toBe('1,000in/500out');
    });

    it('should format large numbers', () => {
      expect(formatTokens(178191, 83613)).toBe('178,191in/83,613out');
    });
  });

  describe('formatCost', () => {
    it('should format cost to 4 decimal places', () => {
      expect(formatCost(0.0234)).toBe('$0.0234');
    });

    it('should handle zero cost', () => {
      expect(formatCost(0)).toBe('$0.0000');
    });

    it('should handle larger costs', () => {
      expect(formatCost(1.5)).toBe('$1.5000');
    });
  });

  describe('formatTimestamp', () => {
    it('should format timestamp to time string', () => {
      const timestamp = new Date('2025-01-19T12:30:45').getTime();
      const result = formatTimestamp(timestamp);
      expect(result).toMatch(/12:30:45/);
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      const long = 'This is a very long string that needs truncating';
      expect(truncate(long, 20)).toBe('This is a very lo...');
    });

    it('should not truncate short strings', () => {
      expect(truncate('Short', 20)).toBe('Short');
    });

    it('should handle exact length', () => {
      expect(truncate('Exact', 5)).toBe('Exact');
    });
  });
});
