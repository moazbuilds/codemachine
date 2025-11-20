import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

const typescriptFiles = ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'];

export default tseslint.config(
  {
    ignores: ['node_modules', 'dist', 'coverage'],
  },
  {
    extends: [js.configs.recommended],
  },
  {
    files: typescriptFiles,
    extends: [...tseslint.configs.recommended],
    plugins: {
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: ['./tsconfig.json', './tests/tsconfig.json'],
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
        },
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
    },
    rules: {
      ...importPlugin.configs.recommended.rules,
      ...importPlugin.configs.typescript.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Allow Bun built-in modules (bun:test, bun:sqlite, etc.)
      'import/no-unresolved': [
        'error',
        {
          ignore: ['^bun:'],
        },
      ],
    },
  },
  eslintConfigPrettier,
);
