import { AgentMonitorService } from './monitor.js';
import { AgentLoggerService } from './logger.js';
import * as logger from '../../shared/logging/logger.js';

/**
 * Handles graceful cleanup of monitoring state on process termination
 * Ensures all running agents are marked as failed/aborted and logs are closed
 */
export class MonitoringCleanup {
  private static isSetup = false;
  private static isCleaningUp = false;

  /**
   * Set up signal handlers for graceful cleanup
   * Should be called once at application startup
   */
  static setup(): void {
    if (this.isSetup) {
      return; // Already set up
    }

    this.isSetup = true;

    // Handle Ctrl+C (SIGINT)
    process.on('SIGINT', () => {
      this.handleSignal('SIGINT', 'User interrupted (Ctrl+C)');
    });

    // Handle termination signal (SIGTERM)
    process.on('SIGTERM', () => {
      this.handleSignal('SIGTERM', 'Process terminated');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught exception:', error);
      this.cleanup('failed', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      logger.error('Unhandled rejection:', error);
      this.cleanup('failed', error);
      process.exit(1);
    });

    logger.debug('MonitoringCleanup signal handlers initialized');
  }

  /**
   * Handle process signal
   */
  private static handleSignal(signal: string, message: string): void {
    console.log(`\n\nReceived ${signal}: ${message}`);
    this.cleanup('aborted', new Error(message));
    process.exit(130); // Standard exit code for Ctrl+C
  }

  /**
   * Clean up all running agents
   */
  private static cleanup(reason: 'failed' | 'aborted', error?: Error): void {
    if (this.isCleaningUp) {
      return; // Already cleaning up, avoid recursion
    }

    this.isCleaningUp = true;

    try {
      const monitor = AgentMonitorService.getInstance();
      const loggerService = AgentLoggerService.getInstance();

      const runningAgents = monitor.getActiveAgents();

      if (runningAgents.length > 0) {
        console.log(`\nCleaning up ${runningAgents.length} running agent(s)...`);

        runningAgents.forEach((agent) => {
          try {
            // Mark agent as failed with appropriate error
            const errorMsg = error || new Error(`Agent ${reason}: ${agent.name}`);
            monitor.fail(agent.id, errorMsg);

            // Close log stream
            loggerService.closeStream(agent.id);

            logger.debug(`Marked agent ${agent.id} (${agent.name}) as ${reason}`);
          } catch (cleanupError) {
            logger.error(`Failed to cleanup agent ${agent.id}:`, cleanupError);
          }
        });

        console.log('Cleanup complete.\n');
      }
    } catch (error) {
      logger.error('Error during cleanup:', error);
    } finally {
      this.isCleaningUp = false;
    }
  }

  /**
   * Manually trigger cleanup (for testing or explicit cleanup)
   */
  static forceCleanup(): void {
    this.cleanup('failed', new Error('Manual cleanup'));
  }
}
