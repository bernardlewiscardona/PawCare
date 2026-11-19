import { defineConfig } from 'vitest/config';

// Unit tests for plain TypeScript logic (src/lib). Component tests can add jest-expo later.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
