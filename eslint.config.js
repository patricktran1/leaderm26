import js from '@eslint/js';
import ts from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', '.astro/**', 'tools/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ['scripts/**/*.mjs', 'tools/**/*.mjs', '*.config.{js,mjs}'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        // Ambient types Astro injects for `astro:assets`.
        ImageMetadata: 'readonly',
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
];
