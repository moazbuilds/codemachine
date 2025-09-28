import * as path from 'node:path';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { Command } from 'commander';

import { ensureAuth, clearAuth } from '../../app/services/auth-status.js';
import { renderMainMenu } from '../presentation/main-menu.js';
import { SESSION_INSTRUCTION } from '../presentation/onboarding.js';
import { runWorkflowQueue } from '../../core/workflows/queue-runner.js';

const DEFAULT_SPEC_PATH = '.codemachine/inputs/specifications.md';

export function registerSessionCommand(program: Command): void {
  program
    .command('session')
    .description('Start an interactive session that accepts slash commands')
    .option('--spec <path>', 'Path to the planning specification file', DEFAULT_SPEC_PATH)
    .action(async (options: { spec?: string }) => {
      const cwd = process.env.CODEMACHINE_CWD || process.cwd();
      const specificationPath = path.resolve(cwd, options.spec ?? DEFAULT_SPEC_PATH);
      await runSessionShell({ cwd, specificationPath, force: false });
    });
}

interface SessionShellOptions {
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
    console.log(menu + '\n');
    console.log(SESSION_INSTRUCTION);
  }

  const rl = createInterface({ input, output, terminal: true });
  const prompt = () => rl.setPrompt('codemachine> ');
  prompt();
  rl.prompt();

  const help = () => {
    console.log([
      '',
      'Available commands:',
      '  /start                Run configured workflow queue and stay in session',
      '  /ui                   Print the main menu again',
      '  /login                Authenticate with Codex services',
      '  /logout               Sign out of Codex services',
      '  /version              Show CLI version',
      '  /help                 Show this help',
      '  /exit                 Exit the session',
      '',
    ].join('\n'));
  };

  const require = createRequire(import.meta.url);
  const pkg = require('../../../package.json') as { version: string };

  for await (const line of rl) {
    const raw = (line || '').trim();
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

    if (raw === '/ui') {
      const text = await renderMainMenu();
      console.log(text + '\n');
      prompt();
      rl.prompt();
      continue;
    }

    if (raw === '/login') {
      await ensureAuth();
      console.log('Authentication successful.');
      prompt();
      rl.prompt();
      continue;
    }

    if (raw === '/logout') {
      await clearAuth();
      console.log('Signed out. Next action will be `login`.');
      prompt();
      rl.prompt();
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

    console.log(`Unrecognized command: ${raw}. Type /help for options.`);
    prompt();
    rl.prompt();
  }

  rl.close();
}
