import { banner, formatKeyValue, palette, section } from './layout.js';
import { nextAuthMenuAction } from '../../app/services/auth-status.js';

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

function renderStatus(): string {
  const mode = 'build';
  return [
    section('Status'),
    formatKeyValue('Mode', palette.success(mode)),
  ].join('\n');
}

async function renderCommands(): Promise<string> {
  const auth = await nextAuthMenuAction();
  const lines = [
    section('Commands'),
    formatKeyValue('/start', 'Plan and build from specifications'),
    formatKeyValue('/templates', 'Browse available templates'),
    formatKeyValue(`/${auth}`, auth === 'login' ? 'Authenticate with Codex services' : 'Sign out of Codex services'),
    formatKeyValue('/version', 'Show CLI version'),
    formatKeyValue('/help', 'Show command help'),
    formatKeyValue('/mcp', 'Manage MCP tools and connections'),
  ];
  return lines.join('\n');
}

function renderSpecificationsPrompt(): string {
  const title = section('Specifications');
  const line1 = 'Have you written the full specification in .codemachine/inputs/specifications.md?';
  const line2 = 'Add any necessary context files, then run /start to begin.';
  return [title, line1, line2].join('\n');
}

export async function renderMainMenu(): Promise<string> {
  const parts: string[] = [];
  parts.push(banner('CodeMachine - CLI Coding Agent Specification'));
  // Render left-aligned ASCII with MACHINE centered under CODE
  parts.push(geminiAscii());
  parts.push(renderStatus());
  parts.push(await renderCommands());
  parts.push(renderSpecificationsPrompt());
  return parts.join('\n');
}

export default renderMainMenu;
