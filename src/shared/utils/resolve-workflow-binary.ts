import path from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Resolves the path to the codemachine-workflow binary.
 *
 * The workflow binary is always a sibling of the main binary in the same directory.
 * This works for all installation methods: global npm install, local testing, etc.
 *
 * @returns Absolute path to the workflow binary
 * @throws Error if workflow binary cannot be found
 */
export function resolveWorkflowBinary(): string {
  // Get directory where the current binary is running from
  const binaryDir = path.dirname(process.execPath);

  // Try Windows name first (.exe extension)
  const windowsBinary = path.join(binaryDir, 'codemachine-workflow.exe');
  if (existsSync(windowsBinary)) {
    return windowsBinary;
  }

  // Try Unix name (no extension)
  const unixBinary = path.join(binaryDir, 'codemachine-workflow');
  if (existsSync(unixBinary)) {
    return unixBinary;
  }

  // Binary not found - provide helpful error
  throw new Error(
    `Workflow binary not found in ${binaryDir}. ` +
      `Expected 'codemachine-workflow' or 'codemachine-workflow.exe'. ` +
      `This may indicate a corrupted installation. Try reinstalling with: npm install -g codemachine`
  );
}
