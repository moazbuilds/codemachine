import chalk from 'chalk';
import readline from 'readline';

export interface SpinnerState {
  interval: NodeJS.Timeout;
  active: boolean;
  lastOutputTime: number;
  index: number;
  workflowStartTime: number;
}

function clearStatusLine(): void {
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
}

export function createSpinnerLoggers(
  baseStdoutLogger: (chunk: string) => void,
  baseStderrLogger: (chunk: string) => void,
  spinnerState: SpinnerState,
) {
  const stdoutLogger = (chunk: string) => {
    if (spinnerState.active) {
      clearStatusLine();
      spinnerState.active = false;
    }
    spinnerState.lastOutputTime = Date.now();
    baseStdoutLogger(chunk);
  };
  const stderrLogger = (chunk: string) => {
    if (spinnerState.active) {
      clearStatusLine();
      spinnerState.active = false;
    }
    spinnerState.lastOutputTime = Date.now();
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

export function startSpinner(agentName: string, engine?: string, workflowStartTime?: number): SpinnerState {
  const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const spinnerState: SpinnerState = {
    interval: null as unknown as NodeJS.Timeout,
    active: false,
    lastOutputTime: Date.now(),
    index: 0,
    workflowStartTime: workflowStartTime || Date.now(),
  };

  spinnerState.interval = setInterval(() => {
    const timeSinceLastOutput = Date.now() - spinnerState.lastOutputTime;
    // Only show spinner if no output for 2 seconds
    if (timeSinceLastOutput > 2000) {
      const spinner = spinnerChars[spinnerState.index % spinnerChars.length];
      // Format engine name with proper capitalization
      const engineDisplay = engine ? ` - Engine: ${engine.charAt(0).toUpperCase() + engine.slice(1)}` : '';
      const runtime = formatElapsedTime(spinnerState.workflowStartTime);
      // Special color for status indicator - dim yellow/orange
      const baseMessage = `${spinner} ${agentName} is running${engineDisplay}... | Workflow Runtime: ${runtime}`;
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
