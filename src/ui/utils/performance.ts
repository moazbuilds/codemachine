/**
 * Performance optimization utilities for Ink UI
 * Includes throttling, debouncing, and virtualization helpers
 */

/**
 * Circular buffer implementation for memory-efficient output storage
 * Maintains a fixed-size buffer by removing oldest items
 */
export class CircularBuffer<T> {
  private buffer: T[];
  private maxSize: number;

  constructor(maxSize: number) {
    this.buffer = [];
    this.maxSize = maxSize;
  }

  push(item: T): void {
    this.buffer.push(item);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getAll(): T[] {
    return [...this.buffer];
  }

  getSlice(start: number, end?: number): T[] {
    return this.buffer.slice(start, end);
  }

  clear(): void {
    this.buffer = [];
  }

  get length(): number {
    return this.buffer.length;
  }
}

/**
 * Throttle function to limit execution frequency
 * Ensures function is called at most once per interval
 */
export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function (this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
      func.apply(this, args);
    }
  };
}

/**
 * Debounce function to delay execution until after calls have stopped
 * Useful for batching rapid state updates
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func.apply(this, args);
      timeout = null;
    }, wait);
  };
}

/**
 * Virtual list helper for rendering large lists efficiently
 * Returns only the items that should be visible
 */
export function getVisibleItems<T>(
  items: T[],
  scrollOffset: number,
  viewportHeight: number
): { visibleItems: T[]; startIndex: number; endIndex: number } {
  const startIndex = Math.max(0, scrollOffset);
  const endIndex = Math.min(items.length, startIndex + viewportHeight);

  return {
    visibleItems: items.slice(startIndex, endIndex),
    startIndex,
    endIndex,
  };
}

/**
 * Batch update helper to group multiple state changes
 */
export class BatchUpdater {
  private updates: Array<() => void> = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private flushDelay: number;

  constructor(flushDelay: number = 50) {
    this.flushDelay = flushDelay;
  }

  schedule(update: () => void): void {
    this.updates.push(update);

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flush();
      }, this.flushDelay);
    }
  }

  flush(): void {
    const updates = this.updates.splice(0);
    updates.forEach((update) => update());

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  clear(): void {
    this.updates = [];
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
