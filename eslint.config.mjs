import { defineConfig, globalIgnores } from 'eslint/config';
import { fixupConfigRules } from '@eslint/compat';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default defineConfig([
  ...fixupConfigRules(nextVitals),
  ...fixupConfigRules(nextTypescript),
  {
    rules: {
      // User-uploaded photos and canvas-generated previews are local data URLs,
      // so the native image element is the correct rendering primitive here.
      '@next/next/no-img-element': 'off',
      'import/no-anonymous-default-export': 'off',
    },
  },
  {
    files: ['tests/**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  globalIgnores(['.next/**', '.next-studio/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);
