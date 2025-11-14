import { createRequire } from 'node:module';
import React, { useState } from 'react';
import { render } from 'ink';

import { renderMainMenu } from '../presentation/main-menu.js';
import { renderTypewriter } from '../presentation/typewriter.js';
import { SessionShell } from '../components/SessionShell.js';
import { SelectMenu, type SelectChoice } from '../components/SelectMenu.js';
import { runWorkflowQueue } from '../../workflows/index.js';
import { clearTerminal } from '../../shared/utils/terminal.js';
import { debug } from '../../shared/logging/logger.js';
import { registry } from '../../infra/engines/index.js';
import { handleLogin, handleLogout } from '../commands/auth.command.js';
import { getAvailableTemplates, selectTemplateByNumber } from '../commands/templates.command.js';
import { resolvePackageJson } from '../../shared/utils/package-json.js';

export interface SessionShellOptions {
  cwd: string;
  specificationPath: string;
  specDisplayPath?: string; // Original path for display purposes
  showIntro?: boolean;
}

type ViewState =
  | { type: 'main' }
  | { type: 'login-select' }
  | { type: 'logout-select' }
  | { type: 'template-select' };

interface SessionWrapperProps {
  onCommand: (command: string) => Promise<void>;
  onExit: () => void;
  projectName?: string;
}

const TemplateSelectView: React.FC<{ onSelect: (templateNumber: number) => void; onCancel: () => void }> = ({ onSelect, onCancel }) => {
  const [templates, setTemplates] = useState<SelectChoice<number>[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    getAvailableTemplates().then(templateChoices => {
      const choices = templateChoices.map((t, index) => ({
        title: t.title,
        value: index + 1,
        description: t.description,
      }));
      setTemplates(choices);
      setLoading(false);
    }).catch(error => {
      console.error('Error loading templates:', error);
      onCancel();
    });
  }, []);

  if (loading || templates.length === 0) {
    return null;
  }

  return React.createElement(SelectMenu<number>, {
    message: 'Choose a workflow template:',
    choices: templates,
    onSelect: (value: number) => onSelect(value),
    onCancel,
  });
};

const SessionWrapper: React.FC<SessionWrapperProps> = ({ onCommand, onExit, projectName }) => {
  const [view, setView] = useState<ViewState>({ type: 'main' });

  const handleCommand = async (command: string): Promise<void> => {
    if (command === '/login') {
      setView({ type: 'login-select' });
    } else if (command === '/logout') {
      setView({ type: 'logout-select' });
    } else if (command === '/templates' || command === '/template') {
      setView({ type: 'template-select' });
    } else {
      await onCommand(command);
    }
  };

  const returnToMain = () => {
    setView({ type: 'main' });
  };

  // Render main session shell
  if (view.type === 'main') {
    return React.createElement(SessionShell, {
      onCommand: handleCommand,
      onExit,
      projectName,
    });
  }

  // Render login provider selection
  if (view.type === 'login-select') {
    const providers = registry.getAll().map(engine => ({
      title: engine.metadata.name,
      value: engine.metadata.id,
      description: engine.metadata.description,
    }));

    return React.createElement(SelectMenu<string>, {
      message: 'Choose authentication provider to login:',
      choices: providers,
      onSelect: (providerId: string) => {
        returnToMain();
        handleLogin(providerId).catch(error => {
          console.error('Login error:', error instanceof Error ? error.message : String(error));
        });
      },
      onCancel: returnToMain,
    });
  }

  // Render logout provider selection
  if (view.type === 'logout-select') {
    const providers = registry.getAll().map(engine => ({
      title: engine.metadata.name,
      value: engine.metadata.id,
      description: engine.metadata.description,
    }));

    return React.createElement(SelectMenu<string>, {
      message: 'Choose authentication provider to logout:',
      choices: providers,
      onSelect: (providerId: string) => {
        returnToMain();
        handleLogout(providerId).catch(error => {
          console.error('Logout error:', error instanceof Error ? error.message : String(error));
        });
      },
      onCancel: returnToMain,
    });
  }

  // Render template selection
  if (view.type === 'template-select') {
    return React.createElement(TemplateSelectView, {
      onSelect: (templateNumber: number) => {
        returnToMain();
        selectTemplateByNumber(templateNumber).catch(error => {
          console.error('Template selection error:', error instanceof Error ? error.message : String(error));
        });
      },
      onCancel: returnToMain,
    });
  }

  return null;
};

export async function runSessionShell(options: SessionShellOptions): Promise<void> {
  const { cwd, specificationPath, specDisplayPath } = options;
  const showIntro = options.showIntro ?? true;

  if (showIntro) {
    const menu = await renderMainMenu(specDisplayPath);
    await renderTypewriter({ text: menu + '\n' });
  }

  const require = createRequire(import.meta.url);
  const packageJsonPath = resolvePackageJson(import.meta.url, 'CLI module');
  const pkg = require(packageJsonPath) as { version: string };

  let inkInstance: ReturnType<typeof render> | null = null;

  const handleCommand = async (command: string): Promise<void> => {
    if (command === '/start') {
      // Unmount Ink UI to release stdin control
      if (inkInstance) {
        inkInstance.unmount();
        inkInstance = null;
      }

      try {
        // Clear terminal for clean workflow start
        clearTerminal();

        debug(`Launching workflow queue (spec=${specificationPath})`);
        await runWorkflowQueue({ cwd, specificationPath });

        // If workflow completes normally, it calls process.exit()
        // We only reach here if there's an error during workflow startup
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    } else if (command === '/help' || command === '/h') {
      console.log([
        '',
        'Available commands:',
        '  /start                Run configured workflow queue',
        '  /templates            List and select workflow templates',
        '  /login                Authenticate with AI services',
        '  /logout               Sign out of AI services',
        '  /version              Show CLI version',
        '  /help                 Show this help',
        '  /exit                 Exit the session',
        '',
      ].join('\n'));
    } else if (command === '/version') {
      console.log(`CodeMachine v${pkg.version}`);
    } else {
      throw new Error(`Unrecognized command: ${command}. Type /help for options.`);
    }
  };

  const handleExit = (): void => {
    if (inkInstance) {
      inkInstance.unmount();
      inkInstance = null;
    }
    process.exit(0);
  };

  const startInkUI = (): void => {
    // Ensure we don't have multiple instances
    if (inkInstance) {
      inkInstance.unmount();
      inkInstance = null;
    }

    inkInstance = render(
      React.createElement(SessionWrapper, {
        onCommand: handleCommand,
        onExit: handleExit,
        projectName: specDisplayPath,
      }),
      {
        exitOnCtrlC: true,
      }
    );
  };

  // Start the Ink UI (don't clear to preserve main menu)
  startInkUI();
}
