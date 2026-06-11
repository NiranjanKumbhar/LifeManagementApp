import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // pglite compiles its WASM engine on first boot — allow generous timeouts.
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: {
      // The global db client (db/client.ts) requires a URL at import time but is
      // never queried in tests — integration tests inject an in-memory pglite db.
      DATABASE_URL: 'postgres://test:test@localhost:5432/test',
      CLERK_SECRET_KEY: 'sk_test_dummy',
    },
  },
});
