import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

/**
 * Two projects, because the two kinds of test have different costs.
 *
 *   unit/        — pure functions. No database. Milliseconds. Run constantly.
 *   integration/ — the integrity invariants, against a real Postgres. These are
 *                  the tests that actually matter for this platform, and they
 *                  cannot be faked with mocks: "one vote per candidate" is
 *                  enforced by a database constraint, so a mocked database
 *                  would assert nothing about the property we care about.
 *
 * Integration tests run single-threaded and sequentially. They share one
 * database and several deliberately exercise write races; letting vitest run
 * them in parallel would produce interference that looks like a product bug.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Integration tests talk to one shared database — no parallelism.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    reporters: 'verbose',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      // `server-only` throws when imported outside a React Server Component.
      // Under vitest the backend modules it guards ARE imported directly by
      // Node, which is exactly what we want to test, so it is stubbed out.
      'server-only': resolve(__dirname, 'tests/stubs/server-only.ts'),
    },
  },
})
