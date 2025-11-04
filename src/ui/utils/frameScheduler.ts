/**
 * Unified Frame Scheduler
 *
 * Single animation loop for ALL UI animations (spinners, shimmer, etc.)
 * Eliminates timer competition and provides priority-based frame skipping
 *
 * Performance: 2 independent timers → 1 unified loop (50% reduction)
 */

export type AnimationPriority = 'high' | 'medium' | 'low';

interface FrameSubscriber {
  callback: (frame: number) => void;
  priority: AnimationPriority;
  lastFrame: number;
}

/**
 * Frame Scheduler manages a single global animation timer
 * Components subscribe with priority levels for adaptive frame skipping
 */
export class FrameScheduler {
  private frame: number = 0;
  private subscribers: Map<symbol, FrameSubscriber> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private targetFPS: number = 60;
  private lastFrameTime: number = 0;
  private adaptiveFrameRate: number = 60;

  constructor() {
    this.start();
  }

  /**
   * Start the global animation loop
   */
  private start(): void {
    if (this.intervalId) return;

    const interval = 1000 / this.targetFPS;
    this.intervalId = setInterval(() => {
      const now = Date.now();
      const elapsed = now - this.lastFrameTime;
      this.lastFrameTime = now;

      this.frame++;

      // Adaptive frame rate adjustment based on performance
      this.adjustFrameRate(elapsed);

      // Notify subscribers with priority-based frame skipping
      this.notifySubscribers();
    }, interval);
  }

  /**
   * Adjust frame rate based on actual render performance
   */
  private adjustFrameRate(elapsed: number): void {
    // If rendering is slow, reduce effective frame rate
    if (elapsed > 33) {
      // Slower than 30 FPS
      this.adaptiveFrameRate = 15;
    } else if (elapsed > 16) {
      // Slower than 60 FPS
      this.adaptiveFrameRate = 30;
    } else {
      this.adaptiveFrameRate = 60;
    }
  }

  /**
   * Notify subscribers based on priority and adaptive frame rate
   */
  private notifySubscribers(): void {
    const skipFactor = Math.max(1, Math.floor(this.targetFPS / this.adaptiveFrameRate));

    for (const [_id, subscriber] of this.subscribers) {
      // Priority-based frame skipping
      let shouldNotify = false;

      switch (subscriber.priority) {
        case 'high':
          // High priority: Always notify (spinners)
          shouldNotify = true;
          break;
        case 'medium':
          // Medium priority: Skip frames when slow (shimmer)
          shouldNotify = this.frame % skipFactor === 0;
          break;
        case 'low':
          // Low priority: Skip more aggressively (off-screen animations)
          shouldNotify = this.frame % (skipFactor * 2) === 0;
          break;
      }

      if (shouldNotify) {
        subscriber.lastFrame = this.frame;
        subscriber.callback(this.frame);
      }
    }
  }

  /**
   * Subscribe to frame updates
   * Returns an unsubscribe function
   */
  subscribe(callback: (frame: number) => void, priority: AnimationPriority = 'medium'): () => void {
    const id = Symbol('subscriber');
    this.subscribers.set(id, {
      callback,
      priority,
      lastFrame: this.frame,
    });

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(id);
    };
  }

  /**
   * Stop the animation loop (for cleanup)
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Get current frame number
   */
  getFrame(): number {
    return this.frame;
  }

  /**
   * Get current adaptive frame rate
   */
  getCurrentFrameRate(): number {
    return this.adaptiveFrameRate;
  }
}

// Global singleton instance
let globalScheduler: FrameScheduler | null = null;

/**
 * Get the global frame scheduler instance
 */
export function getFrameScheduler(): FrameScheduler {
  if (!globalScheduler) {
    globalScheduler = new FrameScheduler();
  }
  return globalScheduler;
}

/**
 * Hook to subscribe to frame updates with priority
 * Use this in React components for animation
 */
export function useFrameScheduler(
  callback: (frame: number) => void,
  priority: AnimationPriority = 'medium',
  enabled: boolean = true
): (() => void) | undefined {
  const scheduler = getFrameScheduler();

  if (enabled) {
    const unsubscribe = scheduler.subscribe(callback, priority);
    return unsubscribe;
  }
  return undefined;
}
