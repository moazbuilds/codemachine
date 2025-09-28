import * as path from 'node:path';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { Command } from 'commander';

import { registerStartCommand } from './start.command.js';
import { ensureAuth, clearAuth, nextAuthMenuAction } from '../../app/services/auth-status.js';
import { renderMainMenu } from '../presentation/main-menu.js';
import { runAgentsBuilder } from '../../agents/runtime/agents-builder.js';
import { runPlanningWorkflow } from '../../core/workflows/planning-workflow.js';

const DEFAULT_SPEC_PATH = 'runner-prompts/user-input.md';

export function registerSessionCommand(program: Command): void {
  program
    .command('session')
    .description('Start an interactive session that accepts slash commands')
    .option('--spec <path>', 'Path to the planning specification file', DEFAULT_SPEC_PATH)
    .action(async (options: { spec?: string }) => {
      // Warm up: show main menu once
      const menu = await renderMainMenu();
      console.log(menu + '\n');

      const rl = createInterface({ input, output, terminal: true });
      const prompt = () => rl.setPrompt('codemachine> ');
      prompt();
      rl.prompt();

      const cwd = process.env.CODEMACHINE_CWD || process.cwd();
      const specificationPath = path.resolve(cwd, options.spec ?? DEFAULT_SPEC_PATH);

      const help = () => {
        console.log([
          '',
          'Available commands:',
          '  /start                Run planning (agents-builder + validation) and stay in session',
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
            console.log(`Launching planning workflow (spec=${specificationPath}, force=false)`);
            await runAgentsBuilder({
              workingDir: cwd,
              force: false,
              specPath: specificationPath,
            });
            await runPlanningWorkflow({ force: false, specificationPath });
            console.log('Planning finished. You are still in the session.');
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
    });
}
