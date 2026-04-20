import { defineConfig } from 'vitest/config'

/**
 * @type {import('vitest/config').UserConfig}
 */
export default defineConfig({
  resolve: {
    // Mirror Node ESM: import file extensions must be fully specified (e.g. "x.js")
    extensions: []
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/src/**/*.test.js'],
    exclude: ['**/node_modules/**', '**/.server/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.js'],
      exclude: [
        '**/node_modules/**',
        '**/.server/**',
        '**/index.js',
        '**/*.test.js',
        '**/*.contract.test.js',
        '**/contracts/**',
        '**/__mocks__/**',
        '**test-helper**'
      ]
    },
    hookTimeout: 30000,
    setupFiles: ['./.vitest/setup.js'],
    globalSetup: './.vitest/global-setup.js'
  }
})
