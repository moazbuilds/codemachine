/**
 * Parsed telemetry data from engine output
 */
export interface ParsedTelemetry {
  tokensIn: number;
  tokensOut: number;
  cached?: number;
  cost?: number;
  duration?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

/**
 * Extract telemetry from any engine output
 * Universal pattern: "Tokens: XXXin/YYYout" or "XXXin/YYYout"
 * Optional: "(ZZZ cached)" or "Cost: $X.XX" or "Duration: XXXms"
 */
export function parseTelemetryChunk(chunk: string): ParsedTelemetry | null {
  // Pattern: "Tokens: 1234in/567out" or "1234in/567out"
  const tokensMatch = chunk.match(/Tokens:\s*(\d+(?:,\d{3})*)in\/(\d+(?:,\d{3})*)out/i);
  if (!tokensMatch) return null;

  const tokensIn = parseInt(tokensMatch[1].replace(/,/g, ''), 10);
  const tokensOut = parseInt(tokensMatch[2].replace(/,/g, ''), 10);

  const result: ParsedTelemetry = { tokensIn, tokensOut };

  // Optional: cached tokens - "(100 cached)"
  const cachedMatch = chunk.match(/\((\d+(?:,\d{3})*)\s*cached\)/i);
  if (cachedMatch) {
    result.cached = parseInt(cachedMatch[1].replace(/,/g, ''), 10);
  }

  // Optional: cost - "Cost: $0.0234"
  const costMatch = chunk.match(/Cost:\s*\$(\d+\.\d+)/i);
  if (costMatch) {
    result.cost = parseFloat(costMatch[1]);
  }

  // Optional: duration - "Duration: 1234ms"
  const durationMatch = chunk.match(/Duration:\s*(\d+)ms/i);
  if (durationMatch) {
    result.duration = parseInt(durationMatch[1], 10) / 1000; // Convert to seconds
  }

  return result;
}
