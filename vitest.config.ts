// Vitest config for Worker tests. Frontend tests will use a separate config
// when added later.
//
// Tests run inside Miniflare with the same bindings the production Worker
// gets (D1 as DB, Durable Object as TEAM_SESSION, env vars). D1 migrations are
// read from worker/db/migrations and applied in beforeAll (see tests/setup.ts).

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import {
  cloudflareTest,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    path.join(__dirname, 'worker/db/migrations'),
  );

  return {
    plugins: [
      cloudflareTest({
        singleWorker: true,
        wrangler: { configPath: './worker/wrangler.toml' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            // Bypass CF Access JWT verification in tests; access.test.ts
            // overrides this by passing env directly to verifyAccessJwt.
            ACCESS_DEV_BYPASS: 'true',
          },
        },
      }),
    ],
    test: {
      include: ['tests/worker/**/*.test.ts'],
      exclude: ['tests/e2e/**', 'node_modules/**'],
      setupFiles: ['./tests/setup.ts'],
    },
  };
});
