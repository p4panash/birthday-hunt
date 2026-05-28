// Worker-test setup. Runs once before each test file; applies D1 migrations so
// every test sees a freshly-migrated schema. Per-test row cleanup happens in
// each test file's beforeEach.

import { env, applyD1Migrations } from 'cloudflare:test';
import { beforeAll } from 'vitest';
import type { Env } from '../worker/index';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[];
  }
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
