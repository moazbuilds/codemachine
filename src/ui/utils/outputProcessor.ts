import { parseTelemetryChunk, ParsedTelemetry } from './telemetryParser';
import { SYMBOL_BULLET, SYMBOL_NEST, parseMarker } from '../../shared/formatters/outputMarkers.js';

export type OutputChunkType = 'text' | 'tool' | 'thinking' | 'telemetry' | 'error';

export interface ProcessedChunk {
  type: OutputChunkType;
  content: string;
  telemetry?: ParsedTelemetry;
  toolName?: string;
}

/**
 * Process engine output chunk to determine type and extract data
 */
export function processOutputChunk(chunk: string): ProcessedChunk {
  // Handle null/undefined input gracefully
  if (!chunk || typeof chunk !== 'string') {
    return {
      type: 'text',
      content: '',
    };
  }

  const trimmed = chunk.trim();

  // Parse color marker if present
  const { color, text } = parseMarker(trimmed);

  // Detect tool/command usage (new format with bullet symbol)
  if (text.includes(`${SYMBOL_BULLET} Command:`)) {
    const commandMatch = text.match(/● Command:\s*(.+)/);
    return {
      type: 'tool',
      content: trimmed,
      toolName: commandMatch ? commandMatch[1] : undefined,
    };
  }

  // Detect nested results (new format with nest symbol)
  if (text.includes(SYMBOL_NEST)) {
    // Results are errors if they have red color marker
    const isError = color === 'red';
    return {
      type: isError ? 'error' : 'tool',
      content: trimmed,
    };
  }

  // Detect thinking blocks (new format)
  if (text.includes(`${SYMBOL_BULLET} Thinking:`)) {
    return {
      type: 'thinking',
      content: trimmed,
    };
  }

  // Detect telemetry
  const telemetry = parseTelemetryChunk(text);
  if (telemetry) {
    return {
      type: 'telemetry',
      content: trimmed,
      telemetry,
    };
  }

  // Detect errors (fallback for non-nested errors)
  if (text.includes('ERROR') || text.includes('✗') || color === 'red') {
    return {
      type: 'error',
      content: trimmed,
    };
  }

  // Default: text (includes MESSAGE, TEXT, and unknown patterns)
  return {
    type: 'text',
    content: trimmed,
  };
}
