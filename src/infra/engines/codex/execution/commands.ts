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
  const { profile, workingDir } = options;

  return {
    command: 'codex',
    args: [
      'exec',
      '--json',
      '--profile',
      profile,
      '--skip-git-repo-check',
      '--sandbox',
      'danger-full-access',
      '--dangerously-bypass-approvals-and-sandbox',
      '-C',
      workingDir,
      // Prompt is now passed via stdin instead of as an argument
    ],
  };
}
