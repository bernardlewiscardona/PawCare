import { defineConfig } from 'vitest/config';

// Unit tests for plain TypeScript logic (src/lib). Component tests can add jest-expo later.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // src/data tests use node:sqlite, which warns that it is experimental on every worker start.
    execArgv: ['--disable-warning=ExperimentalWarning'],
  },
});
