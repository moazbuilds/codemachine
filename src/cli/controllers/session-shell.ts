import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import React from 'react';
import { render } from 'ink';

import { renderMainMenu } from '../presentation/main-menu.js';
import { renderTypewriter } from '../presentation/typewriter.js';
import { SessionShell } from '../components/SessionShell.js';
import { runWorkflowQueue } from '../../workflows/index.js';
import { clearTerminal } from '../../shared/utils/terminal.js';
import { debug } from '../../shared/logging/logger.js';

export interface SessionShellOptions {
  cwd: string;
  specificationPath: string;
  specDisplayPath?: string; // Original path for display purposes
  showIntro?: boolean;
}

/**
 * Run a codemachine CLI command as a subprocess
 * Returns a promise that resolves with the exit code
 */
function runCliCommand(args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('codemachine', args, {
      stdio: 'inherit', // Pass stdin/stdout/stderr directly to the child
      shell: false,
    });

    child.on('close', (code) => {
      resolve(code ?? 0);
    });

    child.on('error', (error) => {
      console.error(`Failed to start command: ${error.message}`);
      resolve(1);
    });
  });
}

export async function runSessionShell(options: SessionShellOptions): Promise<void> {
  const { cwd, specificationPath, specDisplayPath } = options;
  const showIntro = options.showIntro ?? true;

  if (showIntro) {
    const menu = await renderMainMenu(specDisplayPath);
    await renderTypewriter({ text: menu + '\n' });
  }

  const require = createRequire(import.meta.url);
  const packageJsonPath = findPackageJson(import.meta.url);
  const pkg = require(packageJsonPath) as { version: string };

  let inkInstance: ReturnType<typeof render> | null = null;
  let shouldExit = false;

  const handleCommand = async (command: string): Promise<void> => {
    if (command === '/start') {
      // Unmount Ink UI to release stdin control
      if (inkInstance) {
        inkInstance.unmount();
        inkInstance = null;
      }

      try {
        // Clear terminal for clean workflow start
        clearTerminal();

        debug(`Launching workflow queue (spec=${specificationPath})`);
        await runWorkflowQueue({ cwd, specificationPath });

        // If workflow completes normally, it calls process.exit()
        // We only reach here if there's an error during workflow startup
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    } else if (command === '/help' || command === '/h') {
      console.log([
        '',
        'Available commands:',
        '  /start                Run configured workflow queue',
        '  /templates            List and select workflow templates',
        '  /login                Authenticate with AI services',
        '  /logout               Sign out of AI services',
        '  /version              Show CLI version',
        '  /help                 Show this help',
        '  /exit                 Exit the session',
        '',
      ].join('\n'));
    } else if (command === '/version') {
      console.log(`CodeMachine v${pkg.version}`);
    } else if (command === '/login') {
      // Unmount Ink UI to release terminal control
      if (inkInstance) {
        inkInstance.unmount();
        inkInstance = null;
      }

      // Clear terminal for clean auth flow
      clearTerminal();

      // Run the auth login command as a subprocess
      await runCliCommand(['auth', 'login']);

      // Restart Ink UI after command completes
      startInkUI();
    } else if (command === '/logout') {
      // Unmount Ink UI to release terminal control
      if (inkInstance) {
        inkInstance.unmount();
        inkInstance = null;
      }

      // Clear terminal for clean auth flow
      clearTerminal();

      // Run the auth logout command as a subprocess
      await runCliCommand(['auth', 'logout']);

      // Restart Ink UI after command completes
      startInkUI();
    } else if (command === '/templates' || command === '/template') {
      // Unmount Ink UI to release terminal control
      if (inkInstance) {
        inkInstance.unmount();
        inkInstance = null;
      }

      // Clear terminal for clean templates flow
      clearTerminal();

      // Run the templates command as a subprocess
      await runCliCommand(['templates']);

      // Restart Ink UI after command completes
      startInkUI();
    } else {
      throw new Error(`Unrecognized command: ${command}. Type /help for options.`);
    }
  };

  const handleExit = (): void => {
    shouldExit = true;
    if (inkInstance) {
      inkInstance.unmount();
      inkInstance = null;
    }
    process.exit(0);
  };

  const startInkUI = (): void => {
    // Ensure we don't have multiple instances
    if (inkInstance) {
      inkInstance.unmount();
      inkInstance = null;
    }

    inkInstance = render(
      React.createElement(SessionShell, {
        onCommand: handleCommand,
        onExit: handleExit,
        projectName: specDisplayPath,
      }),
      {
        exitOnCtrlC: true,
      }
    );
  };

  // Start the Ink UI (don't clear to preserve main menu)
  startInkUI();
}

function findPackageJson(moduleUrl: string): string {
  let currentDir = dirname(fileURLToPath(moduleUrl));
  const { root } = parse(currentDir);

  while (true) {
    const candidate = join(currentDir, 'package.json');
    if (existsSync(candidate)) return candidate;
    if (currentDir === root) break;
    currentDir = dirname(currentDir);
  }

  throw new Error('Unable to locate package.json from CLI module');
}
