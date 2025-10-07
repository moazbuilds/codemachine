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
      prompt,
    ],
  };
}
