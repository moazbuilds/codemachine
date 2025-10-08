import chalk from 'chalk';

export interface SpinnerState {
  interval: NodeJS.Timeout;
  active: boolean;
  lastOutputTime: number;
  index: number;
  workflowStartTime: number;
}

export function createSpinnerLoggers(
  baseStdoutLogger: (chunk: string) => void,
  baseStderrLogger: (chunk: string) => void,
  spinnerState: SpinnerState,
) {
  const stdoutLogger = (chunk: string) => {
    if (spinnerState.active) {
      process.stdout.write('\r' + ' '.repeat(100) + '\r');
      spinnerState.active = false;
    }
    spinnerState.lastOutputTime = Date.now();
    baseStdoutLogger(chunk);
  };
  const stderrLogger = (chunk: string) => {
    if (spinnerState.active) {
      process.stdout.write('\r' + ' '.repeat(100) + '\r');
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
      process.stdout.write('\r' + chalk.hex('#FFA500')(`${spinner} ${agentName} is running${engineDisplay}... | Workflow Runtime: ${runtime}`));
      spinnerState.active = true;
      spinnerState.index++;
    }
  }, 100);

  return spinnerState;
}

export function stopSpinner(spinnerState: SpinnerState): void {
  clearInterval(spinnerState.interval);
  process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the status line
}
