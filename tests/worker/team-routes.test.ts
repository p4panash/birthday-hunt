// Tests for worker/routes/teams.ts (player-facing endpoints).

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
    name: 'box', hint: 'h', mapsUrl: 'https://maps.example.com/x',
  },
  errors: { wrongCode: '', gpsDenied: '', gpsFlaky: '' },
  photos: [],
  sound: { unlockSrc: '', finaleSrc: '' },
};

async function seedHuntAndTeam() {
  const huntRes = await SELF.fetch('http://localhost/api/admin/hunts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'h', friend_name: 'm',
      deadline_iso: '2026-05-28T01:10:00+03:00', config: validConfig,
    }),
  });
  const { hunt } = await huntRes.json<{ hunt: { id: string } }>();

  const teamRes = await SELF.fetch(
    `http://localhost/api/admin/hunts/${hunt.id}/teams`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'team-alpha' }),
    },
  );
  const { team } = await teamRes.json<{
    team: { id: string; invite_code: string };
  }>();

  return { huntId: hunt.id, teamId: team.id, inviteCode: team.invite_code };
}

describe('POST /api/teams/join', () => {
  it('joins a team and returns hunt config', async () => {
    const { inviteCode, huntId, teamId } = await seedHuntAndTeam();

    const res = await SELF.fetch('http://localhost/api/teams/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invite_code: inviteCode,
        player_name: 'andi',
        client_id: 'browser-' + 'a'.repeat(16),
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json<{
      team: { id: string };
      player: { id: string; name: string };
      hunt: { id: string; config: { friendName: string } };
    }>();
    expect(json.team.id).toBe(teamId);
    expect(json.hunt.id).toBe(huntId);
    expect(json.hunt.config.friendName).toBe('mihali');
    expect(json.player.name).toBe('andi');
  });

  it('re-binds same player on repeat join with same client_id', async () => {
    const { inviteCode } = await seedHuntAndTeam();
    const body = {
      invite_code: inviteCode,
      player_name: 'andi',
      client_id: 'browser-' + 'a'.repeat(16),
    };
    const r1 = await SELF.fetch('http://localhost/api/teams/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j1 = await r1.json<{ player: { id: string } }>();

    const r2 = await SELF.fetch('http://localhost/api/teams/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, player_name: 'andrei' }),
    });
    const j2 = await r2.json<{ player: { id: string; name: string } }>();
    expect(j2.player.id).toBe(j1.player.id);
    expect(j2.player.name).toBe('andrei');
  });

  it('returns 404 for unknown invite code', async () => {
    const res = await SELF.fetch('http://localhost/api/teams/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invite_code: 'ZZZZ9999',
        player_name: 'a',
        client_id: 'c'.repeat(20),
      }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      error: { code: 'invalid_invite' },
    });
  });

  it('returns 400 for malformed invite code', async () => {
    const res = await SELF.fetch('http://localhost/api/teams/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invite_code: 'bad',
        player_name: 'a',
        client_id: 'c'.repeat(20),
      }),
    });
    expect(res.status).toBe(400);
  });

  // Spec § resolved-decision #8: max 10 players per team. The 11th distinct
  // client_id should be refused.
  it('rejects the 11th distinct player on a team (max 10)', async () => {
    const { inviteCode } = await seedHuntAndTeam();
    // Seed 10 successful joins with distinct client_ids.
    for (let i = 0; i < 10; i++) {
      const r = await SELF.fetch('http://localhost/api/teams/join', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_code: inviteCode,
          player_name: `p${i}`,
          client_id: `client-${'a'.repeat(8)}-${i.toString().padStart(2, '0')}`,
        }),
      });
      expect(r.status, `player ${i + 1} should join`).toBe(200);
    }
    // 11th distinct client should be rejected.
    const reject = await SELF.fetch('http://localhost/api/teams/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invite_code: inviteCode,
        player_name: 'overflow',
        client_id: 'client-overflow-11',
      }),
    });
    expect(reject.status).toBe(403);
    const body = await reject.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('team_full');
  });

  it('re-binding an existing player on a full team still succeeds', async () => {
    const { inviteCode } = await seedHuntAndTeam();
    // Fill the team.
    const firstClientId = `client-first-${'a'.repeat(12)}`;
    for (let i = 0; i < 10; i++) {
      const r = await SELF.fetch('http://localhost/api/teams/join', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_code: inviteCode,
          player_name: `p${i}`,
          client_id: i === 0 ? firstClientId : `client-other-${i}-${'a'.repeat(8)}`,
        }),
      });
      expect(r.status).toBe(200);
    }
    // Re-join with the same client_id as player 0 — should NOT count as a new
    // slot, so this must succeed.
    const rebind = await SELF.fetch('http://localhost/api/teams/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invite_code: inviteCode,
        player_name: 'p0-renamed',
        client_id: firstClientId,
      }),
    });
    expect(rebind.status).toBe(200);
  });
});

describe('CORS allowlist', () => {
  const PROBE = 'http://localhost/api/hunts/anything/config';
  it('allows hunt.use-adonis.com origin', async () => {
    const res = await SELF.fetch(PROBE, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://hunt.use-adonis.com',
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://hunt.use-adonis.com',
    );
  });

  it('allows Pages legacy origin', async () => {
    const res = await SELF.fetch(PROBE, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://birthday-hunt-awy.pages.dev',
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://birthday-hunt-awy.pages.dev',
    );
  });

  it('rejects unknown origins by omitting ACAO', async () => {
    const res = await SELF.fetch(PROBE, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.example.com',
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('does not reflect arbitrary origins (regression)', async () => {
    const res = await SELF.fetch(PROBE, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://attacker.test',
        'Access-Control-Request-Method': 'POST',
      },
    });
    const acao = res.headers.get('access-control-allow-origin');
    expect(acao).not.toBe('https://attacker.test');
  });
});

describe('GET /api/teams/:id', () => {
  it('returns team with null state initially', async () => {
    const { teamId } = await seedHuntAndTeam();
    const res = await SELF.fetch(`http://localhost/api/teams/${teamId}`);
    expect(res.status).toBe(200);
    const json = await res.json<{ team: { id: string }; state: null }>();
    expect(json.team.id).toBe(teamId);
    expect(json.state).toBeNull();
  });

  it('returns 404 for unknown team', async () => {
    const res = await SELF.fetch('http://localhost/api/teams/ghost');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/hunts/:id/config', () => {
  it('returns hunt config', async () => {
    const { huntId } = await seedHuntAndTeam();
    const res = await SELF.fetch(`http://localhost/api/hunts/${huntId}/config`);
    expect(res.status).toBe(200);
    const json = await res.json<{ config: { friendName: string } }>();
    expect(json.config.friendName).toBe('mihali');
  });

  it('returns 404 for unknown hunt', async () => {
    const res = await SELF.fetch('http://localhost/api/hunts/ghost/config');
    expect(res.status).toBe(404);
  });
});
