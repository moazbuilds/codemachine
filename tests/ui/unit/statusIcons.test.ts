import { describe, it, expect } from 'bun:test';
import { getStatusIcon, getStatusColor } from '../../../src/ui/utils/statusIcons';

describe('StatusIcons', () => {
  describe('getStatusIcon', () => {
    it('should return correct icon for pending', () => {
      expect(getStatusIcon('pending')).toBe('○');
    });

    it('should return correct icon for running', () => {
      expect(getStatusIcon('running')).toBe('⠋');
    });

    it('should return correct icon for completed', () => {
      expect(getStatusIcon('completed')).toBe('●');
    });

    it('should return correct icon for skipped', () => {
      expect(getStatusIcon('skipped')).toBe('●');
    });

    it('should return correct icon for retrying', () => {
      expect(getStatusIcon('retrying')).toBe('⟳');
    });
  });

  describe('getStatusColor', () => {
    it('should return green for completed', () => {
      expect(getStatusColor('completed')).toBe('green');
    });

    it('should return blue for running', () => {
      expect(getStatusColor('running')).toBe('blue');
    });

    it('should return white for other statuses', () => {
      expect(getStatusColor('pending')).toBe('white');
      expect(getStatusColor('skipped')).toBe('white');
      expect(getStatusColor('retrying')).toBe('white');
    });
  });
});
