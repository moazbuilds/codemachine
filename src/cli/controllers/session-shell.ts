import { createRequire } from 'node:module';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderMainMenu } from '../presentation/main-menu.js';
import { renderTypewriter } from '../presentation/typewriter.js';
import { palette } from '../presentation/layout.js';
import { runWorkflowQueue } from '../../workflows/index.js';
import { createTemplateHandler, createAuthHandler } from './session-handlers/index.js';

export interface SessionShellOptions {
  cwd: string;
  specificationPath: string;
  force: boolean;
  showIntro?: boolean;
}

export async function runSessionShell(options: SessionShellOptions): Promise<void> {
  const { cwd, specificationPath, force } = options;
  const showIntro = options.showIntro ?? true;

  if (showIntro) {
    const menu = await renderMainMenu();
    await renderTypewriter({ text: menu + '\n' });
  }

  const rl = createInterface({ input, output, terminal: true });
  const prompt = () => rl.setPrompt(palette.primary('CODEMACHINE> '));
  prompt();
  rl.prompt();

  const help = () => {
    console.log([
      '',
      'Available commands:',
      '  /start                Run configured workflow queue and stay in session',
      '  /templates            List and select workflow templates',
      '  /login                Authenticate with AI services',
      '  /logout               Sign out of AI services',
      '  /version              Show CLI version',
      '  /mcp                  MCP support coming soon',
      '  /help                 Show this help',
      '  /exit                 Exit the session',
      '',
    ].join('\n'));
  };

  const require = createRequire(import.meta.url);
  const packageJsonPath = findPackageJson(import.meta.url);
  const pkg = require(packageJsonPath) as { version: string };

  // Initialize handlers
  const onHandlerComplete = () => {
    prompt();
    rl.prompt();
  };

  const templateHandler = createTemplateHandler(rl, onHandlerComplete);
  const authHandler = createAuthHandler(rl, onHandlerComplete);

  for await (const line of rl) {
    const raw = (line || '').trim();

    // Skip processing if any handler is active
    if (templateHandler.isActive() || authHandler.isActive()) {
      continue;
    }

    if (!raw) {
      prompt();
      rl.prompt();
      continue;
    }

    if (raw === '/exit' || raw === '/quit') {
      break;
    }

    if (raw === '/help' || raw === '/h') {
      help();
      prompt();
      rl.prompt();
      continue;
    }

    if (raw === '/version') {
      console.log(`CodeMachine v${pkg.version}`);
      prompt();
      rl.prompt();
      continue;
    }

    if (raw === '/login') {
      try {
        await authHandler.handleLogin();
      } catch (error) {
        console.error('Error during login:', error instanceof Error ? error.message : String(error));
        prompt();
        rl.prompt();
      }
      continue;
    }

    if (raw === '/logout') {
      try {
        await authHandler.handleLogout();
      } catch (error) {
        console.error('Error during logout:', error instanceof Error ? error.message : String(error));
        prompt();
        rl.prompt();
      }
      continue;
    }

    if (raw === '/start') {
      try {
        console.log(`Launching workflow queue (spec=${specificationPath}, force=${force})`);
        await runWorkflowQueue({ cwd, force, specificationPath });
        console.log('Workflow finished. You are still in the session.');
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
      }
      prompt();
      rl.prompt();
      continue;
    }

    if (raw === '/templates' || raw === '/template') {
      try {
        await templateHandler.handle();
      } catch (error) {
        console.error('Error running templates command:', error instanceof Error ? error.message : String(error));
        prompt();
        rl.prompt();
      }
      continue;
    }

    if (raw === '/mcp') {
      console.log('MCP support coming soon!');
      prompt();
      rl.prompt();
      continue;
    }

    console.log(`Unrecognized command: ${raw}. Type /help for options.`);
    prompt();
    rl.prompt();
  }

  rl.close();
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
