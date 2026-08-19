import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Hydrate the private family dataset (now served at runtime from /api/family,
    // no longer statically bundled) so family-reasoning tests have it in memory.
    setupFiles: ['./src/test/hydrateFamily.ts'],
    // api/** was excluded — edge-proxy contract tests (e.g. api/_rateLimit.test.ts) must gate too.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'api/**/*.test.ts'],
    // Heavy filesystem-walk / O(n^2) graph tests were tipping the 5s default under full-suite parallel
    // load (a FLAKY GATE). A generous global budget removes that class while still catching real hangs.
    testTimeout: 15_000,
  },
})
