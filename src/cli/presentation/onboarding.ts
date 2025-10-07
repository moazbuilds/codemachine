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
  lines.push(center('┌─────────────────────────────────────────────────────────────┐'));
  lines.push(center('│  AI engine authentication is needed before agents can run   │'));
  lines.push(center('│                                                             │'));
  lines.push(center('│         You will choose between Codex and Claude            │'));
  lines.push(center('└─────────────────────────────────────────────────────────────┘'));
  lines.push('');
  lines.push(center('╔═══════════════════════════════════════════════════════════╗'));
  lines.push(center('║  💡 TIP: Run multiple AI engines in one workflow!         ║'));
  lines.push(center('║                                                           ║'));
  lines.push(center('║  Add more engines anytime with:                           ║'));
  lines.push(center('║    • /login (in session)                                  ║'));
  lines.push(center('║    • codemachine auth login (from terminal)               ║'));
  lines.push(center('╚═══════════════════════════════════════════════════════════╝'));
  lines.push('');
  lines.push(section('Need a Manual Command?'));
  lines.push(formatKeyValue('Fallback', palette.primary('codemachine auth login')));
  lines.push('Run the fallback command in a separate terminal if the automatic login fails.');
  return lines.join('\n');
}

export const SESSION_INSTRUCTION =
  'Type /start when you want to kick off the workflow, or /help to see all commands.';
