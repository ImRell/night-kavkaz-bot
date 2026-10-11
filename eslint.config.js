export default [
  {
    ignores: ['node_modules/**', 'data/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: Object.fromEntries(
        [
          'console',
          'process',
          'Buffer',
          'URL',
          'AbortController',
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
          'structuredClone',
          'setImmediate',
        ].map((name) => [name, 'readonly']),
      ),
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-duplicate-imports': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
];
