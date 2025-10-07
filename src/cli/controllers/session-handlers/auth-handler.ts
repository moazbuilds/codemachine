import type { Interface } from 'node:readline';
import { createInteractiveSelector } from '../../presentation/interactive-selector.js';
import { ensureAuth as ensureCodexAuth, clearAuth as clearCodexAuth } from '../../../infra/engines/codex/index.js';
import { ensureAuth as ensureClaudeAuth, clearAuth as clearClaudeAuth } from '../../../infra/engines/claude/auth.js';

type AuthProvider = 'claude' | 'codex';
type AuthAction = 'login' | 'logout';

export function createAuthHandler(rl: Interface, onComplete: () => void) {
  let selector: ReturnType<typeof createInteractiveSelector> | null = null;

  const handleAuthAction = async (action: AuthAction) => {
    const providers = [
      { title: 'Claude', value: 'claude' as AuthProvider, description: 'Authenticate with Claude AI' },
      { title: 'Codex', value: 'codex' as AuthProvider, description: 'Authenticate with Codex AI' }
    ];

    selector = createInteractiveSelector(rl, {
      heading: `\nChoose authentication provider to ${action}:\n`,
      choices: providers,
      onSelect: async (provider: AuthProvider) => {
        // Pause readline completely to prevent it from consuming stdin
        rl.pause();

        // Also close the internal readline to fully release stdin
        const closePromise = new Promise<void>((resolve) => {
          rl.once('close', resolve);
        });

        // Don't actually close, just pause and remove listeners temporarily
        const originalListeners = rl.listeners('line');
        rl.removeAllListeners('line');

        try {
          if (action === 'login') {
            if (provider === 'claude') {
              await ensureClaudeAuth();
              console.log('Claude authentication successful.');
            } else {
              await ensureCodexAuth();
              console.log('Codex authentication successful.');
            }
          } else {
            if (provider === 'claude') {
              await clearClaudeAuth();
              console.log('Signed out from Claude.');
            } else {
              await clearCodexAuth();
              console.log('Signed out from Codex.');
            }
          }
        } catch (error) {
          console.error('Error during authentication:', error instanceof Error ? error.message : String(error));
        } finally {
          // Restore listeners
          originalListeners.forEach(listener => {
            rl.on('line', listener as (...args: any[]) => void);
          });
          rl.resume();
        }
      },
      onComplete
    });

    selector.start();
  };

  return {
    handleLogin: () => handleAuthAction('login'),
    handleLogout: () => handleAuthAction('logout'),
    isActive: () => selector?.isActive() ?? false
  };
}
