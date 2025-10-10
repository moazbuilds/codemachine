export interface CodexCommandOptions {
  workingDir: string;
  prompt: string;
  model?: string;
  modelReasoningEffort?: 'low' | 'medium' | 'high';
}

export interface CodexCommand {
  command: string;
  args: string[];
}

export function buildCodexExecCommand(options: CodexCommandOptions): CodexCommand {
  const { workingDir, model, modelReasoningEffort } = options;

  const args = [
    'exec',
    '--json',
    '--skip-git-repo-check',
    '--sandbox',
    'danger-full-access',
    '--dangerously-bypass-approvals-and-sandbox',
    '-C',
    workingDir,
  ];

  // Add model if specified
  if (model) {
    args.push('--model', model);
  }

  // Add reasoning effort if specified
  if (modelReasoningEffort) {
    args.push('--config', `model_reasoning_effort="${modelReasoningEffort}"`);
  }

  args.push('-'); // Explicitly signal stdin prompt
  // Prompt is now passed via stdin instead of as an argument

  return {
    command: 'codex',
    args,
  };
}
