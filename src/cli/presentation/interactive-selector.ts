import type { Interface } from 'node:readline';

export interface SelectorChoice<T = string> {
  title: string;
  value: T;
  description?: string;
}

export interface InteractiveSelectorOptions<T = string> {
  heading: string;
  choices: SelectorChoice<T>[];
  onSelect: (value: T) => Promise<void>;
  onComplete: () => void;
}

/**
 * Creates an interactive selector with arrow key navigation for session mode
 * Uses raw mode to capture arrow keys properly in readline sessions
 */
export function createInteractiveSelector<T = string>(
  rl: Interface,
  options: InteractiveSelectorOptions<T>
): {
  start: () => void;
  isActive: () => boolean;
} {
  let isActive = false;
  let selectedIndex = 0;

  const displayChoices = () => {
    console.clear();
    console.log(options.heading);
    options.choices.forEach((choice, index) => {
      const prefix = index === selectedIndex ? '❯ ' : '  ';
      const style = index === selectedIndex ? '\x1b[36m\x1b[4m' : '';
      const reset = index === selectedIndex ? '\x1b[0m' : '';
      const desc = choice.description ? ` - ${choice.description}` : '';
      console.log(`${prefix}${style}${choice.title}${reset}${desc}`);
    });
    console.log('\nUse ↑/↓ arrow keys to navigate, Enter to select, Ctrl+C to cancel');
  };

  const cleanup = () => {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.removeListener('data', onKeyPress);
    }
    isActive = false;
  };

  const onKeyPress = async (chunk: Buffer) => {
    const key = chunk.toString();

    if (key === '\u001b[A') { // Up arrow
      selectedIndex = Math.max(0, selectedIndex - 1);
      displayChoices();
    } else if (key === '\u001b[B') { // Down arrow
      selectedIndex = Math.min(options.choices.length - 1, selectedIndex + 1);
      displayChoices();
    } else if (key === '\r' || key === '\n') { // Enter
      cleanup();
      const selectedChoice = options.choices[selectedIndex];

      // Small delay to ensure cleanup propagates before external commands run
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        await options.onSelect(selectedChoice.value);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
      }
      options.onComplete();
    } else if (key === '\u0003') { // Ctrl+C
      cleanup();
      console.log('\nSelection cancelled.');
      options.onComplete();
    } else if (key >= '1' && key <= '9') { // Number keys
      const num = parseInt(key, 10);
      if (num >= 1 && num <= options.choices.length) {
        cleanup();
        const selectedChoice = options.choices[num - 1];

        // Small delay to ensure cleanup propagates before external commands run
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
          await options.onSelect(selectedChoice.value);
        } catch (error) {
          console.error('Error:', error instanceof Error ? error.message : String(error));
        }
        options.onComplete();
      }
    }
  };

  const start = () => {
    if (options.choices.length === 0) {
      console.log('No choices available.');
      options.onComplete();
      return;
    }

    selectedIndex = 0;
    isActive = true;
    displayChoices();

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', onKeyPress);
    }
  };

  return {
    start,
    isActive: () => isActive
  };
}
