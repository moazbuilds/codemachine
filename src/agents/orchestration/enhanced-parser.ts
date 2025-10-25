import type { AgentCommand } from './types';

/**
 * Enhanced parser for the new DSL syntax
 * Supports: agent[input:file1.md;file2.md,tail:100,prompt:"text"]
 */
export class EnhancedCommandParser {
  /**
   * Try to parse command using enhanced syntax
   * Returns null if not enhanced syntax (fallback to legacy parser)
   */
  tryParseEnhanced(commandStr: string): AgentCommand | null {
    const trimmed = commandStr.trim();

    // Match: agent[options] or agent[options] 'prompt' or agent[options] "prompt"
    const enhancedMatch = trimmed.match(/^(\S+)\[([^\]]+)\](?:\s+(['"])([^\3]+)\3)?$/);

    if (!enhancedMatch) {
      return null; // Not enhanced syntax
    }

    const name = enhancedMatch[1];
    const optionsStr = enhancedMatch[2];
    const trailingPrompt = enhancedMatch[4]; // Captured group 4 is the prompt content

    // Parse options
    const options = this.parseOptions(optionsStr);

    // Build command
    const command: AgentCommand = {
      name,
      prompt: options.prompt || trailingPrompt || undefined,
      input: options.input,
      tail: options.tail,
      options: options.extra
    };

    return command;
  }

  /**
   * Parse options string from brackets
   * Format: key:value,key:value
   */
  private parseOptions(optionsStr: string): {
    prompt?: string;
    input?: string[];
    tail?: number;
    extra: Record<string, unknown>;
  } {
    const result: {
      prompt?: string;
      input?: string[];
      tail?: number;
      extra: Record<string, unknown>;
    } = {
      extra: {}
    };

    // Split by comma, but respect quotes
    const parts = this.smartSplit(optionsStr, ',');

    for (const part of parts) {
      const trimmedPart = part.trim();
      if (!trimmedPart) continue;

      // Split by first colon to get key:value
      const colonIndex = trimmedPart.indexOf(':');
      if (colonIndex === -1) {
        // No colon, skip
        continue;
      }

      const key = trimmedPart.substring(0, colonIndex).trim();
      const value = trimmedPart.substring(colonIndex + 1).trim();

      // Handle special keys
      switch (key) {
        case 'input':
          result.input = this.parseInput(value);
          break;
        case 'tail':
          result.tail = this.parseTail(value);
          break;
        case 'prompt':
          result.prompt = this.unquote(value);
          break;
        default:
          // Store in extra
          result.extra[key] = this.unquote(value);
      }
    }

    return result;
  }

  /**
   * Parse input value (semicolon-separated file paths)
   */
  private parseInput(value: string): string[] {
    const unquoted = this.unquote(value);
    // Split by semicolon
    return unquoted.split(';').map(p => p.trim()).filter(p => p.length > 0);
  }

  /**
   * Parse tail value (must be a number)
   */
  private parseTail(value: string): number | undefined {
    const unquoted = this.unquote(value);
    const num = parseInt(unquoted, 10);
    return isNaN(num) ? undefined : num;
  }

  /**
   * Remove surrounding quotes from a string
   */
  private unquote(str: string): string {
    const trimmed = str.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.substring(1, trimmed.length - 1);
    }
    return trimmed;
  }

  /**
   * Smart split that respects quotes
   * Splits by delimiter but keeps quoted strings intact
   */
  private smartSplit(str: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      // Toggle quote state
      if ((char === '"' || char === "'") && (i === 0 || str[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = '';
        }
      }

      // Check for delimiter
      if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    // Add last part
    if (current) {
      result.push(current);
    }

    return result;
  }
}
