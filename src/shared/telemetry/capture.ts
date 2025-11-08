import { logTelemetry } from './logger.js';
import type { EngineType } from '../../infra/engines/index.js';
import { parseTelemetry as parseClaudeTelemetry } from '../../infra/engines/providers/claude/telemetryParser.js';
import { parseTelemetry as parseCodexTelemetry } from '../../infra/engines/providers/codex/telemetryParser.js';
import { parseTelemetry as parseOpenCodeTelemetry } from '../../infra/engines/providers/opencode/telemetryParser.js';
import { parseTelemetry as parseCCRTelemetry } from '../../infra/engines/providers/ccr/telemetryParser.js';
import { parseTelemetry as parseCursorTelemetry } from '../../infra/engines/providers/cursor/telemetryParser.js';

interface CapturedTelemetry {
  duration?: number;
  cost?: number;
  tokens?: {
    input: number;
    output: number;
    cached?: number;
  };
}

type TelemetryParser = (json: unknown) => CapturedTelemetry | null;

/**
 * Engine-specific telemetry parsers
 */
const telemetryParsers: Record<EngineType, TelemetryParser> = {
  claude: parseClaudeTelemetry,
  codex: parseCodexTelemetry,
  opencode: parseOpenCodeTelemetry,
  ccr: parseCCRTelemetry,
  cursor: parseCursorTelemetry,
};

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

        // Use engine-specific parser
        const parser = telemetryParsers[engine];
        const result = parser(json);
        if (result) {
          captured = result;
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
