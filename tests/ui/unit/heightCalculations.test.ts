import { describe, it, expect } from 'bun:test';
import {
  UI_COMPONENT_DIMENSIONS,
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
  describe('UI_COMPONENT_DIMENSIONS', () => {
    it('should have correct height constants', () => {
      expect(UI_COMPONENT_DIMENSIONS.BRANDING_HEADER).toBe(3);
      expect(UI_COMPONENT_DIMENSIONS.TELEMETRY_BAR).toBe(3);
      expect(UI_COMPONENT_DIMENSIONS.STATUS_FOOTER).toBe(2);
      expect(UI_COMPONENT_DIMENSIONS.OUTPUT_WINDOW_HEADER).toBe(1);
      expect(UI_COMPONENT_DIMENSIONS.BORDERS_AND_PADDING).toBe(2);
      expect(UI_COMPONENT_DIMENSIONS.MINIMUM_HEIGHT).toBe(8);
    });
  });

  describe('calculateMainContentHeight', () => {
    it('should calculate correct height for standard terminal', () => {
      const stdout = createMockStdout(40);
      const result = calculateMainContentHeight(stdout);

      // 40 - (3 + 3 + 2 + 2) = 30
      expect(result).toBe(30);
    });

    it('should respect minimum height', () => {
      const stdout = createMockStdout(10);
      const result = calculateMainContentHeight(stdout);

      // 10 - 10 = 0, but minimum is 8
      expect(result).toBe(8);
    });

    it('should handle very small terminals', () => {
      const stdout = createMockStdout(5);
      const result = calculateMainContentHeight(stdout);

      // Should return minimum height
      expect(result).toBe(8);
    });

    it('should handle large terminals', () => {
      const stdout = createMockStdout(100);
      const result = calculateMainContentHeight(stdout);

      // 100 - 10 = 90
      expect(result).toBe(90);
    });

    it('should handle null stdout', () => {
      const result = calculateMainContentHeight(null);

      // Should use default 40 - 10 = 30
      expect(result).toBe(30);
    });

    it('should handle undefined stdout', () => {
      const result = calculateMainContentHeight(undefined);

      // Should use default 40 - 10 = 30
      expect(result).toBe(30);
    });
  });

  describe('calculateOutputWindowHeight', () => {
    it('should calculate correct height for standard terminal', () => {
      const stdout = createMockStdout(40);
      const result = calculateOutputWindowHeight(stdout);

      // Main content: 30, Output overhead: 1, so 30 - 1 = 29
      expect(result).toBe(29);
    });

    it('should respect minimum height of 4', () => {
      const stdout = createMockStdout(10);
      const result = calculateOutputWindowHeight(stdout);

      // Main content: 8, Output overhead: 1, so 8 - 1 = 7, minimum is 4
      expect(result).toBe(7);
    });

    it('should handle very small terminals', () => {
      const stdout = createMockStdout(8);
      const result = calculateOutputWindowHeight(stdout);

      // Main content: 8 (minimum), Output overhead: 1, so 8 - 1 = 7
      expect(result).toBe(7);
    });

    it('should handle large terminals', () => {
      const stdout = createMockStdout(100);
      const result = calculateOutputWindowHeight(stdout);

      // Main content: 90, Output overhead: 1, so 90 - 1 = 89
      expect(result).toBe(89);
    });
  });

  describe('calculateAgentTimelineHeight', () => {
    it('should calculate correct height for standard terminal', () => {
      const stdout = createMockStdout(40);
      const result = calculateAgentTimelineHeight(stdout);

      // Main content: 30, Timeline overhead: 1, so 30 - 1 = 29
      expect(result).toBe(29);
    });

    it('should respect minimum height of 4', () => {
      const stdout = createMockStdout(10);
      const result = calculateAgentTimelineHeight(stdout);

      // Main content: 8, Timeline overhead: 1, so 8 - 1 = 7, minimum is 4
      expect(result).toBe(7);
    });

    it('should handle very small terminals', () => {
      const stdout = createMockStdout(6);
      const result = calculateAgentTimelineHeight(stdout);

      // Main content: 8 (minimum), Timeline overhead: 1, so 8 - 1 = 7
      expect(result).toBe(7);
    });

    it('should handle large terminals', () => {
      const stdout = createMockStdout(100);
      const result = calculateAgentTimelineHeight(stdout);

      // Main content: 90, Timeline overhead: 1, so 90 - 1 = 89
      expect(result).toBe(89);
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
      expect(info.mainContentHeight).toBe(30);
      expect(info.outputWindowHeight).toBe(29);
      expect(info.agentTimelineHeight).toBe(29);
    });

    it('should detect small terminals correctly', () => {
      const stdout = createMockStdout(12);
      const info = getTerminalInfo(stdout);

      expect(info.isTooSmall).toBe(true);
      expect(info.mainContentHeight).toBe(8); // minimum
      expect(info.outputWindowHeight).toBe(7); // 8 - 1 = 7
      expect(info.agentTimelineHeight).toBe(7); // 8 - 1 = 7
    });

    it('should handle null stdout', () => {
      const info = getTerminalInfo(null);

      expect(info.rows).toBe(40);
      expect(info.columns).toBe(80);
      expect(info.isTooSmall).toBe(false);
      expect(info.mainContentHeight).toBe(30);
      expect(info.outputWindowHeight).toBe(29);
      expect(info.agentTimelineHeight).toBe(29);
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
        expect(mainContent).toBeGreaterThanOrEqual(8);
        expect(outputWindow).toBeGreaterThanOrEqual(4);
        expect(timeline).toBeGreaterThanOrEqual(4);
      });
    });
  });
});