import { isCancel, select, type Option } from '@clack/prompts';

type Primitive = string | number | boolean;

export interface SelectionChoice<T extends Primitive = string> {
  title: string;
  value: T;
  description?: string;
}

export interface SelectionOptions<T extends Primitive = string> {
  message: string;
  choices: SelectionChoice<T>[];
  initial?: number;
}

/**
 * Presents an interactive selection menu to the user with up/down arrow navigation
 * @returns The selected value or undefined if cancelled
 */
export async function selectFromMenu<T extends Primitive = string>(
  options: SelectionOptions<T>
): Promise<T | undefined> {
  const initialIndex = options.initial ?? 0;
  const initialChoice = options.choices[initialIndex];

  const clackOptions = options.choices.map((choice) => ({
    value: choice.value,
    label: choice.title,
    hint: choice.description,
  })) as Option<T>[];

  const response = await select<T>({
    message: options.message,
    options: clackOptions,
    initialValue: initialChoice?.value,
  });

  return isCancel(response) ? undefined : response;
}
