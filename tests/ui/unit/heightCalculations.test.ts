import { describe, it, expect } from 'vitest';
import {
  UI_COMPONENT_HEIGHTS,
  calculateMainContentHeight,
  calculateOutputWindowHeight,
  calculateAgentTimelineHeight,
  isTerminalTooSmall,
  getTerminalInfo,
} from '../../../src/ui/utils/heightCalculations';

// Mock stdout object
const createMockStdout = (rows: number, columns: number = 80) => ({
  rows,
  columns,
});

describe('Height Calculations', () => {
  describe('UI_COMPONENT_HEIGHTS', () => {
    it('should have correct height constants', () => {
      expect(UI_COMPONENT_HEIGHTS.BRANDING_HEADER).toBe(3);
      expect(UI_COMPONENT_HEIGHTS.TELEMETRY_BAR).toBe(2);
      expect(UI_COMPONENT_HEIGHTS.STATUS_FOOTER).toBe(1);
      expect(UI_COMPONENT_HEIGHTS.OUTPUT_WINDOW_HEADER).toBe(2);
      expect(UI_COMPONENT_HEIGHTS.BORDERS_AND_PADDING).toBe(2);
      expect(UI_COMPONENT_HEIGHTS.MINIMUM_HEIGHT).toBe(10);
    });
  });

  describe('calculateMainContentHeight', () => {
    it('should calculate correct height for standard terminal', () => {
      const stdout = createMockStdout(40);
      const result = calculateMainContentHeight(stdout);

      // 40 - (3 + 2 + 1) = 34
      expect(result).toBe(34);
    });

    it('should respect minimum height', () => {
      const stdout = createMockStdout(10);
      const result = calculateMainContentHeight(stdout);

      // 10 - 6 = 4, but minimum is 10
      expect(result).toBe(10);
    });

    it('should handle very small terminals', () => {
      const stdout = createMockStdout(5);
      const result = calculateMainContentHeight(stdout);

      // Should return minimum height
      expect(result).toBe(10);
    });

    it('should handle large terminals', () => {
      const stdout = createMockStdout(100);
      const result = calculateMainContentHeight(stdout);

      // 100 - 6 = 94
      expect(result).toBe(94);
    });

    it('should handle null stdout', () => {
      const result = calculateMainContentHeight(null);

      // Should use default 40 - 6 = 34
      expect(result).toBe(34);
    });

    it('should handle undefined stdout', () => {
      const result = calculateMainContentHeight(undefined);

      // Should use default 40 - 6 = 34
      expect(result).toBe(34);
    });
  });

  describe('calculateOutputWindowHeight', () => {
    it('should calculate correct height for standard terminal', () => {
      const stdout = createMockStdout(40);
      const result = calculateOutputWindowHeight(stdout);

      // Main content: 34, Output overhead: 2 + 2 = 4, so 34 - 4 = 30
      expect(result).toBe(30);
    });

    it('should respect minimum height of 5', () => {
      const stdout = createMockStdout(10);
      const result = calculateOutputWindowHeight(stdout);

      // Main content: 10, Output overhead: 4, so 10 - 4 = 6, but minimum is 5
      expect(result).toBe(6);
    });

    it('should handle very small terminals', () => {
      const stdout = createMockStdout(8);
      const result = calculateOutputWindowHeight(stdout);

      // Main content: 10 (minimum), Output overhead: 4, so 10 - 4 = 6
      expect(result).toBe(6);
    });

    it('should handle large terminals', () => {
      const stdout = createMockStdout(100);
      const result = calculateOutputWindowHeight(stdout);

      // Main content: 94, Output overhead: 4, so 94 - 4 = 90
      expect(result).toBe(90);
    });
  });

  describe('calculateAgentTimelineHeight', () => {
    it('should calculate correct height for standard terminal', () => {
      const stdout = createMockStdout(40);
      const result = calculateAgentTimelineHeight(stdout);

      // Main content: 34, Timeline overhead: 2, so 34 - 2 = 32
      expect(result).toBe(32);
    });

    it('should respect minimum height of 5', () => {
      const stdout = createMockStdout(10);
      const result = calculateAgentTimelineHeight(stdout);

      // Main content: 10, Timeline overhead: 2, so 10 - 2 = 8, but minimum is 5
      expect(result).toBe(8);
    });

    it('should handle very small terminals', () => {
      const stdout = createMockStdout(6);
      const result = calculateAgentTimelineHeight(stdout);

      // Main content: 10 (minimum), Timeline overhead: 2, so 10 - 2 = 8
      expect(result).toBe(8);
    });

    it('should handle large terminals', () => {
      const stdout = createMockStdout(100);
      const result = calculateAgentTimelineHeight(stdout);

      // Main content: 94, Timeline overhead: 2, so 94 - 2 = 92
      expect(result).toBe(92);
    });
  });

  describe('isTerminalTooSmall', () => {
    it('should return false for standard terminals', () => {
      expect(isTerminalTooSmall(createMockStdout(40))).toBe(false);
      expect(isTerminalTooSmall(createMockStdout(20))).toBe(false);
      expect(isTerminalTooSmall(createMockStdout(15))).toBe(false);
    });

    it('should return true for very small terminals', () => {
      expect(isTerminalTooSmall(createMockStdout(14))).toBe(true);
      expect(isTerminalTooSmall(createMockStdout(10))).toBe(true);
      expect(isTerminalTooSmall(createMockStdout(5))).toBe(true);
    });

    it('should handle null stdout', () => {
      expect(isTerminalTooSmall(null)).toBe(false);
    });
  });

  describe('getTerminalInfo', () => {
    it('should return comprehensive terminal information', () => {
      const stdout = createMockStdout(40, 120);
      const info = getTerminalInfo(stdout);

      expect(info.rows).toBe(40);
      expect(info.columns).toBe(120);
      expect(info.isTooSmall).toBe(false);
      expect(info.mainContentHeight).toBe(34);
      expect(info.outputWindowHeight).toBe(30);
      expect(info.agentTimelineHeight).toBe(32);
    });

    it('should detect small terminals correctly', () => {
      const stdout = createMockStdout(12);
      const info = getTerminalInfo(stdout);

      expect(info.isTooSmall).toBe(true);
      expect(info.mainContentHeight).toBe(10); // minimum
      expect(info.outputWindowHeight).toBe(6); // 10 - 4 = 6
      expect(info.agentTimelineHeight).toBe(8); // 10 - 2 = 8
    });

    it('should handle null stdout', () => {
      const info = getTerminalInfo(null);

      expect(info.rows).toBe(40);
      expect(info.columns).toBe(80);
      expect(info.isTooSmall).toBe(false);
      expect(info.mainContentHeight).toBe(34);
      expect(info.outputWindowHeight).toBe(30);
      expect(info.agentTimelineHeight).toBe(32);
    });
  });

  describe('Height Consistency', () => {
    it('should maintain consistent calculations across different terminal sizes', () => {
      const testSizes = [15, 20, 25, 30, 40, 50, 100];

      testSizes.forEach(size => {
        const stdout = createMockStdout(size);
        const mainContent = calculateMainContentHeight(stdout);
        const outputWindow = calculateOutputWindowHeight(stdout);
        const timeline = calculateAgentTimelineHeight(stdout);

        // Output window and timeline should both be less than main content
        expect(outputWindow).toBeLessThanOrEqual(mainContent);
        expect(timeline).toBeLessThanOrEqual(mainContent);

        // All should be at least their minimum values
        expect(mainContent).toBeGreaterThanOrEqual(10);
        expect(outputWindow).toBeGreaterThanOrEqual(5);
        expect(timeline).toBeGreaterThanOrEqual(5);
      });
    });
  });
});