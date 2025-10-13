import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import updateNotifier from 'update-notifier';
import { banner, formatKeyValue, palette, divider } from './layout.js';
import { getActiveTemplate } from '../../shared/workflows/index.js';

function findPackageJson(moduleUrl: string): string {
  let currentDir = dirname(fileURLToPath(moduleUrl));
  const { root } = parse(currentDir);

  while (true) {
    const candidate = join(currentDir, 'package.json');
    if (existsSync(candidate)) return candidate;
    if (currentDir === root) break;
    currentDir = dirname(currentDir);
  }

  throw new Error('Unable to locate package.json from main menu module');
}

function getPackageInfo(): { version: string; name: string } {
  const require = createRequire(import.meta.url);
  const packageJsonPath = findPackageJson(import.meta.url);
  const pkg = require(packageJsonPath) as { version: string; name: string };
  return { version: pkg.version, name: pkg.name };
}

function geminiAscii(): string {
  const codeText = [
    '   ██████╗ ██████╗ ██████╗ ███████╗',
    '  ██╔════╝██╔═══██╗██╔══██╗██╔════╝',
    '  ██║     ██║   ██║██║  ██║█████╗  ',
    '  ██║     ██║   ██║██║  ██║██╔══╝  ',
    '  ╚██████╗╚██████╔╝██████╔╝███████╗',
    '   ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝',
  ];

  const machineText = [
    '  ███╗   ███╗ █████╗  ██████╗██╗  ██╗██╗███╗   ██╗███████╗',
    '  ████╗ ████║██╔══██╗██╔════╝██║  ██║██║████╗  ██║██╔════╝',
    '  ██╔████╔██║███████║██║     ███████║██║██╔██╗ ██║█████╗  ',
    '  ██║╚██╔╝██║██╔══██║██║     ██╔══██║██║██║╚██╗██║██╔══╝  ',
    '  ██║ ╚═╝ ██║██║  ██║╚██████╗██║  ██║██║██║ ╚████║███████╗',
    '  ╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝╚══════╝',
  ];

  const stripIndent = (lines: string[]): string[] => {
    const leading = lines
      .filter((l) => l.trim().length > 0)
      .map((l) => l.match(/^\s*/)?.[0].length ?? 0);
    const min = leading.length > 0 ? Math.min(...leading) : 0;
    return lines.map((l) => l.slice(min));
  };

  const code = stripIndent(codeText);
  const machine = stripIndent(machineText);
  const codeWidth = Math.max(...code.map((l) => l.length));
  const machineWidth = Math.max(...machine.map((l) => l.length));
  const offset = Math.max(0, Math.floor((codeWidth - machineWidth) / 2));

  const leftMargin = '  ';
  const lines = [
    ...code.map((l) => leftMargin + l),
    ...machine.map((l) => leftMargin + ' '.repeat(offset) + l),
  ];
  return palette.primary(lines.join('\n'));
}

function renderSeparator(): string {
  return palette.primary(divider('═'));
}

async function renderStatus(): Promise<string> {
  const cwd = process.env.CODEMACHINE_CWD || process.cwd();
  const cmRoot = path.join(cwd, '.codemachine');

  const activeTemplate = await getActiveTemplate(cmRoot);
  const templateName = activeTemplate ? activeTemplate.replace('.workflow.js', '') : 'default';
  const pkg = getPackageInfo();

  const lines = [
    formatKeyValue('Version', palette.primary(`v${pkg.version}`)),
  ];

  // Check for updates (respects NO_UPDATE_NOTIFIER and CI environments)
  if (!process.env.NO_UPDATE_NOTIFIER && !process.env.CODEMACHINE_NO_UPDATE_CHECK) {
    try {
      const notifier = updateNotifier({
        pkg,
        updateCheckInterval: 1000 * 60 * 60 * 24, // Check once per day
      });

      if (notifier.update) {
        const { latest, type } = notifier.update;
        const updateText = `${palette.warning('Update available:')} v${latest} (${type})`;
        const commandText = 'Run: ' + palette.success('npm i -g codemachine');
        lines.push(formatKeyValue('', updateText));
        lines.push(formatKeyValue('', commandText));
      }
    } catch {
      // Silently fail if update check errors (offline, network issues, etc.)
    }
  }

  lines.push(formatKeyValue('Template', palette.success(`${templateName.toUpperCase()} - READY`)));

  return lines.join('\n');
}

function renderCommands(): string {
  const lines = [
    formatKeyValue('/start', 'Run configured workflow queue'),
    formatKeyValue('/templates', 'Browse available templates'),
    formatKeyValue('/version', 'Show CLI version'),
    formatKeyValue('/help', 'Show command help'),
  ];
  return lines.join('\n');
}

function renderSpecificationsPrompt(): string {
  const line1 = 'Have you written the full specification in .codemachine/inputs/specifications.md?';
  const line2 = 'Add any necessary context files, then run /start to begin.';
  return [line1, line2, renderSeparator()].join('\n');
}

export async function renderMainMenu(): Promise<string> {
  const parts: string[] = [];
  parts.push(banner('CodeMachine - Multi-Agent Workflow Orchestration'));
  // Render left-aligned ASCII with MACHINE centered under CODE
  parts.push(geminiAscii());
  parts.push(renderSeparator());
  parts.push(await renderStatus());
  parts.push(renderSeparator());
  parts.push(renderCommands());
  parts.push(renderSeparator());
  parts.push(renderSpecificationsPrompt());
  return parts.join('\n');
}

export default renderMainMenu;
