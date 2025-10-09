import type { Interface } from 'node:readline';
import { createInteractiveSelector } from '../../presentation/interactive-selector.js';
import { registry } from '../../../infra/engines/index.js';

type AuthAction = 'login' | 'logout';

export function createAuthHandler(rl: Interface, onComplete: () => void) {
  let selector: ReturnType<typeof createInteractiveSelector> | null = null;

  const handleAuthAction = async (action: AuthAction) => {
    const providers = registry.getAll().map(engine => ({
      title: engine.metadata.name,
      value: engine.metadata.id,
      description: engine.metadata.description
    }));

    selector = createInteractiveSelector(rl, {
      heading: `\nChoose authentication provider to ${action}:\n`,
      choices: providers,
      onSelect: async (providerId: string) => {
        // Pause readline completely to prevent it from consuming stdin
        rl.pause();

        // Don't actually close, just pause and remove listeners temporarily
        const originalListeners = rl.listeners('line');
        rl.removeAllListeners('line');

        try {
          const engine = registry.get(providerId);
          if (!engine) {
            throw new Error(`Unknown provider: ${providerId}`);
          }

          if (action === 'login') {
            await engine.auth.ensureAuth();
            console.log(`${engine.metadata.name} authentication successful.`);
          } else {
            await engine.auth.clearAuth();
            console.log(`Signed out from ${engine.metadata.name}.`);
          }
        } catch (error) {
          console.error('Error during authentication:', error instanceof Error ? error.message : String(error));
        } finally {
          // Restore listeners
          originalListeners.forEach(listener => {
            rl.on('line', listener as (line: string) => void);
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
