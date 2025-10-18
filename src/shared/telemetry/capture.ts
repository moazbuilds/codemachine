import { logTelemetry } from './logger.js';

type EngineType = 'codex' | 'cursor' | 'claude';

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

        // Codex format: look for turn.completed with usage
        if (engine === 'codex') {
          if (json.type === 'turn.completed' && json.usage) {
            captured = {
              tokens: {
                input: json.usage.input_tokens,
                output: json.usage.output_tokens,
                cached: json.usage.cached_input_tokens,
              },
            };
          }
        }
        // Cursor and Claude format: look for result type with full telemetry
        else if (engine === 'cursor' || engine === 'claude') {
          if (json.type === 'result' && json.usage) {
            console.error('[TELEMETRY DEBUG] Captured telemetry:', {
              duration: json.duration_ms,
              cost: json.total_cost_usd,
              input: json.usage.input_tokens,
              output: json.usage.output_tokens,
            });
            captured = {
              duration: json.duration_ms,
              cost: json.total_cost_usd,
              tokens: {
                input: json.usage.input_tokens,
                output: json.usage.output_tokens,
              },
            };
          }
        }
      } catch {
        // Ignore JSON parse errors - not all lines will be valid JSON
      }
    },

    logCapturedTelemetry(exitCode: number): void {
      console.error('[TELEMETRY DEBUG] logCapturedTelemetry called', {
        hasCaptured: !!captured,
        hasTokens: !!captured?.tokens,
        exitCode,
        workingDir,
      });

      if (!captured || !captured.tokens) {
        console.error('[TELEMETRY DEBUG] No telemetry captured, skipping log');
        return;
      }

      // Validate that token values are actual numbers
      if (typeof captured.tokens.input !== 'number' || typeof captured.tokens.output !== 'number') {
        console.error('[TELEMETRY DEBUG] Invalid token values:', captured.tokens);
        return;
      }

      console.error('[TELEMETRY DEBUG] Writing telemetry to file...');
      logTelemetry({
        engine,
        model: model || (engine === 'cursor' ? 'auto' : 'default'),
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
