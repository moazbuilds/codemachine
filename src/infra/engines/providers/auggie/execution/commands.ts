export interface AuggieCommandOptions {
  /**
   * Model identifier (if supported by Auggie)
   */
  model?: string;
}

export interface AuggieCommand {
  command: string;
  args: string[];
}

export function buildAuggieRunCommand(options: AuggieCommandOptions = {}): AuggieCommand {
  const args: string[] = ['--print', '--quiet', '--output-format', 'json'];

  // Add model if specified (check Auggie docs for exact flag)
  if (options.model?.trim()) {
    args.push('--model', options.model.trim());
  }

  return {
    command: 'auggie',
    args,
  };
}

