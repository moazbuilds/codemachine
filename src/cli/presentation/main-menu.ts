import * as path from 'node:path';
import { banner, formatKeyValue, palette, divider } from './layout.js';
import { getActiveTemplate } from '../../shared/agents/template-tracking.js';

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

  return formatKeyValue('Template', palette.success(`${templateName.toUpperCase()} - READY`));
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
