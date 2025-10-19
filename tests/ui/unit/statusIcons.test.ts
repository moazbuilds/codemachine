import { describe, it, expect } from 'vitest';
import { getStatusIcon, getStatusColor } from '../../../src/ui/utils/statusIcons';
import type { AgentStatus } from '../../../src/ui/state/types';

describe('StatusIcons', () => {
  describe('getStatusIcon', () => {
    it('should return correct icon for pending', () => {
      expect(getStatusIcon('pending')).toBe('○');
    });

    it('should return correct icon for running', () => {
      expect(getStatusIcon('running')).toBe('⠋');
    });

    it('should return correct icon for completed', () => {
      expect(getStatusIcon('completed')).toBe('✓');
    });

    it('should return correct icon for failed', () => {
      expect(getStatusIcon('failed')).toBe('✗');
    });

    it('should return correct icon for skipped', () => {
      expect(getStatusIcon('skipped')).toBe('●');
    });

    it('should return correct icon for paused', () => {
      expect(getStatusIcon('paused')).toBe('⏸');
    });

    it('should return correct icon for retrying', () => {
      expect(getStatusIcon('retrying')).toBe('⟳');
    });
  });

  describe('getStatusColor', () => {
    it('should return green for completed', () => {
      expect(getStatusColor('completed')).toBe('green');
    });

    it('should return red for failed', () => {
      expect(getStatusColor('failed')).toBe('red');
    });

    it('should return blue for running', () => {
      expect(getStatusColor('running')).toBe('blue');
    });

    it('should return yellow for paused', () => {
      expect(getStatusColor('paused')).toBe('yellow');
    });

    it('should return white for other statuses', () => {
      expect(getStatusColor('pending')).toBe('white');
      expect(getStatusColor('skipped')).toBe('white');
      expect(getStatusColor('retrying')).toBe('white');
    });
  });
});
