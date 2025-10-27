import type { EngineMetadata } from '../../core/base.js';

export const metadata: EngineMetadata = {
  id: 'ccr',
  name: 'CCR',
  description: 'Authenticate with Claude Code Router',
  cliCommand: 'ccr',
  cliBinary: 'ccr',
  installCommand: 'npm install -g @musistudio/claude-code-router',
  defaultModel: 'sonnet',
  order: 3,
  experimental: false,
};