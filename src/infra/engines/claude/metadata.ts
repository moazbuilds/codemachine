import type { EngineMetadata } from '../base/types.js';

export const metadata: EngineMetadata = {
  id: 'claude',
  name: 'Claude',
  description: 'Authenticate with Claude AI',
  cliCommand: 'claude',
  cliBinary: 'claude',
  installCommand: 'npm install -g @anthropic-ai/claude-code',
  defaultModel: 'sonnet',
  order: 2,
  experimental: true,
};
