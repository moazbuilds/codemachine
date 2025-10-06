import chalk from 'chalk';

export interface SpinnerState {
  interval: NodeJS.Timeout;
  active: boolean;
  lastOutputTime: number;
  index: number;
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

export function startSpinner(agentName: string): SpinnerState {
  const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const spinnerState: SpinnerState = {
    interval: null as unknown as NodeJS.Timeout,
    active: false,
    lastOutputTime: Date.now(),
    index: 0,
  };

  spinnerState.interval = setInterval(() => {
    const timeSinceLastOutput = Date.now() - spinnerState.lastOutputTime;
    // Only show spinner if no output for 2 seconds
    if (timeSinceLastOutput > 2000) {
      const spinner = spinnerChars[spinnerState.index % spinnerChars.length];
      // Special color for status indicator - dim yellow/orange
      process.stdout.write('\r' + chalk.hex('#FFA500')(`${spinner} ${agentName} is running...`));
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
