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
export function parseTelemetry(json: any): CapturedTelemetry | null {
  // OpenCode format: type: 'step_finish' with part.tokens
  if (json.type === 'step_finish' && json.part?.tokens) {
    const tokens = json.part.tokens;
    const cache = (tokens.cache?.read || 0) + (tokens.cache?.write || 0);

    return {
      tokens: {
        input: tokens.input,
        output: tokens.output,
        cached: cache > 0 ? cache : undefined,
      },
      cost: json.part.cost,
    };
  }

  return null;
}
