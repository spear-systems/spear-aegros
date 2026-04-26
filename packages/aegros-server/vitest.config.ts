import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    // Default `forks` pool can spawn multiple workers; parallel vitest.setup + migrate races Prisma on Windows CI.
    pool: 'threads',
    maxWorkers: 1,
    minWorkers: 1,
  },
});
