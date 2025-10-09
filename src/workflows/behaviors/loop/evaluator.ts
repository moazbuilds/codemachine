import type { ModuleBehavior } from '../../templates/index.js';

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
  /^⏱️\s*Tokens:/i,
];

const OUTPUT_PREFIXES = [/^💬\s*MESSAGE:\s*/i];

function isJsonTelemetry(line: string): boolean {
  if (!line.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(line);
    return parsed && typeof parsed === 'object' && ('type' in parsed || 'usage' in parsed);
  } catch {
    return false;
  }
}

function normaliseOutput(output: string): string[] {
  const withoutAnsi = output.replace(ANSI_ESCAPE_SEQUENCE, '');
  return withoutAnsi
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (line.length === 0) return false;
      if (TELEMETRY_PREFIXES.some((pattern) => pattern.test(line))) return false;
      if (isJsonTelemetry(line)) return false;
      return true;
    })
    .map((line) => {
      for (const prefix of OUTPUT_PREFIXES) {
        if (prefix.test(line)) {
          return line.replace(prefix, '').trim();
        }
      }
      return line;
    })
    .filter((line) => line.length > 0);
}

function containsTrigger(output: string, trigger: string): boolean {
  const lines = normaliseOutput(output);
  if (lines.length === 0) return false;

  for (const line of lines) {
    if (!line.includes(trigger)) {
      continue;
    }

    const tokens = line.split(/\s+/);
    for (const token of tokens) {
      const cleanedToken = token.replace(/^[^\w=]+/, '').replace(/[^\w=]+$/, '');
      if (cleanedToken === trigger) {
        return true;
      }
    }
  }

  return false;
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

  const triggerMatched = containsTrigger(output, trigger);

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
