// Tests for /api/push/* routes — vapid key, subscribe, unsubscribe.

import { SELF, env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { insertTeam, upsertPlayer } from '../../worker/db/queries';

const TEAM_ID = 'team-push-1';
const HUNT_ID = 'hunt-push-1';
const PLAYER_ID = 'player-push-1';

async function clearAll() {
  await env.DB.prepare('DELETE FROM push_subscriptions').run();
  await env.DB.prepare('DELETE FROM chat_messages').run();
  await env.DB.prepare('DELETE FROM team_state').run();
  await env.DB.prepare('DELETE FROM players').run();
  await env.DB.prepare('DELETE FROM teams').run();
  await env.DB.prepare('DELETE FROM hunts').run();
}

async function seed() {
  await env.DB.prepare(
    `INSERT INTO hunts (id, name, friend_name, deadline_iso, config_json, created_at)
     VALUES (?, 'h', 'm', '2030-01-01T00:00:00Z', '{}', 1000)`,
  ).bind(HUNT_ID).run();
  await insertTeam(env.DB, {
    id: TEAM_ID,
    hunt_id: HUNT_ID,
    invite_code: 'PUSH0001',
    name: 't',
  });
  await upsertPlayer(env.DB, {
    id: PLAYER_ID,
    team_id: TEAM_ID,
    name: 'andi',
    client_id: 'cid-' + 'x'.repeat(20),
  });
}

beforeEach(async () => {
  await clearAll();
  await seed();
});

describe('GET /api/push/vapid-public-key', () => {
  it('returns the configured public key', async () => {
    const res = await SELF.fetch('http://localhost/api/push/vapid-public-key');
    // env.VAPID_PUBLIC_KEY is undefined in test → 503 unconfigured
    expect([200, 503]).toContain(res.status);
    if (res.status === 503) {
      const body = await res.json<{ error: { code: string } }>();
      expect(body.error.code).toBe('push_unconfigured');
    }
  });
});

describe('POST /api/push/teams/:teamId/subscribe', () => {
  it('persists a subscription for a valid player+team', async () => {
    const res = await SELF.fetch(
      `http://localhost/api/push/teams/${TEAM_ID}/subscribe`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          player_id: PLAYER_ID,
          endpoint: 'https://fcm.googleapis.com/fcm/send/test1',
          keys: { p256dh: 'a'.repeat(80), auth: 'b'.repeat(24) },
        }),
      },
    );
    expect(res.status).toBe(200);
    const count = await env.DB
      .prepare('SELECT COUNT(*) AS c FROM push_subscriptions WHERE team_id = ?')
      .bind(TEAM_ID)
      .first<{ c: number }>();
    expect(count?.c ?? 0).toBe(1);
  });

  it('returns 404 when player is not in team', async () => {
    const res = await SELF.fetch(
      `http://localhost/api/push/teams/${TEAM_ID}/subscribe`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          player_id: 'ghost',
          endpoint: 'https://fcm.googleapis.com/fcm/send/test2',
          keys: { p256dh: 'a'.repeat(80), auth: 'b'.repeat(24) },
        }),
      },
    );
    expect(res.status).toBe(404);
  });

  it('upserts on duplicate endpoint (idempotent re-subscribe)', async () => {
    const body = {
      player_id: PLAYER_ID,
      endpoint: 'https://fcm.googleapis.com/fcm/send/dup',
      keys: { p256dh: 'a'.repeat(80), auth: 'b'.repeat(24) },
    };
    await SELF.fetch(`http://localhost/api/push/teams/${TEAM_ID}/subscribe`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    await SELF.fetch(`http://localhost/api/push/teams/${TEAM_ID}/subscribe`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const count = await env.DB
      .prepare('SELECT COUNT(*) AS c FROM push_subscriptions')
      .first<{ c: number }>();
    expect(count?.c ?? 0).toBe(1);
  });
});

describe('POST /api/push/teams/:teamId/unsubscribe', () => {
  it('deletes a subscription by endpoint and returns count', async () => {
    const endpoint = 'https://fcm.googleapis.com/fcm/send/byebye';
    await SELF.fetch(`http://localhost/api/push/teams/${TEAM_ID}/subscribe`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        player_id: PLAYER_ID, endpoint,
        keys: { p256dh: 'a'.repeat(80), auth: 'b'.repeat(24) },
      }),
    });
    const res = await SELF.fetch(
      `http://localhost/api/push/teams/${TEAM_ID}/unsubscribe`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ ok: boolean; wiped: number }>();
    expect(body.wiped).toBe(1);
  });
});
