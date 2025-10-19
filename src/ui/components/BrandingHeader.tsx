import React from 'react';
import { Box, Text } from 'ink';

export interface BrandingHeaderProps {
  workflowName: string;
  runtime: string;
  version: string;
  packageName: string;
}

/**
 * Display workflow header with branding, version, and runtime
 */
export const BrandingHeader: React.FC<BrandingHeaderProps> = ({
  workflowName,
  runtime,
  version,
}) => {
  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold>🤖 CodeMachine v{version} • Multi-Agent Workflow Orchestration</Text>
      </Box>
      <Box justifyContent="space-between">
        <Text>📝 Workflow: {workflowName}</Text>
        <Text>Runtime: {runtime}</Text>
      </Box>
    </Box>
  );
};
