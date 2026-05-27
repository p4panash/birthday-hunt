// Entry point for the birthday-hunt Worker.
//
// Routes:
//   GET /healthz       → liveness probe
//   /api/*             → Hono router; admin/team handlers wired in T13–T14
//
// Durable Object bindings:
//   TEAM_SESSION       → TeamSession (placeholder; T15 fills the body)
//
// All /api/* errors funnel through middleware/errors so clients always get the
// { error: { code, message } } shape, never a raw stack or HTML error page.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { errorHandler } from './middleware/errors';
import { adminRoutes } from './routes/admin';
import { teamRoutes, huntPublicRoutes } from './routes/teams';
import { TeamSession } from './do/TeamSession';

export { TeamSession };

export interface Env {
  DB: D1Database;
  TEAM_SESSION: DurableObjectNamespace<TeamSession>;
  ACCESS_AUD: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_DEV_BYPASS: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());

// Strict CORS allowlist. With `credentials: true`, a reflective origin would
// let any site mount a cross-origin credentialed fetch — the browser would
// forward the CF Access cookie and the call would execute under the admin's
// identity. Only these origins may opt in:
//   - hunt.use-adonis.com — production
//   - birthday-hunt-awy.pages.dev — Pages preview / legacy
//   - localhost:5173 — vite dev (proxies /api/* to wrangler:8787)
// Same-origin requests (no Origin header) bypass CORS entirely and are fine.
const ALLOWED_ORIGINS = new Set([
  'https://hunt.use-adonis.com',
  'https://birthday-hunt-awy.pages.dev',
  'http://localhost:5173',
]);

app.use(
  '/api/*',
  cors({
    origin: (origin) =>
      origin && ALLOWED_ORIGINS.has(origin) ? origin : null,
    allowHeaders: ['Content-Type', 'Cf-Access-Jwt-Assertion'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    maxAge: 86400,
  }),
);

app.get('/healthz', (c) => c.json({ ok: true, ts: Date.now() }));

app.route('/api/admin', adminRoutes);
app.route('/api/teams', teamRoutes);
app.route('/api/hunts', huntPublicRoutes);

app.notFound((c) => {
  if (new URL(c.req.url).pathname.startsWith('/api/')) {
    return c.json(
      { error: { code: 'not_found', message: 'route not found' } },
      404,
    );
  }
  return c.text('Not found', 404);
});

app.onError(errorHandler);

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
