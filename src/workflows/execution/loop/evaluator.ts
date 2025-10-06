import type { ModuleBehavior } from '../templates/index.js';

export interface LoopEvaluationOptions {
  behavior?: ModuleBehavior;
  output: string;
  iterationCount: number;
}

export interface LoopEvaluationResult {
  shouldRepeat: boolean;
  stepsBack: number;
  reason?: string;
}

const ANSI_ESCAPE_SEQUENCE = new RegExp(String.raw`\u001B\[[0-9;?]*[ -/]*[@-~]`, 'g');
const TELEMETRY_PREFIXES = [
  /^\[\d{4}-\d{2}-\d{2}T/i,
  /^tokens used:/i,
];

function normaliseOutput(output: string): string {
  const withoutAnsi = output.replace(ANSI_ESCAPE_SEQUENCE, '');
  const filteredLines = withoutAnsi
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !TELEMETRY_PREFIXES.some((pattern) => pattern.test(trimmed));
    })
    .join('\n');
  return filteredLines;
}

function extractLastToken(output: string): string {
  const trimmed = normaliseOutput(output).trim();
  if (!trimmed) return '';
  const segments = trimmed.split(/\s+/);
  return segments[segments.length - 1] ?? '';
}

export function evaluateLoopBehavior(options: LoopEvaluationOptions): LoopEvaluationResult | null {
  const { behavior, output, iterationCount } = options;

  if (!behavior || behavior.type !== 'loop' || behavior.action !== 'stepBack') {
    return null;
  }

  const trigger = behavior.trigger?.trim();
  if (!trigger) {
    return null;
  }

  const lastToken = extractLastToken(output);
  const triggerMatched = lastToken === trigger;

  if (!triggerMatched) {
    return {
      shouldRepeat: false,
      stepsBack: behavior.steps,
    };
  }

  const maxIterations =
    typeof behavior.maxIterations === 'number' && behavior.maxIterations > 0
      ? Math.floor(behavior.maxIterations)
      : undefined;

  if (maxIterations !== undefined && iterationCount + 1 > maxIterations) {
    return {
      shouldRepeat: false,
      stepsBack: behavior.steps,
      reason: `loop limit reached (${maxIterations})`,
    };
  }

  return {
    shouldRepeat: true,
    stepsBack: behavior.steps,
  };
}
