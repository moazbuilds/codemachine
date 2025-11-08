interface CapturedTelemetry {
  duration?: number;
  cost?: number;
  tokens?: {
    input: number;
    output: number;
    cached?: number;
  };
}

/**
 * Parse OpenCode telemetry from streaming JSON
 *
 * OpenCode emits telemetry in "step_finish" events with nested tokens in part.tokens
 */
export function parseTelemetry(json: unknown): CapturedTelemetry | null {
  // Type guard to check if json is an object with required properties
  if (
    typeof json === 'object' &&
    json !== null &&
    'type' in json &&
    (json as Record<string, unknown>).type === 'step_finish' &&
    'part' in json
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = json as Record<string, any>;
    if (data.part?.tokens) {
      const tokens = data.part.tokens;
      const cache = (tokens.cache?.read || 0) + (tokens.cache?.write || 0);

      return {
        tokens: {
          input: tokens.input,
          output: tokens.output,
          cached: cache > 0 ? cache : undefined,
        },
        cost: data.part.cost,
      };
    }
  }

  return null;
}
