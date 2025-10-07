import { homedir } from 'node:os';

/**
 * Expands platform-specific home directory variables in a path.
 *
 * Supported variables:
 * - Linux/Mac: $HOME
 * - Windows CMD: %USERPROFILE%
 * - Windows PowerShell: $env:USERPROFILE
 *
 * @param pathStr - The path string that may contain home directory variables
 * @returns The path with home directory variables expanded
 */
export function expandHomeDir(pathStr: string): string {
  if (!pathStr) {
    return pathStr;
  }

  const homeDirectory = homedir();

  // Replace Unix-style $HOME
  let expanded = pathStr.replace(/\$HOME/g, homeDirectory);

  // Replace Windows CMD-style %USERPROFILE%
  expanded = expanded.replace(/%USERPROFILE%/g, homeDirectory);

  // Replace PowerShell-style $env:USERPROFILE
  expanded = expanded.replace(/\$env:USERPROFILE/g, homeDirectory);

  return expanded;
}
