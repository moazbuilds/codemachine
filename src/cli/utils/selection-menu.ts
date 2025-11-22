import { select, isCancel } from '@clack/prompts';

export interface SelectionChoice<T = string> {
  title: string;
  value: T;
  description?: string;
}

interface SelectFromMenuOptions<T> {
  message: string;
  choices: SelectionChoice<T>[];
  initial?: number;
}

export async function selectFromMenu<T = string>(
  options: SelectFromMenuOptions<T>
): Promise<T | undefined> {
  const selectOptions = options.choices.map(choice => {
    const option: { label: string; value: T; hint?: string } = {
      label: choice.title,
      value: choice.value
    };
    if (choice.description) {
      option.hint = choice.description;
    }
    return option;
  });

  const result = await select({
    message: options.message,
    // @ts-expect-error - clack's Option type is not exported, but this matches the expected shape
    options: selectOptions,
    initialValue: options.initial !== undefined ? options.choices[options.initial]?.value : undefined
  });

  if (isCancel(result)) {
    return undefined;
  }

  return result as T;
}
