import { AgentMonitorService } from '../../../agents/monitoring/index.js';
import type { AgentRecord, AgentRegistryData } from '../../../agents/monitoring/types.js';
import { getDB } from '../../../agents/monitoring/db/connection.js';
import { writeFileSync } from 'fs';

export async function exportAgents(): Promise<void> {
  const monitor = AgentMonitorService.getInstance();
  const db = getDB();

  // Get all agents
  const agents = monitor.getAllAgents();

  // Get max ID (for lastId)
  const result = db.prepare('SELECT MAX(id) as maxId FROM agents').get() as { maxId: number | null };
  const lastId = result.maxId ?? 0;

  // Build old JSON format
  const agentsMap: Record<number, AgentRecord> = {};

  for (const agent of agents) {
    agentsMap[agent.id] = {
      id: agent.id,
      name: agent.name,
      engine: agent.engine,
      status: agent.status,
      parentId: agent.parentId,
      pid: agent.pid,
      startTime: agent.startTime,
      endTime: agent.endTime,
      duration: agent.duration,
      prompt: agent.prompt,
      logPath: agent.logPath,
      telemetry: agent.telemetry,
      children: agent.children,
      error: agent.error,
      engineProvider: agent.engineProvider,
      modelName: agent.modelName,
    };
  }

  const exportData: AgentRegistryData = {
    lastId,
    agents: agentsMap,
  };

  const outputPath = '.codemachine/logs/registry-export.json';
  writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');

  console.log(outputPath);
}
