/**
 * CCR Engine
 *
 * Provides Claude Code Router CLI integration.
 * Supports model mapping and authentication management.
 */

import type { EngineModule } from '../../core/base.js';
import { metadata } from './metadata.js';
import * as auth from './auth.js';
import { runCcr } from './execution/index.js';

// Export all sub-modules
export * from './auth.js';
export * from './execution/index.js';
export { metadata };

// Export as EngineModule for auto-discovery
export default {
  metadata,
  auth,
  run: runCcr,
} satisfies EngineModule;