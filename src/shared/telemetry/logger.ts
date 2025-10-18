import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger } from '../logging/index.js';

export interface TelemetryData {
  engine: string;
  model?: string;
  cost?: number;
  duration?: number;
  tokens: {
    input: number;
    output: number;
    cached?: number;
  };
  exitCode: number;
  promptPreview?: string;
  workingDir: string;
}

/**
 * Logs telemetry data to .codemachine/logs/telemetry.log in the workspace
 */
export function logTelemetry(data: TelemetryData): void {
  try {
    const logDir = path.join(data.workingDir, '.codemachine', 'logs');
    const logFile = path.join(logDir, 'telemetry.log');

    console.error('[TELEMETRY DEBUG] logTelemetry called', {
      workingDir: data.workingDir,
      logDir,
      logFile,
    });

    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      console.error('[TELEMETRY DEBUG] Creating log directory:', logDir);
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Format telemetry entry
    const timestamp = new Date().toISOString();
    const model = data.model || 'default';
    const cost = data.cost !== undefined && typeof data.cost === 'number' ? `$${data.cost.toFixed(4)}` : 'N/A';
    const duration = data.duration !== undefined && typeof data.duration === 'number' ? `${data.duration}ms` : 'N/A';

    // Ensure token values are valid numbers
    const inputTokens = typeof data.tokens.input === 'number' ? data.tokens.input : 0;
    const outputTokens = typeof data.tokens.output === 'number' ? data.tokens.output : 0;
    const tokens = data.tokens.cached && typeof data.tokens.cached === 'number'
      ? `${inputTokens}in/${outputTokens}out (${data.tokens.cached} cached)`
      : `${inputTokens}in/${outputTokens}out`;

    const promptPreview = data.promptPreview
      ? `"${data.promptPreview.replace(/\n/g, ' ').substring(0, 50)}${data.promptPreview.length > 50 ? '...' : ''}"`
      : 'N/A';

    const logEntry = `[${timestamp}] Engine:${data.engine} Model:${model} Cost:${cost} Duration:${duration} Tokens:${tokens} ExitCode:${data.exitCode} Prompt:${promptPreview}\n`;

    // Append to log file
    fs.appendFileSync(logFile, logEntry, 'utf8');

    console.error('[TELEMETRY DEBUG] Telemetry written successfully to:', logFile);
    logger.debug(`Telemetry logged to ${logFile}`);
  } catch (error) {
    // Don't crash on logging errors, just log the error
    console.error('[TELEMETRY DEBUG] Failed to write telemetry:', error);
    logger.error('Failed to write telemetry log', { error });
  }
}
