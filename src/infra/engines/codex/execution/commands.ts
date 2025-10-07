export interface CodexCommandOptions {
  profile: string;
  workingDir: string;
  prompt: string;
}

export interface CodexCommand {
  command: string;
  args: string[];
}

export function buildCodexExecCommand(options: CodexCommandOptions): CodexCommand {
  const { profile, workingDir, prompt } = options;

  // On Windows with shell: true, we need to wrap the prompt in escaped quotes
  // to prevent cmd.exe from splitting it on spaces
  const isWindows = process.platform === 'win32';
  const escapedPrompt = isWindows && prompt.includes(' ')
    ? `"${prompt.replace(/"/g, '\\"')}"`
    : prompt;

  return {
    command: 'codex',
    args: [
      'exec',
      '--profile',
      profile,
      '--skip-git-repo-check',
      '--sandbox',
      'danger-full-access',
      '--dangerously-bypass-approvals-and-sandbox',
      '-C',
      workingDir,
      escapedPrompt,
    ],
  };
}
