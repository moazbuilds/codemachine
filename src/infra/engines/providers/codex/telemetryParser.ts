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
export function parseTelemetry(json: any): CapturedTelemetry | null {
  // Codex format: type: 'turn.completed' with usage
  if (json.type === 'turn.completed' && json.usage) {
    return {
      tokens: {
        input: json.usage.input_tokens,
        output: json.usage.output_tokens,
        cached: json.usage.cached_input_tokens,
      },
    };
  }

  return null;
}
