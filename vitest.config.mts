import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    projects: [
      {
        // Pure unit tests — no database, no .env.test required
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        // Integration tests — require the Neon test branch (.env.test)
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/*.test.ts'],
          setupFiles: ['./tests/setup.ts'],
          // Run tests sequentially to avoid DB conflicts
          fileParallelism: false,
          env: {
            NODE_ENV: 'test',
          },
        },
      },
    ],
  },
});
