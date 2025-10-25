import type { ExecutionPlan, CommandGroup, AgentCommand, AgentExecutionResult, OrchestrationResult } from './types.js';
import { executeAgent } from '../execution/runner.js';
import { loadAgentTemplate } from '../execution/config.js';
import { AgentMonitorService } from '../monitoring/index.js';
import { InputFileProcessor } from './input-processor.js';
import * as logger from '../../shared/logging/logger.js';
import chalk from 'chalk';

export interface ExecutorOptions {
  /** Working directory for agent execution */
  workingDir: string;

  /** Parent agent ID (the orchestration session) - optional for standalone orchestration */
  parentId?: number;

  /** Optional logger for agent output */
  logger?: (agentName: string, chunk: string) => void;
}

/**
 * Executes orchestration plans with parallel/sequential support
 */
export class OrchestrationExecutor {
  private options: ExecutorOptions;
  private inputProcessor: InputFileProcessor;

  constructor(options: ExecutorOptions) {
    this.options = options;
    this.inputProcessor = new InputFileProcessor();
  }

  /**
   * Execute the complete orchestration plan
   */
  async execute(plan: ExecutionPlan): Promise<OrchestrationResult> {
    const results: AgentExecutionResult[] = [];

    // Execute groups sequentially (even if group itself is parallel)
    for (const group of plan.groups) {
      const groupResults = await this.executeGroup(group);
      results.push(...groupResults);

      // Check if any failed (only matters for sequential)
      const anyFailed = groupResults.some(r => !r.success);
      if (anyFailed && group.mode === 'sequential') {
        logger.warn('Sequential group had failures, stopping execution');
        break;
      }
    }

    const success = results.every(r => r.success);

    return {
      parentId: this.options.parentId,
      results,
      success
    };
  }

  /**
   * Execute a command group (either parallel or sequential)
   */
  private async executeGroup(group: CommandGroup): Promise<AgentExecutionResult[]> {
    if (group.mode === 'parallel') {
      return this.executeParallel(group.commands);
    } else {
      return this.executeSequential(group.commands);
    }
  }

  /**
   * Execute commands in parallel
   */
  private async executeParallel(commands: AgentCommand[]): Promise<AgentExecutionResult[]> {
    console.log(chalk.dim(`\n→ Executing ${commands.length} agents in parallel...\n`));

    const promises = commands.map(cmd => this.executeCommand(cmd));
    return Promise.all(promises);
  }

  /**
   * Execute commands sequentially
   */
  private async executeSequential(commands: AgentCommand[]): Promise<AgentExecutionResult[]> {
    const results: AgentExecutionResult[] = [];

    for (let i = 0; i < commands.length; i++) {
      console.log(chalk.dim(`\n→ Executing agent ${i + 1}/${commands.length}...\n`));

      const result = await this.executeCommand(commands[i]);
      results.push(result);

      // Stop on failure
      if (!result.success) {
        logger.error(`Agent ${result.name} failed, stopping sequential execution`);
        break;
      }
    }

    return results;
  }

  /**
   * Execute a single command
   */
  private async executeCommand(command: AgentCommand): Promise<AgentExecutionResult> {
    console.log(chalk.bold.cyan(`\n┌─ Agent: ${command.name}`));
    if (command.input && command.input.length > 0) {
      console.log(chalk.dim(`│  Input files: ${command.input.join(', ')}`));
    }
    if (command.tail) {
      console.log(chalk.dim(`│  Tail: ${command.tail} lines`));
    }
    console.log(chalk.dim(`│  Prompt: ${command.prompt || '(using template only)'}`));
    console.log(chalk.dim('└' + '─'.repeat(60) + '\n'));

    try {
      // Load input files if specified
      let inputContent = '';
      if (command.input && command.input.length > 0) {
        inputContent = await this.inputProcessor.loadInputFiles(command.input, this.options.workingDir);
      }

      // Load agent template
      const template = await loadAgentTemplate(command.name, this.options.workingDir);

      // Build composite prompt (input files + template + user prompt)
      const compositePrompt = this.inputProcessor.buildCompositePrompt(
        inputContent,
        template,
        command.prompt
      );

      // Execute agent with composite prompt
      // Suppress output if tail is specified - we'll show the tail-limited output after
      const suppressOutput = command.tail !== undefined && command.tail > 0;

      const output = await executeAgent(command.name, compositePrompt, {
        workingDir: this.options.workingDir,
        parentId: this.options.parentId,
        logger: suppressOutput
          ? () => {} // Silent logger when tail is active
          : this.options.logger
            ? (chunk) => this.options.logger!(command.name, chunk)
            : undefined,
        stderrLogger: suppressOutput ? () => {} : undefined
      });

      // Apply tail limiting if specified
      let finalOutput = output;
      let tailApplied: number | undefined;

      if (command.tail && command.tail > 0) {
        const lines = output.split('\n');
        if (lines.length > command.tail) {
          finalOutput = lines.slice(-command.tail).join('\n');
          tailApplied = command.tail;
          logger.debug(`Applied tail limiting: ${lines.length} -> ${command.tail} lines`);
        }
      }

      // Get the agent ID from monitoring service
      const monitor = AgentMonitorService.getInstance();
      const agents = monitor.queryAgents({
        name: command.name,
        parentId: this.options.parentId
      });

      // Get the most recent one
      const agent = agents.sort((a, b) => b.id - a.id)[0];

      console.log(chalk.green(`\n✓ Agent ${command.name} completed successfully`));
      if (tailApplied) {
        console.log(chalk.dim(`  (Output limited to last ${tailApplied} lines)`));
      }

      return {
        name: command.name,
        agentId: agent?.id || 0,
        success: true,
        output: finalOutput,
        tailApplied
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(chalk.red(`\n✗ Agent ${command.name} failed: ${errorMessage}`));

      // Try to get the agent ID even on failure (for better error reporting)
      const monitor = AgentMonitorService.getInstance();
      const agents = monitor.queryAgents({
        name: command.name,
        parentId: this.options.parentId
      });

      // Get the most recent one (likely the failed agent)
      const agent = agents.sort((a, b) => b.id - a.id)[0];

      // Note: Agent status is already marked as failed in runner.ts
      // This is just for returning the proper agent ID in the result

      return {
        name: command.name,
        agentId: agent?.id || 0,
        success: false,
        error: errorMessage
      };
    }
  }
}
