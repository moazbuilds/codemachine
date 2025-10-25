import * as fs from 'fs/promises';
import * as path from 'path';
import type { CoordinationPlan, CommandGroup, AgentCommand, AgentExecutionResult, CoordinationResult } from './types.js';
import { executeAgent } from '../runner/runner.js';
import { loadAgentTemplate } from '../runner/config.js';
import { AgentMonitorService } from '../monitoring/index.js';
import { processPromptString } from '../../shared/prompts/index.js';
import * as logger from '../../shared/logging/logger.js';
import chalk from 'chalk';

export interface CoordinationExecutorOptions {
  /** Working directory for agent execution */
  workingDir: string;

  /** Parent agent ID (the coordination session) - optional for standalone coordination */
  parentId?: number;

  /** Optional logger for agent output */
  logger?: (agentName: string, chunk: string) => void;
}

/**
 * Executes coordination plans with parallel/sequential support
 * Handles file loading, template loading, and prompt building
 */
export class CoordinationExecutor {
  private options: CoordinationExecutorOptions;

  constructor(options: CoordinationExecutorOptions) {
    this.options = options;
  }

  /**
   * Execute the complete coordination plan
   */
  async execute(plan: CoordinationPlan): Promise<CoordinationResult> {
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
        inputContent = await this.loadInputFiles(command.input);
      }

      // Load agent template
      const rawTemplate = await loadAgentTemplate(command.name, this.options.workingDir);
      const template = await processPromptString(rawTemplate, this.options.workingDir);

      // Build composite prompt (input files + template + user prompt)
      const compositePrompt = this.buildCompositePrompt(
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

      // Print the tail-limited output if it was suppressed during execution
      if (suppressOutput && finalOutput) {
        console.log('\n' + chalk.bold('═'.repeat(60)));
        console.log(chalk.bold('Agent Output'));
        console.log(chalk.bold('═'.repeat(60)) + '\n');
        console.log(finalOutput);
        console.log('\n' + chalk.dim('─'.repeat(60)) + '\n');
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

  /**
   * Load multiple input files and concatenate their contents
   * @param filePaths Array of file paths (absolute or relative to workingDir)
   * @returns Concatenated file contents with separators
   */
  private async loadInputFiles(filePaths: string[]): Promise<string> {
    if (!filePaths || filePaths.length === 0) {
      return '';
    }

    const contents: string[] = [];

    for (const filePath of filePaths) {
      try {
        const resolvedPath = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(this.options.workingDir, filePath);

        logger.debug(`Loading input file: ${resolvedPath}`);

        const content = await fs.readFile(resolvedPath, 'utf-8');

        // Add file header and content
        contents.push(`\n=== File: ${filePath} ===\n${content}\n${'='.repeat(60)}\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Failed to load input file ${filePath}: ${message}`);

        // Add error marker but continue processing other files
        contents.push(`\n=== File: ${filePath} (FAILED TO LOAD) ===\nError: ${message}\n${'='.repeat(60)}\n`);
      }
    }

    return contents.join('\n');
  }

  /**
   * Build composite prompt from input files, agent template, and user prompt
   * @param inputContent Content from input files
   * @param template Agent template content (already processed)
   * @param userPrompt User-provided prompt (optional)
   * @returns Composite prompt ready for execution
   */
  private buildCompositePrompt(inputContent: string, template: string, userPrompt?: string): string {
    const parts: string[] = [];

    // Add input files section if present
    if (inputContent && inputContent.trim()) {
      parts.push('[INPUT FILES]');
      parts.push(inputContent);
      parts.push('');
    }

    // Add agent template
    if (template && template.trim()) {
      parts.push('[SYSTEM]');
      parts.push(template);
      parts.push('');
    }

    // Add user request if present
    if (userPrompt && userPrompt.trim()) {
      parts.push('[REQUEST]');
      parts.push(userPrompt);
    }

    return parts.join('\n');
  }
}
