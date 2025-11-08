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
 * Parse Claude telemetry from streaming JSON
 *
 * Claude emits telemetry in "result" events with full usage data
 */
export function parseTelemetry(json: any): CapturedTelemetry | null {
  // Claude format: type: 'result' with detailed usage
  if (json.type === 'result' && json.usage) {
    // Calculate cached tokens from both cache_read_input_tokens and cache_creation_input_tokens
    const cachedTokens = (json.usage.cache_read_input_tokens || 0) + (json.usage.cache_creation_input_tokens || 0);

    return {
      duration: json.duration_ms,
      cost: json.total_cost_usd,
      tokens: {
        input: json.usage.input_tokens,
        output: json.usage.output_tokens,
        cached: cachedTokens > 0 ? cachedTokens : undefined,
      },
    };
  }

  return null;
}
