import { logTelemetry } from './logger.js';
import type { EngineType } from '../../infra/engines/core/types.js';
import { isValidEngineType } from '../../infra/engines/core/types.js';

interface CapturedTelemetry {
  duration?: number;
  cost?: number;
  tokens?: {
    input: number;
    output: number;
    cached?: number;
  };
}

export interface TelemetryCapture {
  /**
   * Parses a streaming JSON line and captures telemetry data if present
   */
  captureFromStreamJson(line: string): void;

  /**
   * Gets the captured telemetry data
   */
  getCaptured(): CapturedTelemetry | null;

  /**
   * Logs the captured telemetry data to the telemetry log file
   */
  logCapturedTelemetry(exitCode: number): void;
}

/**
 * Creates a telemetry capture instance for an engine execution
 */
export function createTelemetryCapture(
  engine: EngineType,
  model: string | undefined,
  prompt: string,
  workingDir: string,
): TelemetryCapture {
  let captured: CapturedTelemetry | null = null;

  return {
    captureFromStreamJson(line: string): void {
      try {
        const json = JSON.parse(line);

        // Try parsing turn.completed format (used by some engines)
        if (json.type === 'turn.completed' && json.usage) {
          captured = {
            tokens: {
              input: json.usage.input_tokens,
              output: json.usage.output_tokens,
              cached: json.usage.cached_input_tokens,
            },
          };
        }
        // Try parsing result format with full telemetry (used by other engines)
        else if (json.type === 'result' && json.usage) {
          captured = {
            duration: json.duration_ms,
            cost: json.total_cost_usd,
            tokens: {
              input: json.usage.input_tokens,
              output: json.usage.output_tokens,
            },
          };
        }
      } catch {
        // Ignore JSON parse errors - not all lines will be valid JSON
      }
    },

    getCaptured(): CapturedTelemetry | null {
      return captured;
    },

    logCapturedTelemetry(exitCode: number): void {
      if (!captured || !captured.tokens) {
        return;
      }

      // Validate that token values are actual numbers
      if (typeof captured.tokens.input !== 'number' || typeof captured.tokens.output !== 'number') {
        return;
      }

      logTelemetry({
        engine,
        model: model || 'default',
        cost: captured.cost,
        duration: captured.duration,
        tokens: {
          input: captured.tokens.input,
          output: captured.tokens.output,
          cached: captured.tokens.cached,
        },
        exitCode,
        promptPreview: prompt,
        workingDir,
      });
    },
  };
}
