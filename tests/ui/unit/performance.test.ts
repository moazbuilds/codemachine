import { describe, it, expect, mock } from 'bun:test';
import {
  CircularBuffer,
  throttle,
  debounce,
  getVisibleItems,
  BatchUpdater,
} from '../../../src/ui/utils/performance';

describe('Performance Utilities', () => {
  describe('CircularBuffer', () => {
    it('should maintain max size', () => {
      const buffer = new CircularBuffer<number>(3);

      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      expect(buffer.length).toBe(3);

      buffer.push(4);
      expect(buffer.length).toBe(3);
      expect(buffer.getAll()).toEqual([2, 3, 4]);
    });

    it('should clear buffer', () => {
      const buffer = new CircularBuffer<string>(5);
      buffer.push('a');
      buffer.push('b');
      buffer.clear();

      expect(buffer.length).toBe(0);
      expect(buffer.getAll()).toEqual([]);
    });

    it('should return slices', () => {
      const buffer = new CircularBuffer<number>(10);
      [1, 2, 3, 4, 5].forEach((n) => buffer.push(n));

      expect(buffer.getSlice(1, 3)).toEqual([2, 3]);
      expect(buffer.getSlice(2)).toEqual([3, 4, 5]);
    });
  });

  describe('throttle', () => {
    it('should limit function calls', async () => {
      const fn = mock();
      const throttled = throttle(fn, 100);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(1);

      await new Promise((resolve) => setTimeout(resolve, 150));
      throttled();

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('debounce', () => {
    it('should delay execution until calls stop', async () => {
      const fn = mock();
      const debounced = debounce(fn, 50);

      debounced();
      debounced();
      debounced();

      expect(fn).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('getVisibleItems', () => {
    it('should return visible items for virtualization', () => {
      const items = Array.from({ length: 100 }, (_, i) => i);

      const result = getVisibleItems(items, 10, 20);

      expect(result.visibleItems).toEqual(items.slice(10, 30));
      expect(result.startIndex).toBe(10);
      expect(result.endIndex).toBe(30);
    });

    it('should handle edge cases', () => {
      const items = [1, 2, 3, 4, 5];

      const result = getVisibleItems(items, 0, 10);

      expect(result.visibleItems).toEqual(items);
      expect(result.startIndex).toBe(0);
      expect(result.endIndex).toBe(5);
    });
  });

  describe('BatchUpdater', () => {
    it('should batch updates', async () => {
      const updater = new BatchUpdater(50);
      const fn1 = mock();
      const fn2 = mock();

      updater.schedule(fn1);
      updater.schedule(fn2);

      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).not.toHaveBeenCalled();

      // Wait for batch to execute
      await new Promise(resolve => setTimeout(resolve, 60));

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
    });

    it('should flush immediately when requested', () => {
      const updater = new BatchUpdater(100);
      const fn = mock();

      updater.schedule(fn);
      expect(fn).not.toHaveBeenCalled();

      updater.flush();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should clear pending updates', async () => {
      const updater = new BatchUpdater(50);
      const fn = mock();

      updater.schedule(fn);
      updater.clear();

      await new Promise(resolve => setTimeout(resolve, 60));
      expect(fn).not.toHaveBeenCalled();
    });
  });
});
