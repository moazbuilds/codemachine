import { parseTelemetryChunk, ParsedTelemetry } from './telemetryParser';

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
  const trimmed = chunk.trim();

  // Detect tool usage (look for emoji indicators)
  if (
    trimmed.includes('🔧 TOOL') ||
    trimmed.includes('🔧 COMMAND') ||
    trimmed.includes('✅ TOOL')
  ) {
    const toolMatch = trimmed.match(/(?:🔧|✅)\s+(?:TOOL|COMMAND)(?:\s+(?:STARTED|COMPLETED))?:\s*(.+)/);
    return {
      type: 'tool',
      content: trimmed,
      toolName: toolMatch ? toolMatch[1] : undefined,
    };
  }

  // Detect thinking blocks
  if (trimmed.includes('🧠 THINKING')) {
    return {
      type: 'thinking',
      content: trimmed,
    };
  }

  // Detect telemetry
  const telemetry = parseTelemetryChunk(trimmed);
  if (telemetry) {
    return {
      type: 'telemetry',
      content: trimmed,
      telemetry,
    };
  }

  // Detect errors
  if (trimmed.includes('ERROR') || trimmed.includes('✗')) {
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
