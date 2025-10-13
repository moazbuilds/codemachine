import chalk from 'chalk';

const GUTTER_WIDTH = 24;
const DIVIDER_WIDTH = 60;

export const palette = {
  primary: chalk.cyanBright,
  secondary: chalk.gray,
  success: chalk.greenBright,
  warning: chalk.yellowBright,
  error: chalk.redBright,
  dim: chalk.dim,
} as const;

export const divider = (char = '─', width = DIVIDER_WIDTH): string => {
  if (width <= 0) {
    return '';
  }

  const unit = char.length > 0 ? char : ' ';
  return unit.repeat(width);
};

export const banner = (text: string): string => {
  const normalized = text.trim();
  const border = palette.primary.bold(divider('═'));
  const title = palette.primary.bold(` ${normalized} `);

  return `${border}\n${title}\n${border}`;
};

export const section = (title: string): string => {
  const normalized = title.trim();
  const header = palette.secondary.bold(normalized.toUpperCase());
  const underline = palette.secondary(divider());

  return `${header}\n${underline}`;
};

export const formatKeyValue = (key: string, value: string): string => {
  const label = `${key}:`.padEnd(GUTTER_WIDTH, ' ');
  const coloredLabel = palette.secondary(label);

  return `${coloredLabel}${value}`;
};

/**
 * Centers each line of the provided text within a fixed width.
 * Does not modify divider width or existing banner/section behavior.
 */
export const center = (text: string, width = DIVIDER_WIDTH): string => {
  return text
    .split('\n')
    .map((line) => {
      const len = line.length;
      if (len >= width) return line;
      const left = Math.floor((width - len) / 2);
      return ' '.repeat(left) + line;
    })
    .join('\n');
};
