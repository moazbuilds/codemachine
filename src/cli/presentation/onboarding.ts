import { banner, center, formatKeyValue, palette, section } from './layout.js';

export function renderWelcomeScreen(): string {
  const lines: string[] = [];
  lines.push(banner('Welcome to Codemachine'));
  lines.push(center('Your multi-agent coding copilots are getting ready.'));
  lines.push(center('We will verify authentication before launching the workspace.'));
  return lines.join('\n');
}

export function renderLoginScreen(): string {
  const lines: string[] = [];
  lines.push(banner('Authentication Required'));
  lines.push('');
  lines.push(section('Need a Manual Command?'));
  lines.push(formatKeyValue('Fallback', palette.primary('codemachine auth login')));
  lines.push('Run the fallback command in a separate terminal if the automatic login fails.');
  return lines.join('\n');
}

export const SESSION_INSTRUCTION =
  'Type /start when you want to kick off the workflow, or /help to see all commands.';
