import * as path from 'node:path';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { Command } from 'commander';

import { ensureAuth, clearAuth } from '../../app/services/auth-status.js';
import { renderMainMenu } from '../presentation/main-menu.js';
import { palette } from '../presentation/layout.js';
import { runWorkflowQueue } from '../../core/workflows/queue-runner.js';
import { selectTemplateByNumber, getAvailableTemplates, printAvailableWorkflowTemplatesHeading } from './templates.command.js';

const DEFAULT_SPEC_PATH = '.codemachine/inputs/specifications.md';

export function registerSessionCommand(program: Command): void {
  program
    .command('session', { hidden: true })
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
      '  /login                Authenticate with Codex services',
      '  /logout               Sign out of Codex services',
      '  /version              Show CLI version',
      '  /mcp                  MCP support coming soon',
      '  /help                 Show this help',
      '  /exit                 Exit the session',
      '',
    ].join('\n'));
  };

  const require = createRequire(import.meta.url);
  const pkg = require('../../package.json') as { version: string };

  let waitingForTemplateSelection = false;
  let templateSelectionIndex = 0;

  // Custom function to handle template selection with arrow keys
  const handleTemplateSelection = async (): Promise<void> => {
    const templates = await getAvailableTemplates();
    if (templates.length === 0) {
      console.log('No workflow templates found in templates/workflows/');
      return;
    }

    templateSelectionIndex = 0;
    waitingForTemplateSelection = true;

    printAvailableWorkflowTemplatesHeading();

    const displayTemplates = () => {
      console.clear();
      printAvailableWorkflowTemplatesHeading();
      templates.forEach((template, index) => {
        const prefix = index === templateSelectionIndex ? '❯ ' : '  ';
        const style = index === templateSelectionIndex ? '\x1b[36m\x1b[4m' : '';
        const reset = index === templateSelectionIndex ? '\x1b[0m' : '';
        console.log(`${prefix}${style}${template.title}${reset} - ${template.description}`);
      });
      console.log('\nUse ↑/↓ arrow keys to navigate, Enter to select, or type a number (1-' + templates.length + '):');
    };

    displayTemplates();

    // Set up raw mode for arrow key detection
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();

      const onKeyPress = async (chunk: Buffer) => {
        const key = chunk.toString();

        if (key === '\u001b[A') { // Up arrow
          templateSelectionIndex = Math.max(0, templateSelectionIndex - 1);
          displayTemplates();
        } else if (key === '\u001b[B') { // Down arrow
          templateSelectionIndex = Math.min(templates.length - 1, templateSelectionIndex + 1);
          displayTemplates();
        } else if (key === '\r' || key === '\n') { // Enter
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onKeyPress);

          try {
            await selectTemplateByNumber(templateSelectionIndex + 1);
          } catch (error) {
            console.error('Error selecting template:', error instanceof Error ? error.message : String(error));
          }

          waitingForTemplateSelection = false;
          prompt();
          rl.prompt();
        } else if (key === '\u0003') { // Ctrl+C
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onKeyPress);
          console.log('\nTemplate selection cancelled.');
          waitingForTemplateSelection = false;
          prompt();
          rl.prompt();
        } else if (key >= '1' && key <= '9') { // Number keys
          const num = parseInt(key, 10);
          if (num >= 1 && num <= templates.length) {
            process.stdin.setRawMode(false);
            process.stdin.removeListener('data', onKeyPress);

            try {
              await selectTemplateByNumber(num);
            } catch (error) {
              console.error('Error selecting template:', error instanceof Error ? error.message : String(error));
            }

            waitingForTemplateSelection = false;
            prompt();
            rl.prompt();
          }
        }
      };

      process.stdin.on('data', onKeyPress);
    }
  };

  for await (const line of rl) {
    const raw = (line || '').trim();

    // Skip processing if we're in template selection mode
    if (waitingForTemplateSelection) {
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

    if (raw === '/templates' || raw === '/template') {
      try {
        await handleTemplateSelection();
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
