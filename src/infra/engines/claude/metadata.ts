import type { EngineMetadata } from '../base/types.js';

export const metadata: EngineMetadata = {
  id: 'claude',
  name: 'Claude',
  description: 'Authenticate with Claude AI',
  cliCommand: 'claude',
  order: 2,
  experimental: true,
};
