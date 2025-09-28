import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock auth status to control login/logout label deterministically.
vi.mock('../../../../src/app/services/auth-status.js', () => {
  return {
    nextAuthMenuAction: vi.fn().mockResolvedValue('login'),
  };
});

describe('renderMainMenu', () => {
  let renderMainMenu: (typeof import('../../../../src/cli/presentation/main-menu.js'))['renderMainMenu'];
  let authModule: any;

  beforeEach(async () => {
    // Load modules fresh for each test so mocks apply
    const mod = await import('../../../../src/cli/presentation/main-menu.js');
    renderMainMenu = mod.renderMainMenu;
    authModule = await import('../../../../src/app/services/auth-status.js');
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('renders the branded main menu with login action', async () => {
    (authModule.nextAuthMenuAction as any).mockResolvedValue('login');
    const output = await renderMainMenu();
    const normalized = output.replace(/\u001b\[[0-9;]*m/g, '');
    expect(normalized).toMatchSnapshot();
  });

  it('renders the branded main menu with logout action', async () => {
    (authModule.nextAuthMenuAction as any).mockResolvedValue('logout');
    const output = await renderMainMenu();
    const normalized = output.replace(/\u001b\[[0-9;]*m/g, '');
    expect(normalized).toMatchSnapshot();
  });
});
