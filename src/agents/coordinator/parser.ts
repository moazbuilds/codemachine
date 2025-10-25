import type { CoordinationPlan, CommandGroup, AgentCommand, CoordinationMode } from './types';

/**
 * Parse coordination script into coordination plan
 *
 * Syntax:
 * - Enhanced: agent[input:file.md;file2.md,tail:100,prompt:"text"]
 * - Parallel: agent1 'prompt1' & agent2 'prompt2' & agent3 'prompt3'
 * - Sequential: agent1 'prompt1' && agent2 'prompt2' && agent3 'prompt3'
 * - Mixed: agent1 'p1' && (agent2 'p2' & agent3 'p3') && agent4 'p4'
 *
 * For MVP, we'll support simpler syntax without parentheses:
 * - All & = parallel group
 * - All && = sequential group
 * - No mixing in same level
 */
export class CoordinatorParser {
  /**
   * Parse coordination script
   */
  parse(script: string): CoordinationPlan {
    // Trim and validate
    const trimmed = script.trim();
    if (!trimmed) {
      throw new Error('Coordination script cannot be empty');
    }

    // Determine coordination mode based on separator
    // Priority: if any && exists, treat as sequential; otherwise parallel
    const hasSequential = trimmed.includes('&&');
    const hasParallel = trimmed.includes('&') && !hasSequential;

    if (hasSequential && trimmed.includes('&') && trimmed.split('&&').some(part => part.includes('&'))) {
      // Mixed mode - more complex parsing needed
      return this.parseMixed(trimmed);
    }

    if (hasSequential) {
      return this.parseSequential(trimmed);
    }

    if (hasParallel) {
      return this.parseParallel(trimmed);
    }

    // Single command
    return this.parseSingle(trimmed);
  }

  /**
   * Parse single command (no & or &&)
   */
  private parseSingle(script: string): CoordinationPlan {
    const command = this.parseCommand(script);
    return {
      groups: [
        {
          mode: 'sequential',
          commands: [command]
        }
      ]
    };
  }

  /**
   * Parse parallel commands (separated by &)
   */
  private parseParallel(script: string): CoordinationPlan {
    const parts = script.split('&').map(p => p.trim());
    const commands = parts.map(part => this.parseCommand(part));

    return {
      groups: [
        {
          mode: 'parallel',
          commands
        }
      ]
    };
  }

  /**
   * Parse sequential commands (separated by &&)
   */
  private parseSequential(script: string): CoordinationPlan {
    const parts = script.split('&&').map(p => p.trim());
    const commands = parts.map(part => this.parseCommand(part));

    return {
      groups: [
        {
          mode: 'sequential',
          commands
        }
      ]
    };
  }

  /**
   * Parse mixed mode (contains both & and &&)
   * For now, we'll treat && as group separators and & as parallel within groups
   *
   * Example: "db 'schema' && frontend 'ui' & backend 'api' && test 'e2e'"
   * Groups:
   * 1. Sequential: db 'schema'
   * 2. Parallel: frontend 'ui', backend 'api'
   * 3. Sequential: test 'e2e'
   */
  private parseMixed(script: string): CoordinationPlan {
    // Split by && first
    const sequentialParts = script.split('&&').map(p => p.trim());

    const groups: CommandGroup[] = sequentialParts.map(part => {
      // Check if this part has parallel commands
      if (part.includes('&')) {
        const parallelParts = part.split('&').map(p => p.trim());
        return {
          mode: 'parallel' as CoordinationMode,
          commands: parallelParts.map(p => this.parseCommand(p))
        };
      } else {
        return {
          mode: 'sequential' as CoordinationMode,
          commands: [this.parseCommand(part)]
        };
      }
    });

    return { groups };
  }

  /**
   * Parse a single command: "agent-name 'prompt text'" or enhanced syntax
   */
  private parseCommand(commandStr: string): AgentCommand {
    const trimmed = commandStr.trim();

    // Try enhanced syntax first: agent[options] or agent[options] 'prompt'
    const enhancedMatch = trimmed.match(/^(\S+)\[([^\]]+)\](?:\s+(['"])(.+?)\3)?$/);

    if (enhancedMatch) {
      const name = enhancedMatch[1];
      const optionsStr = enhancedMatch[2];
      const trailingPrompt = enhancedMatch[4]; // Captured group 4 is the prompt content

      // Parse options from brackets
      const options = this.parseOptions(optionsStr);

      // Build command
      return {
        name,
        prompt: options.prompt || trailingPrompt || undefined,
        input: options.input,
        tail: options.tail,
        options: options.extra
      };
    }

    // Fallback to legacy syntax
    // Match: agent-name 'prompt' or agent-name "prompt"
    const singleQuoteMatch = trimmed.match(/^(\S+)\s+'([^']+)'$/);
    const doubleQuoteMatch = trimmed.match(/^(\S+)\s+"([^"]+)"$/);

    if (singleQuoteMatch) {
      return {
        name: singleQuoteMatch[1],
        prompt: singleQuoteMatch[2]
      };
    }

    if (doubleQuoteMatch) {
      return {
        name: doubleQuoteMatch[1],
        prompt: doubleQuoteMatch[2]
      };
    }

    // No quotes - treat entire string after first space as prompt
    const spaceIndex = trimmed.indexOf(' ');
    if (spaceIndex > 0) {
      return {
        name: trimmed.substring(0, spaceIndex),
        prompt: trimmed.substring(spaceIndex + 1).trim()
      };
    }

    // No prompt - just agent name (allowed now with optional prompt)
    if (trimmed.match(/^\S+$/)) {
      return {
        name: trimmed
      };
    }

    throw new Error(`Invalid command syntax: ${commandStr}\nExpected: agent-name 'prompt' or agent[options] 'prompt'`);
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
