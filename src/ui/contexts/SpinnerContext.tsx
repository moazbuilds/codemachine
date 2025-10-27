import React, { createContext, useContext, useState, useEffect } from 'react';
import { Text } from 'ink';
import { getFrameScheduler } from '../utils/frameScheduler';

/**
 * Shared spinner context - Uses unified frame scheduler
 * Replaces ink-spinner with a lightweight implementation that shares state
 *
 * Performance Evolution:
 * - Phase 1: 10 agents with individual spinners = 10 timers
 *            10 agents with shared spinner = 1 timer (90% reduction!)
 * - Phase 3: Spinner + Shimmer use unified frame scheduler = 1 timer total
 *            Perfect synchronization, no timer competition
 */

interface SpinnerContextValue {
  frame: number;
  globalFrame: number; // Access to global frame counter for custom animations
}

const SpinnerContext = createContext<SpinnerContextValue>({ frame: 0, globalFrame: 0 });

export const SpinnerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [frame, setFrame] = useState(0);
  const [globalFrame, setGlobalFrame] = useState(0);

  useEffect(() => {
    // Subscribe to unified frame scheduler with HIGH priority (spinners always animate)
    const scheduler = getFrameScheduler();

    const unsubscribe = scheduler.subscribe((currentFrame) => {
      // Spinner speed: 35% faster than original (80ms → 52ms)
      // At 60 FPS, each frame = 16.67ms
      // 3 frames = ~50ms per spinner update
      const spinnerFrame = Math.floor(currentFrame / 3) % 10;

      setFrame(spinnerFrame);
      setGlobalFrame(currentFrame);
    }, 'high'); // High priority = never skip frames

    return unsubscribe;
  }, []);

  return (
    <SpinnerContext.Provider value={{ frame, globalFrame }}>
      {children}
    </SpinnerContext.Provider>
  );
};

/**
 * Lightweight shared spinner component
 * No internal timer - reads from shared context
 * Uses same "dots" animation as ink-spinner
 */
export const SharedSpinner: React.FC = () => {
  const { frame } = useContext(SpinnerContext);

  // Same dot frames as ink-spinner "dots" type
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  return <Text>{frames[frame]}</Text>;
};

/**
 * Hook to access spinner frame directly
 * Useful for custom animations synchronized with spinner
 */
export const useSpinnerFrame = (): number => {
  const { frame } = useContext(SpinnerContext);
  return frame;
};

/**
 * Hook to access global frame counter
 * Useful for custom animations that need access to the unified frame scheduler
 */
export const useGlobalFrame = (): number => {
  const { globalFrame } = useContext(SpinnerContext);
  return globalFrame;
};
