// Integration tests for worker/routes/admin.ts. Run against the real Worker
// via SELF (cloudflare:test); ACCESS_DEV_BYPASS=true is set in vitest config so
// the admin middleware accepts any request without a real JWT.

import { SELF, env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { HuntConfig } from '../../shared/config/types';

async function clearAll() {
  await env.DB.prepare('DELETE FROM team_state').run();
  await env.DB.prepare('DELETE FROM players').run();
  await env.DB.prepare('DELETE FROM teams').run();
  await env.DB.prepare('DELETE FROM hunts').run();
  await env.DB.prepare('DELETE FROM audit_log').run();
}

beforeEach(clearAll);

const ck = (id: 1 | 2 | 3, code: string) => ({
  id, name: `c${id}`, teaser: 't', realHint: 'h',
  lat: 44.4 + id / 100, lng: 26.1 + id / 100,
  radiusMeters: 25, code, successCopy: 's',
});

const validConfig: HuntConfig = {
  friendName: 'mihali',
  intro: { eyebrow: '', headline: '', body: '', cta: '', finePrint: '' },
  gpsPreface: { headline: '', body: '', allowCta: '' },
  deadlineISO: '2026-05-28T01:10:00+03:00',
  countdown: { eyebrow: '' },
  checkpoints: [ck(1, 'A'), ck(2, 'B'), ck(3, 'C')],
  warmthStatuses: { veryFar: '', far: '', close: '', onTop: '' },
  stuckSheet: {
    title: '', realHintIntro: '', codeLabel: '', codePlaceholder: '',
    unlockCta: '', closeCta: '',
  },
  reveal: { headline: '', nextCta: '', finaleCta: '' },
  finale: {
    headline: '', subheadline: '', lockerHintLabel: '',
    instruction: '', qrBrightnessTip: '', openLockerMapLabel: '',
  },
  easyboxLocation: {
    name: 'box', hint: 'h',
    mapsUrl: 'https://maps.example.com/x',
  },
  errors: { wrongCode: '', gpsDenied: '', gpsFlaky: '' },
  photos: [],
  sound: { unlockSrc: '', finaleSrc: '' },
};

const validCreateHunt = {
  name: 'hunt-1',
  friend_name: 'mihali',
  deadline_iso: '2026-05-28T01:10:00+03:00',
  config: validConfig,
};

function post(path: string, body: unknown) {
  return SELF.fetch(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function get(path: string) {
  return SELF.fetch(`http://localhost${path}`);
}

function patch(path: string, body: unknown) {
  return SELF.fetch(`http://localhost${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/hunts', () => {
  it('creates a hunt and writes audit_log', async () => {
    const res = await post('/api/admin/hunts', validCreateHunt);
    expect(res.status).toBe(201);
    const json = await res.json<{ hunt: { id: string; name: string } }>();
    expect(json.hunt.name).toBe('hunt-1');
    expect(json.hunt.id).toBeTruthy();

    const audit = await env.DB
      .prepare('SELECT * FROM audit_log WHERE target = ?')
      .bind(json.hunt.id).first<{ action: string; admin_email: string }>();
    expect(audit?.action).toBe('create_hunt');
    expect(audit?.admin_email).toBe('dev@local');
  });

  it('returns 400 on invalid body', async () => {
    const res = await post('/api/admin/hunts', { name: '' });
    expect(res.status).toBe(400);
    const json = await res.json<{ error: { code: string } }>();
    expect(json.error.code).toBe('validation_error');
  });
});

describe('GET /api/admin/hunts', () => {
  it('returns empty list initially', async () => {
    const res = await get('/api/admin/hunts');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hunts: [] });
  });

  it('returns created hunts', async () => {
    await post('/api/admin/hunts', validCreateHunt);
    await post('/api/admin/hunts', { ...validCreateHunt, name: 'hunt-2' });
    const res = await get('/api/admin/hunts');
    const json = await res.json<{ hunts: Array<{ name: string }> }>();
    expect(json.hunts).toHaveLength(2);
  });
});

describe('GET /api/admin/hunts/:id', () => {
  it('returns 404 for unknown hunt', async () => {
    const res = await get('/api/admin/hunts/ghost');
    expect(res.status).toBe(404);
  });

  it('returns hunt with teams', async () => {
    const create = await (await post('/api/admin/hunts', validCreateHunt))
      .json<{ hunt: { id: string } }>();
    const hid = create.hunt.id;
    await post(`/api/admin/hunts/${hid}/teams`, { name: 'team-alpha' });

    const res = await get(`/api/admin/hunts/${hid}`);
    const json = await res.json<{
      hunt: { id: string };
      teams: Array<{ name: string; invite_code: string }>;
    }>();
    expect(json.hunt.id).toBe(hid);
    expect(json.teams).toHaveLength(1);
    expect(json.teams[0].name).toBe('team-alpha');
    expect(json.teams[0].invite_code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
  });

  it('returns roster of players per team (names + last_seen)', async () => {
    const create = await (await post('/api/admin/hunts', validCreateHunt))
      .json<{ hunt: { id: string } }>();
    const hid = create.hunt.id;
    const teamRes = await post(`/api/admin/hunts/${hid}/teams`, {
      name: 'team-alpha',
    });
    const { team } = await teamRes.json<{
      team: { id: string; invite_code: string };
    }>();

    // Seed two players via the public join endpoint.
    for (const name of ['andi', 'bogdan']) {
      const j = await SELF.fetch('http://localhost/api/teams/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_code: team.invite_code,
          player_name: name,
          client_id: `client-${name}-${'a'.repeat(12)}`,
        }),
      });
      expect(j.status).toBe(200);
    }

    const res = await get(`/api/admin/hunts/${hid}`);
    const json = await res.json<{
      teams: Array<{
        roster: Array<{
          name: string;
          joined_at: number;
          last_seen_at: number;
        }>;
      }>;
    }>();
    expect(json.teams[0].roster).toHaveLength(2);
    const names = json.teams[0].roster.map((p) => p.name).sort();
    expect(names).toEqual(['andi', 'bogdan']);
    for (const p of json.teams[0].roster) {
      expect(p.joined_at).toBeGreaterThan(0);
      expect(p.last_seen_at).toBeGreaterThan(0);
    }
  });
});

describe('PATCH /api/admin/hunts/:id', () => {
  it('updates deadline', async () => {
    const create = await (await post('/api/admin/hunts', validCreateHunt))
      .json<{ hunt: { id: string } }>();
    const hid = create.hunt.id;

    const res = await patch(`/api/admin/hunts/${hid}`, {
      deadline_iso: '2030-01-01T00:00:00Z',
    });
    expect(res.status).toBe(200);
    const json = await res.json<{ hunt: { deadline_iso: string } }>();
    expect(json.hunt.deadline_iso).toBe('2030-01-01T00:00:00Z');
  });

  it('returns 404 when hunt missing', async () => {
    const res = await patch('/api/admin/hunts/ghost', { name: 'x' });
    expect(res.status).toBe(404);
  });

  it('returns 400 on invalid patch', async () => {
    const create = await (await post('/api/admin/hunts', validCreateHunt))
      .json<{ hunt: { id: string } }>();
    const res = await patch(`/api/admin/hunts/${create.hunt.id}`, { name: '' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/admin/hunts/:huntId/teams', () => {
  it('creates a team with invite_code', async () => {
    const create = await (await post('/api/admin/hunts', validCreateHunt))
      .json<{ hunt: { id: string } }>();
    const res = await post(`/api/admin/hunts/${create.hunt.id}/teams`, {
      name: 'team-coral',
    });
    expect(res.status).toBe(201);
    const json = await res.json<{ team: { name: string; invite_code: string } }>();
    expect(json.team.name).toBe('team-coral');
    expect(json.team.invite_code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
  });

  it('returns 404 when parent hunt missing', async () => {
    const res = await post('/api/admin/hunts/ghost/teams', { name: 'x' });
    expect(res.status).toBe(404);
  });
});
