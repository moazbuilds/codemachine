import * as path from 'node:path';
import {
  type RunWorkflowOptions,
  type WorkflowStep,
  type WorkflowTemplate,
} from '../templates/types.js';
import { runWorkflow } from './workflow-runner.js';
import { validateSpecification } from '../../../../runtime/services/index.js';

export type { WorkflowStep, WorkflowTemplate };

export type RunWorkflowQueueOptions = RunWorkflowOptions;

export async function runWorkflowQueue(options: RunWorkflowQueueOptions = {}): Promise<void> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const specificationPath = options.specificationPath || path.resolve(cwd, '.codemachine', 'inputs', 'specifications.md');

  await validateSpecification(specificationPath, options.force);
  await runWorkflow(options);
}

export default runWorkflowQueue;
