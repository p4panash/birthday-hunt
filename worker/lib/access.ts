// Cloudflare Access JWT verification.
//
// Every /api/admin/* request must carry a Cf-Access-Jwt-Assertion header issued
// by Cloudflare Access at the edge. We verify the signature against the team's
// JWKS, check the audience tag, and return the admin's identity ({ email, sub }).
//
// Local dev sets ACCESS_DEV_BYPASS=true in .dev.vars and gets a synthetic
// identity so the admin SPA is reachable without going through the IdP. Never
// set this in production.

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export interface AccessIdentity {
  email: string;
  sub: string;
}

export interface AccessEnv {
  ACCESS_AUD: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_DEV_BYPASS: string;
}

const JWKS_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Module-level cache, keyed by JWKS URL. jose's createRemoteJWKSet handles its
// own in-process caching with cacheMaxAge; this just avoids rebuilding the
// resolver on every call within an isolate.
let cachedResolver: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedKey: string | null = null;

function getJwksResolver(teamDomain: string) {
  const jwksUrl = `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`;
  if (cachedKey !== jwksUrl || cachedResolver === null) {
    cachedResolver = createRemoteJWKSet(new URL(jwksUrl), {
      cacheMaxAge: JWKS_CACHE_MAX_AGE_MS,
    });
    cachedKey = jwksUrl;
  }
  return cachedResolver;
}

/** Reset module-level cache. For tests only. */
export function _resetJwksCacheForTests(): void {
  cachedResolver = null;
  cachedKey = null;
}

export class AccessAuthError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'missing_header'
      | 'misconfigured'
      | 'invalid_token'
      | 'missing_claims',
  ) {
    super(message);
    this.name = 'AccessAuthError';
  }
}

export async function verifyAccessJwt(
  req: Request,
  env: AccessEnv,
): Promise<AccessIdentity> {
  if (env.ACCESS_DEV_BYPASS === 'true') {
    return { email: 'dev@local', sub: 'dev-bypass' };
  }

  if (!env.ACCESS_AUD || !env.ACCESS_TEAM_DOMAIN) {
    throw new AccessAuthError(
      'ACCESS_AUD or ACCESS_TEAM_DOMAIN not configured',
      'misconfigured',
    );
  }

  const token = req.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) {
    throw new AccessAuthError(
      'missing Cf-Access-Jwt-Assertion header',
      'missing_header',
    );
  }

  const resolver = getJwksResolver(env.ACCESS_TEAM_DOMAIN);

  let payload: JWTPayload;
  try {
    const result = await jwtVerify(token, resolver, {
      issuer: `https://${env.ACCESS_TEAM_DOMAIN}.cloudflareaccess.com`,
      audience: env.ACCESS_AUD,
    });
    payload = result.payload;
  } catch (err) {
    throw new AccessAuthError(
      `invalid Access JWT: ${(err as Error).message}`,
      'invalid_token',
    );
  }

  const email = (payload as JWTPayload & { email?: unknown }).email;
  if (typeof email !== 'string' || typeof payload.sub !== 'string') {
    throw new AccessAuthError(
      'JWT payload missing email or sub claim',
      'missing_claims',
    );
  }

  return { email, sub: payload.sub };
}
