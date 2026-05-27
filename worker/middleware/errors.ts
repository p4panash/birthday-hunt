// Global error handler for the Worker. Maps known error classes to typed JSON
// responses; everything else becomes a 500. The shape — { error: { code, message } } —
// matches the API contract in specs/multiplayer-backend.md.

import type { Context } from 'hono';
import { ZodError } from 'zod';
import { AccessAuthError } from '../lib/access';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    issues?: unknown;
  };
}

export function errorHandler(err: Error, c: Context): Response {
  if (err instanceof ZodError) {
    return c.json<ErrorBody>(
      {
        error: {
          code: 'validation_error',
          message: 'request failed validation',
          issues: err.issues,
        },
      },
      400,
    );
  }

  if (err instanceof AccessAuthError) {
    const status = err.code === 'misconfigured' ? 500 : 401;
    return c.json<ErrorBody>(
      { error: { code: err.code, message: err.message } },
      status,
    );
  }

  console.error('[errors] unhandled:', err);
  return c.json<ErrorBody>(
    { error: { code: 'internal_error', message: err.message } },
    500,
  );
}
