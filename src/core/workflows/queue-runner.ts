import {
  type RunWorkflowOptions,
  type WorkflowStep,
  type WorkflowTemplate,
  runWorkflow,
} from './workflow-manager.js';

export type { WorkflowStep, WorkflowTemplate };

export type RunWorkflowQueueOptions = RunWorkflowOptions;

export async function runWorkflowQueue(options: RunWorkflowQueueOptions = {}): Promise<void> {
  await runWorkflow(options);
}

export default runWorkflowQueue;
