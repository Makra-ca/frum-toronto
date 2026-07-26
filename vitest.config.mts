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
          // Pin to UTC so tests reproduce production (Vercel runs UTC) and are
          // deterministic on any dev machine. The zmanim day-boundary bug only
          // manifests when the server's local day differs from the location's —
          // on an America/Toronto laptop it silently does not reproduce.
          env: {
            TZ: 'UTC',
          },
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
