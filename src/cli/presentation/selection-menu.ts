import prompts from 'prompts';

export interface SelectionChoice<T = string> {
  title: string;
  value: T;
  description?: string;
}

export interface SelectionOptions<T = string> {
  message: string;
  choices: SelectionChoice<T>[];
  initial?: number;
}

/**
 * Presents an interactive selection menu to the user with up/down arrow navigation
 * @returns The selected value or undefined if cancelled
 */
export async function selectFromMenu<T = string>(
  options: SelectionOptions<T>
): Promise<T | undefined> {
  const response = await prompts({
    type: 'select',
    name: 'selected',
    message: options.message,
    choices: options.choices,
    initial: options.initial ?? 0
  });

  return response.selected;
}
