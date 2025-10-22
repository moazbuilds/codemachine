import React from 'react';
import { Text } from 'ink';

export interface BrandingHeaderProps {
  version: string;
  currentDir: string;
}

/**
 * Display package branding with ASCII art, version and current directory
 */
export const BrandingHeader: React.FC<BrandingHeaderProps> = ({
  version,
  currentDir,
}) => {
  return (
    <Text color="cyan">
      {` _____       _     _____         _   _
|     |___ _| |___|     |___ ___| |_|_|___ ___
|   --| . | . | -_| | | | .'|  _|   | |   | -_| v${version}
|_____|___|___|___|_|_|_|__,|___|_|_|_|_|_|___| ${currentDir}`}
    </Text>
  );
};
