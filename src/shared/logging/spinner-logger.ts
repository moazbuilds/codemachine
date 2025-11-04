import chalk from 'chalk';
import readline from 'readline';

export interface SpinnerState {
  interval: NodeJS.Timeout;
  active: boolean;
  lastOutputTime: number;
  lastClearTime: number;
  index: number;
  workflowStartTime: number;
}

/**
 * Check if Ink UI is active by detecting if stdout is in raw mode
 * When Ink is running, it takes control of the terminal
 */
function isInkUIActive(): boolean {
  // Check if stdout is a TTY and in raw mode (Ink uses raw mode)
  interface ReadStreamWithRaw extends NodeJS.ReadStream {
    isRaw: boolean;
  }
  return Boolean(process.stdout.isTTY && (process.stdin as ReadStreamWithRaw).isRaw);
}

function clearStatusLine(): void {
  // Don't interfere with Ink's rendering
  if (isInkUIActive()) {
    return;
  }
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
}

export function createSpinnerLoggers(
  baseStdoutLogger: (chunk: string) => void,
  baseStderrLogger: (chunk: string) => void,
  spinnerState: SpinnerState,
) {
  const stdoutLogger = (chunk: string) => {
    const now = Date.now();
    // Always clear spinner if active to prevent text overlap
    if (spinnerState.active) {
      clearStatusLine();
      spinnerState.active = false;
      spinnerState.lastClearTime = now;
    }
    spinnerState.lastOutputTime = now;
    baseStdoutLogger(chunk);
  };
  const stderrLogger = (chunk: string) => {
    const now = Date.now();
    // Always clear spinner if active to prevent text overlap
    if (spinnerState.active) {
      clearStatusLine();
      spinnerState.active = false;
      spinnerState.lastClearTime = now;
    }
    spinnerState.lastOutputTime = now;
    baseStderrLogger(chunk);
  };
  return { stdoutLogger, stderrLogger };
}

function formatElapsedTime(startTime: number): string {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function startSpinner(
  agentName: string,
  engine?: string,
  workflowStartTime?: number,
  model?: string,
  reasoningEffort?: 'low' | 'medium' | 'high' | string,
  stepInfo?: { current: number; total: number },
): SpinnerState {
  const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const now = Date.now();
  const spinnerState: SpinnerState = {
    interval: null as unknown as NodeJS.Timeout,
    active: false,
    lastOutputTime: now,
    lastClearTime: 0, // Initialize to 0 to allow first clear immediately
    index: 0,
    workflowStartTime: workflowStartTime || now,
  };

  spinnerState.interval = setInterval(() => {
    // Don't render spinner if Ink UI is active (prevents stdout conflicts)
    if (isInkUIActive()) {
      return;
    }

    const now = Date.now();
    const timeSinceLastOutput = now - spinnerState.lastOutputTime;
    const timeSinceLastClear = now - spinnerState.lastClearTime;

    // Only show spinner if:
    // 1. No output for 2 seconds
    // 2. At least 1 second has passed since we last cleared it (prevents rapid reappearing)
    if (timeSinceLastOutput > 2000 && timeSinceLastClear > 1000) {
      const spinner = spinnerChars[spinnerState.index % spinnerChars.length];
      // Format engine name with proper capitalization
      const engineDisplay = engine ? ` - Engine: ${engine.charAt(0).toUpperCase() + engine.slice(1)}` : '';
      const modelDisplay = model ? ` | Model: ${model}` : '';
      const reasoningDisplay = reasoningEffort ? ` | Reasoning: ${reasoningEffort}` : '';
      const runtime = formatElapsedTime(spinnerState.workflowStartTime);
      // Special color for status indicator - dim yellow/orange
      const stepDisplay = stepInfo ? ` (Step ${stepInfo.current}/${stepInfo.total})` : '';
      const baseMessage = `${spinner} ${agentName}${stepDisplay} is running${engineDisplay}${modelDisplay}${reasoningDisplay}... | Workflow Runtime: ${runtime}`;
      const columns = typeof process.stdout.columns === 'number' && process.stdout.columns > 0 ? process.stdout.columns : 80;
      const ellipsis = '...';
      const needsTruncate = baseMessage.length > columns;
      const maxContentWidth = Math.max(columns - ellipsis.length, 0);
      const truncatedMessage =
        needsTruncate && maxContentWidth > 0 ? `${baseMessage.slice(0, maxContentWidth)}${ellipsis}` : baseMessage.slice(0, columns);
      clearStatusLine();
      process.stdout.write(chalk.hex('#FFA500')(truncatedMessage));
      spinnerState.active = true;
      spinnerState.index++;
    }
  }, 100);

  return spinnerState;
}

export function stopSpinner(spinnerState: SpinnerState): void {
  clearInterval(spinnerState.interval);
  clearStatusLine(); // Clear the status line
}
