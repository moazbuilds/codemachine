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
 * Parse Codex telemetry from streaming JSON
 *
 * Codex emits telemetry in "turn.completed" events with usage data
 */
export function parseTelemetry(json: unknown): CapturedTelemetry | null {
  // Type guard to check if json is an object with required properties
  if (
    typeof json === 'object' &&
    json !== null &&
    'type' in json &&
    (json as Record<string, unknown>).type === 'turn.completed' &&
    'usage' in json
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = json as Record<string, any>;
    return {
      tokens: {
        input: data.usage.input_tokens,
        output: data.usage.output_tokens,
        cached: data.usage.cached_input_tokens,
      },
    };
  }

  return null;
}
