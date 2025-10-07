// Config exports
export { resolveAgentsModulePath } from './config/paths.js';
export type { AgentsModuleLookupOptions } from './config/paths.js';
export type { AgentDefinition } from './config/types.js';
export { AGENT_MODULE_FILENAMES } from './config/types.js';

// Discovery exports
export {
  collectAgentDefinitions,
  mergeAdditionalAgents,
  resolveProjectRoot,
  loadAgentsFromModule
} from './discovery/catalog.js';

export { collectAgentsFromWorkflows } from './discovery/steps.js';
export type { WorkflowAgentDefinition } from './discovery/steps.js';
