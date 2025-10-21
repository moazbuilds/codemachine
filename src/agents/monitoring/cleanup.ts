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
    process.on('SIGINT', async () => {
      await this.handleSignal('SIGINT', 'User interrupted (Ctrl+C)');
    });

    // Handle termination signal (SIGTERM)
    process.on('SIGTERM', async () => {
      await this.handleSignal('SIGTERM', 'Process terminated');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error: Error) => {
      logger.error('Uncaught exception:', error);
      await this.cleanup('failed', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason: unknown) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      logger.error('Unhandled rejection:', error);
      await this.cleanup('failed', error);
      process.exit(1);
    });

    logger.debug('MonitoringCleanup signal handlers initialized');
  }

  /**
   * Handle process signal
   */
  private static async handleSignal(signal: string, message: string): Promise<void> {
    console.log(`\n\nReceived ${signal}: ${message}`);
    await this.cleanup('aborted', new Error(message));
    process.exit(130); // Standard exit code for Ctrl+C
  }

  /**
   * Clean up all running agents
   */
  private static async cleanup(reason: 'failed' | 'aborted', error?: Error): Promise<void> {
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

        for (const agent of runningAgents) {
          try {
            // Mark agent as failed with appropriate error
            const errorMsg = error || new Error(`Agent ${reason}: ${agent.name}`);
            monitor.fail(agent.id, errorMsg);

            // Close log stream (now async)
            await loggerService.closeStream(agent.id);

            logger.debug(`Marked agent ${agent.id} (${agent.name}) as ${reason}`);
          } catch (cleanupError) {
            logger.error(`Failed to cleanup agent ${agent.id}:`, cleanupError);
          }
        }

        // Release any remaining locks
        await loggerService.releaseAllLocks();

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
  static async forceCleanup(): Promise<void> {
    await this.cleanup('failed', new Error('Manual cleanup'));
  }
}
