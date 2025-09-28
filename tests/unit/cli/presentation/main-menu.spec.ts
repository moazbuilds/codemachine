import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock auth status to control login/logout label deterministically.
vi.mock('../../../../src/app/services/auth-status.js', () => {
  return {
    nextAuthMenuAction: vi.fn().mockResolvedValue('login'),
  };
});

describe('renderMainMenu', () => {
  let renderMainMenu: (typeof import('../../../../src/cli/presentation/main-menu.js'))['renderMainMenu'];
  let authModule: typeof import('../../../../src/app/services/auth-status.js');
  const ANSI_COLOR_REGEX = new RegExp(String.raw`\u001B\[[0-9;]*m`, 'g');

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
    vi.mocked(authModule.nextAuthMenuAction).mockResolvedValue('login');
    const output = await renderMainMenu();
    const normalized = output.replace(ANSI_COLOR_REGEX, '');
    expect(normalized).toMatchSnapshot();
  });

  it('renders the branded main menu with logout action', async () => {
    vi.mocked(authModule.nextAuthMenuAction).mockResolvedValue('logout');
    const output = await renderMainMenu();
    const normalized = output.replace(ANSI_COLOR_REGEX, '');
    expect(normalized).toMatchSnapshot();
  });
});
