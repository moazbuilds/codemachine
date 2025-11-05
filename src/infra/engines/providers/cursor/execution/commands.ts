export interface CursorCommandOptions {
  workingDir: string;
  prompt: string;
  model?: string;
  cursorConfigDir?: string;
}

export interface CursorCommand {
  command: string;
  args: string[];
}

/**
 * Model mapping from config models to Cursor model names
 * If model is not in this map, it will be passed as-is to Cursor
 */
const MODEL_MAP: Record<string, string> = {
  'gpt-5-codex': 'gpt-5-codex',
  'gpt-4': 'gpt-5',
  'gpt-3.5-turbo': 'cheetah',
  'sonnet': 'sonnet-4.5',
  'claude-sonnet-4.5': 'sonnet-4.5',
  'opus': 'opus-4.1',
  'grok': 'grok',
};

/**
 * Maps a model name from config to Cursor's model naming convention
 * Returns undefined if the model should use Cursor's default (auto)
 */
function mapModel(model?: string): string | undefined {
  if (!model) {
    return undefined;
  }

  // If it's in our mapping, use the mapped value
  if (model in MODEL_MAP) {
    return MODEL_MAP[model];
  }

  // If it's already a Cursor model name, pass it through
  const validModels = ['auto', 'cheetah', 'sonnet-4.5', 'sonnet-4.5-thinking', 'gpt-5', 'gpt-5-codex', 'opus-4.1', 'grok'];
  if (validModels.includes(model)) {
    return model;
  }

  // Otherwise, don't use a model flag and let Cursor use its default (auto)
  return undefined;
}

export function buildCursorExecCommand(options: CursorCommandOptions): CursorCommand {
  const { model, cursorConfigDir } = options;

  // Base args: -p for print mode, --force, streaming JSON output
  const args: string[] = [
    '-p',
    '--force',
    '--output-format',
    'stream-json',
  ];

  // Add model if specified and valid
  const mappedModel = mapModel(model);
  if (mappedModel) {
    args.push('--model', mappedModel);
  }

  // Add custom config directory if specified
  if (cursorConfigDir) {
    args.push(cursorConfigDir);
  }

  // Prompt is now passed via stdin instead of as an argument
  // Call cursor-agent directly - the runner passes cwd and prompt to spawnProcess
  return {
    command: 'cursor-agent',
    args,
  };
}
