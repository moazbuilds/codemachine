import * as fs from 'fs/promises';
import * as path from 'path';
import * as logger from '../../shared/logging/logger.js';

/**
 * Load and process input files for agent commands
 */
export class InputFileProcessor {
  /**
   * Load multiple input files and concatenate their contents
   * @param filePaths Array of file paths (absolute or relative to workingDir)
   * @param workingDir Working directory for resolving relative paths
   * @returns Concatenated file contents with separators
   */
  async loadInputFiles(filePaths: string[], workingDir: string): Promise<string> {
    if (!filePaths || filePaths.length === 0) {
      return '';
    }

    const contents: string[] = [];

    for (const filePath of filePaths) {
      try {
        const resolvedPath = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(workingDir, filePath);

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
   * @param template Agent template content
   * @param userPrompt User-provided prompt (optional)
   * @returns Composite prompt
   */
  buildCompositePrompt(inputContent: string, template: string, userPrompt?: string): string {
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
