import React, { useEffect, useState } from 'react';
import { Text } from 'ink';
import chalk from 'chalk';

// Track process start time
const PROCESS_START = Date.now();

function elapsedSinceStart(): number {
  return (Date.now() - PROCESS_START) / 1000;
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
  const [, setTick] = useState(0);

  // Force re-render on animation frame
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000 / 30); // 30 FPS

    return () => clearInterval(interval);
  }, []);

  const chars = text.split('');
  if (chars.length === 0) {
    return null;
  }

  const period = chars.length + padding * 2;
  const elapsed = elapsedSinceStart();
  const posF = ((elapsed % sweepSeconds) / sweepSeconds) * period;
  const pos = Math.floor(posF);

  const trueColor = hasTrueColor();
  const baseColor = getDefaultFg();
  const highlightColor = getDefaultBg();

  const styledChars = chars.map((ch, i) => {
    const iPos = i + padding;
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

  return <>{styledChars}</>;
};
