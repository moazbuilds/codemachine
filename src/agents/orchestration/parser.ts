import type { ExecutionPlan, CommandGroup, AgentCommand, ExecutionMode } from './types';

/**
 * Parse orchestration script into execution plan
 *
 * Syntax:
 * - Parallel: agent1 'prompt1' & agent2 'prompt2' & agent3 'prompt3'
 * - Sequential: agent1 'prompt1' && agent2 'prompt2' && agent3 'prompt3'
 * - Mixed: agent1 'p1' && (agent2 'p2' & agent3 'p3') && agent4 'p4'
 *
 * For MVP, we'll support simpler syntax without parentheses:
 * - All & = parallel group
 * - All && = sequential group
 * - No mixing in same level
 */
export class OrchestrationParser {
  /**
   * Parse orchestration script
   */
  parse(script: string): ExecutionPlan {
    // Trim and validate
    const trimmed = script.trim();
    if (!trimmed) {
      throw new Error('Orchestration script cannot be empty');
    }

    // Determine execution mode based on separator
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
  private parseSingle(script: string): ExecutionPlan {
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
  private parseParallel(script: string): ExecutionPlan {
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
  private parseSequential(script: string): ExecutionPlan {
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
  private parseMixed(script: string): ExecutionPlan {
    // Split by && first
    const sequentialParts = script.split('&&').map(p => p.trim());

    const groups: CommandGroup[] = sequentialParts.map(part => {
      // Check if this part has parallel commands
      if (part.includes('&')) {
        const parallelParts = part.split('&').map(p => p.trim());
        return {
          mode: 'parallel' as ExecutionMode,
          commands: parallelParts.map(p => this.parseCommand(p))
        };
      } else {
        return {
          mode: 'sequential' as ExecutionMode,
          commands: [this.parseCommand(part)]
        };
      }
    });

    return { groups };
  }

  /**
   * Parse a single command: "agent-name 'prompt text'"
   */
  private parseCommand(commandStr: string): AgentCommand {
    const trimmed = commandStr.trim();

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

    throw new Error(`Invalid command syntax: ${commandStr}\nExpected: agent-name 'prompt' or agent-name "prompt"`);
  }
}
