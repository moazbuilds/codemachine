import { createRequire } from 'node:module';
import * as path from 'node:path';
import updateNotifier from 'update-notifier';
import { formatKeyValue, palette, divider } from './layout.js';
import { getActiveTemplate } from '../../shared/workflows/index.js';
import { clearTerminal } from '../../shared/utils/terminal.js';
import { resolvePackageJson } from '../../shared/utils/package-json.js';

function getPackageInfo(): { version: string; name: string } {
  const require = createRequire(import.meta.url);
  const packageJsonPath = resolvePackageJson(import.meta.url, 'main menu module');
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
        const updateText = `${palette.warning('Update available:')} ${palette.dim(`v${latest} (${type})`)}`;
        const commandText = palette.dim('Run:') + ' ' + palette.success('npm i -g codemachine@latest');
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



export async function renderMainMenu(_specificationPath?: string): Promise<string> {
  // Clear terminal before showing main menu
  clearTerminal();

  const parts: string[] = [];
  parts.push(geminiAscii());
  parts.push(renderSeparator());
  parts.push(await renderStatus());
  parts.push(renderSeparator());
  return parts.join('\n');
}

export default renderMainMenu;
