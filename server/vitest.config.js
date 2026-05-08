import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['game/__tests__/**/*.test.js'],
    environment: 'node',
  },
});
