import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Text } from 'ink';
import chalk from 'chalk';

// Track process start time
const PROCESS_START = Date.now();

function elapsedSinceStart(): number {
  return (Date.now() - PROCESS_START) / 1000;
}

// Easing function for smoother motion
function easeInOutSine(x: number): number {
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

// Color blending utility
function blend(
  color1: [number, number, number],
  color2: [number, number, number],
  ratio: number
): [number, number, number] {
  const r = Math.round(color1[0] * ratio + color2[0] * (1 - ratio));
  const g = Math.round(color1[1] * ratio + color2[1] * (1 - ratio));
  const b = Math.round(color1[2] * ratio + color2[2] * (1 - ratio));
  return [r, g, b];
}

// Detect color support
function hasTrueColor(): boolean {
  return chalk.level >= 3;
}

// Get default colors (fallback values)
function getDefaultFg(): [number, number, number] {
  return [128, 128, 128];
}

function getDefaultBg(): [number, number, number] {
  return [255, 255, 255];
}

export interface ShimmerTextProps {
  text: string;
  sweepSeconds?: number;
  bandHalfWidth?: number;
  padding?: number;
}

/**
 * Animated shimmer text component
 * Creates a smooth wave effect sweeping across the text
 */
export const ShimmerText: React.FC<ShimmerTextProps> = ({
  text,
  sweepSeconds = 2.0,
  bandHalfWidth = 5.0,
  padding = 10,
}) => {
  const [animationFrame, setAnimationFrame] = useState(0);
  const lastUpdateTime = useRef(0);
  const frameSkipThreshold = 1000 / 45; // Update at most 45 times per second (smoother than forcing 60)

  // Optimized animation loop with frame skipping to prevent rendering overload
  useEffect(() => {
    let animationId: NodeJS.Timeout;

    const animate = () => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTime.current;

      // Only update if enough time has passed (prevents Ink rendering overload)
      if (timeSinceLastUpdate >= frameSkipThreshold) {
        lastUpdateTime.current = now;
        setAnimationFrame((f) => f + 1);
      }
    };

    // Use 60 FPS interval but skip frames if Ink is slow
    animationId = setInterval(animate, 1000 / 60);

    return () => clearInterval(animationId);
  }, [frameSkipThreshold]);

  const chars = useMemo(() => text.split(''), [text]);

  if (chars.length === 0) {
    return null;
  }

  // Memoize expensive calculations
  const styledChars = useMemo(() => {
    const period = chars.length + padding * 2;
    const elapsed = elapsedSinceStart();

    // Apply easing for smoother acceleration/deceleration
    const progress = (elapsed % sweepSeconds) / sweepSeconds;
    const easedProgress = easeInOutSine(progress);
    const pos = easedProgress * period;

    const trueColor = hasTrueColor();
    const baseColor = getDefaultFg();
    const highlightColor = getDefaultBg();

    return chars.map((ch, i) => {
      const iPos = i + padding;
      // Calculate distance using floating-point position for smooth interpolation
      const dist = Math.abs(iPos - pos);

      let t: number;
      if (dist <= bandHalfWidth) {
        const x = Math.PI * (dist / bandHalfWidth);
        t = 0.5 * (1.0 + Math.cos(x));
      } else {
        t = 0.0;
      }

      if (trueColor) {
        const highlight = Math.max(0, Math.min(1, t));
        const [r, g, b] = blend(highlightColor, baseColor, highlight * 0.9);
        return (
          <Text key={i} bold color={`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`}>
            {ch}
          </Text>
        );
      } else {
        // Fallback styling without true color
        if (t < 0.2) {
          return (
            <Text key={i} dimColor>
              {ch}
            </Text>
          );
        } else if (t < 0.6) {
          return <Text key={i}>{ch}</Text>;
        } else {
          return (
            <Text key={i} bold>
              {ch}
            </Text>
          );
        }
      }
    });
  }, [animationFrame, chars, padding, sweepSeconds, bandHalfWidth]);

  return <>{styledChars}</>;
};
