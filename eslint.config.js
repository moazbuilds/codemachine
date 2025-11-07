import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import { defineConfig } from 'typescript-eslint';
import tseslint from 'typescript-eslint';

const typescriptFiles = ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'];

export default defineConfig(
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
    },
  },
  eslintConfigPrettier,
);
