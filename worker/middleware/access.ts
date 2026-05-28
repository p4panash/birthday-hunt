// Hono middleware that verifies the Cf-Access-Jwt-Assertion header on every
// /api/admin/* request and stashes the resulting identity on the context.
// Routes read it via `c.get('admin')`.

import type { MiddlewareHandler } from 'hono';
import { verifyAccessJwt, type AccessIdentity } from '../lib/access';
import type { Env } from '../index';

declare module 'hono' {
  interface ContextVariableMap {
    admin: AccessIdentity;
  }
}

export const requireAdmin: MiddlewareHandler<{ Bindings: Env }> = async (
  c,
  next,
) => {
  const identity = await verifyAccessJwt(c.req.raw, c.env);
  c.set('admin', identity);
  await next();
};
