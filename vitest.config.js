import { defineConfig } from 'vitest/config'

/**
 * @type {import('vitest/config').UserConfig}
 */
export default defineConfig({
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
    setupFiles: ['./.vitest/setup.js'],
    globalSetup: './.vitest/global-setup.js'
  }
})
