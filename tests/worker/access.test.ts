// Unit tests for worker/lib/access.ts. Mocks the JWKS fetch via vi.spyOn on
// globalThis.fetch (the fetchMock export from cloudflare:test was removed in
// @cloudflare/vitest-pool-workers v0.16). Test tokens are signed with a
// generated RSA key whose public half is served by the mock.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exportJWK,
  generateKeyPair,
  SignJWT,
} from 'jose';
import {
  AccessAuthError,
  verifyAccessJwt,
  _resetJwksCacheForTests,
  type AccessEnv,
} from '../../worker/lib/access';

const TEAM_DOMAIN = 'birthday-hunt';
const AUD = 'test-audience';
const ISSUER = `https://${TEAM_DOMAIN}.cloudflareaccess.com`;
const JWKS_URL = `${ISSUER}/cdn-cgi/access/certs`;

const accessEnv: AccessEnv = {
  ACCESS_AUD: AUD,
  ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
  ACCESS_DEV_BYPASS: '',
};

type KeyPair = Awaited<ReturnType<typeof generateKeyPair>>;
let keys: KeyPair;
let fetchSpy: ReturnType<typeof vi.spyOn>;
const realFetch = globalThis.fetch.bind(globalThis);

beforeAll(async () => {
  keys = await generateKeyPair('RS256', { extractable: true });
  const publicJwk = await exportJWK(keys.publicKey);
  publicJwk.kid = 'test-kid';
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';

  const jwksBody = JSON.stringify({ keys: [publicJwk] });

  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    if (url.startsWith(JWKS_URL)) {
      return new Response(jwksBody, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return realFetch(input, init);
  });
});

afterAll(() => {
  fetchSpy.mockRestore();
});

beforeEach(() => {
  _resetJwksCacheForTests();
});

interface TokenOverrides {
  audience?: string;
  issuer?: string;
  /** Set to null to omit the email claim entirely. */
  email?: string | null;
  sub?: string;
  expSecondsFromNow?: number;
}

async function makeToken(o: TokenOverrides = {}): Promise<string> {
  const claims: Record<string, unknown> = {};
  if (o.email !== null) claims.email = o.email ?? 'admin@example.com';

  const builder = new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setIssuer(o.issuer ?? ISSUER)
    .setAudience(o.audience ?? AUD)
    .setSubject(o.sub ?? 'user-123')
    .setIssuedAt();

  if (o.expSecondsFromNow !== undefined) {
    builder.setExpirationTime(Math.floor(Date.now() / 1000) + o.expSecondsFromNow);
  } else {
    builder.setExpirationTime('1h');
  }

  return builder.sign(keys.privateKey);
}

function makeRequest(token: string | null): Request {
  const headers = new Headers();
  if (token) headers.set('Cf-Access-Jwt-Assertion', token);
  return new Request('https://localhost/api/admin/hunts', { headers });
}

describe('verifyAccessJwt — happy path', () => {
  it('returns identity for a valid token', async () => {
    const token = await makeToken();
    const id = await verifyAccessJwt(makeRequest(token), accessEnv);
    expect(id).toEqual({ email: 'admin@example.com', sub: 'user-123' });
  });

  it('returns identity with different email + sub', async () => {
    const token = await makeToken({ email: 'other@example.com', sub: 'u-2' });
    const id = await verifyAccessJwt(makeRequest(token), accessEnv);
    expect(id).toEqual({ email: 'other@example.com', sub: 'u-2' });
  });
});

describe('verifyAccessJwt — rejections', () => {
  it('rejects when Cf-Access-Jwt-Assertion header is missing', async () => {
    await expect(
      verifyAccessJwt(makeRequest(null), accessEnv),
    ).rejects.toBeInstanceOf(AccessAuthError);
    await expect(
      verifyAccessJwt(makeRequest(null), accessEnv),
    ).rejects.toMatchObject({ code: 'missing_header' });
  });

  it('rejects token with wrong audience', async () => {
    const token = await makeToken({ audience: 'someone-else' });
    await expect(
      verifyAccessJwt(makeRequest(token), accessEnv),
    ).rejects.toMatchObject({ code: 'invalid_token' });
  });

  it('rejects token with wrong issuer', async () => {
    const token = await makeToken({
      issuer: 'https://different-team.cloudflareaccess.com',
    });
    await expect(
      verifyAccessJwt(makeRequest(token), accessEnv),
    ).rejects.toMatchObject({ code: 'invalid_token' });
  });

  it('rejects expired token', async () => {
    const token = await makeToken({ expSecondsFromNow: -60 });
    await expect(
      verifyAccessJwt(makeRequest(token), accessEnv),
    ).rejects.toMatchObject({ code: 'invalid_token' });
  });

  it('rejects token missing email claim', async () => {
    const token = await makeToken({ email: null });
    await expect(
      verifyAccessJwt(makeRequest(token), accessEnv),
    ).rejects.toMatchObject({ code: 'missing_claims' });
  });

  it('rejects when ACCESS_AUD is unset', async () => {
    await expect(
      verifyAccessJwt(makeRequest('any-token'), { ...accessEnv, ACCESS_AUD: '' }),
    ).rejects.toMatchObject({ code: 'misconfigured' });
  });

  it('rejects when ACCESS_TEAM_DOMAIN is unset', async () => {
    await expect(
      verifyAccessJwt(makeRequest('any-token'), {
        ...accessEnv,
        ACCESS_TEAM_DOMAIN: '',
      }),
    ).rejects.toMatchObject({ code: 'misconfigured' });
  });

  it('rejects garbage token string', async () => {
    await expect(
      verifyAccessJwt(makeRequest('not-a-jwt'), accessEnv),
    ).rejects.toMatchObject({ code: 'invalid_token' });
  });
});

describe('verifyAccessJwt — dev bypass', () => {
  it('returns synthetic identity when ACCESS_DEV_BYPASS=true', async () => {
    const id = await verifyAccessJwt(makeRequest(null), {
      ...accessEnv,
      ACCESS_DEV_BYPASS: 'true',
    });
    expect(id).toEqual({ email: 'dev@local', sub: 'dev-bypass' });
  });

  it('dev bypass works even without env config', async () => {
    const id = await verifyAccessJwt(makeRequest(null), {
      ACCESS_AUD: '',
      ACCESS_TEAM_DOMAIN: '',
      ACCESS_DEV_BYPASS: 'true',
    });
    expect(id.email).toBe('dev@local');
  });

  it('does NOT bypass when value is anything other than "true"', async () => {
    await expect(
      verifyAccessJwt(makeRequest(null), {
        ...accessEnv,
        ACCESS_DEV_BYPASS: '1',
      }),
    ).rejects.toMatchObject({ code: 'missing_header' });
  });
});
