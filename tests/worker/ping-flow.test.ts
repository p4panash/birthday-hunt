// Tests for the TeamSession DO ping_send + presence_position handlers (T22, T23).

import {
  abortAllDurableObjects,
  env,
} from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ServerMsg } from '../../shared/messages';
import { upsertPlayer } from '../../worker/db/queries';

const TEAM_ID = 'team-ping-1';
const HUNT_ID = 'hunt-ping-1';
const PLAYER_A = { id: 'player-ping-a', name: 'andi' };
const PLAYER_B = { id: 'player-ping-b', name: 'maria' };

async function clearAll() {
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
  await env.DB.prepare(
    `INSERT INTO teams (id, hunt_id, invite_code, name, created_at)
     VALUES (?, ?, 'PING0001', 't', 2000)`,
  ).bind(TEAM_ID, HUNT_ID).run();
  await upsertPlayer(env.DB, {
    id: PLAYER_A.id, team_id: TEAM_ID, name: PLAYER_A.name,
    client_id: 'cid-a-' + 'x'.repeat(16),
  });
  await upsertPlayer(env.DB, {
    id: PLAYER_B.id, team_id: TEAM_ID, name: PLAYER_B.name,
    client_id: 'cid-b-' + 'x'.repeat(16),
  });
}

beforeEach(async () => {
  await abortAllDurableObjects();
  await clearAll();
  await seed();
});

function getStub() {
  return env.TEAM_SESSION.get(env.TEAM_SESSION.idFromName(TEAM_ID));
}

async function openSocket(
  playerId: string,
  playerName: string,
): Promise<{ ws: WebSocket; msgs: ServerMsg[] }> {
  const stub = getStub();
  const url = `http://internal/ws?player_id=${playerId}&player_name=${encodeURIComponent(playerName)}`;
  const res = await stub.fetch(url, { headers: { Upgrade: 'websocket' } });
  const ws = res.webSocket!;
  const msgs: ServerMsg[] = [];
  ws.addEventListener('message', (e) => {
    const data = typeof e.data === 'string' ? e.data : '';
    msgs.push(JSON.parse(data) as ServerMsg);
  });
  ws.accept();
  return { ws, msgs };
}

async function waitFor(predicate: () => boolean, timeoutMs = 1000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('TeamSession ping_send', () => {
  it('broadcasts ping_show with sender info and expires_at to all sockets', async () => {
    const a = await openSocket(PLAYER_A.id, PLAYER_A.name);
    const b = await openSocket(PLAYER_B.id, PLAYER_B.name);

    a.ws.send(JSON.stringify({
      v: 1, type: 'ping_send', lat: 44.4322, lng: 26.1066,
    }));

    await waitFor(() => b.msgs.some((m) => m.type === 'ping_show'));
    const ping = b.msgs.find(
      (m): m is Extract<ServerMsg, { type: 'ping_show' }> => m.type === 'ping_show',
    )!;
    expect(ping.lat).toBeCloseTo(44.4322);
    expect(ping.lng).toBeCloseTo(26.1066);
    expect(ping.sender_id).toBe(PLAYER_A.id);
    expect(ping.sender_name).toBe(PLAYER_A.name);
    expect(typeof ping.id).toBe('string');
    expect(ping.expires_at).toBeGreaterThan(Date.now());
    expect(ping.expires_at).toBeLessThanOrEqual(Date.now() + 5500);
  });

  it('rejects burst with rate_limited (1/sec cap)', async () => {
    const a = await openSocket(PLAYER_A.id, PLAYER_A.name);
    a.ws.send(JSON.stringify({
      v: 1, type: 'ping_send', lat: 1, lng: 2,
    }));
    a.ws.send(JSON.stringify({
      v: 1, type: 'ping_send', lat: 3, lng: 4,
    }));

    await waitFor(
      () => a.msgs.some((m) => m.type === 'ping_show')
        && a.msgs.some((m) => m.type === 'error'),
    );
    expect(
      a.msgs.filter((m) => m.type === 'ping_show').length,
    ).toBe(1);
    const err = a.msgs.find(
      (m): m is Extract<ServerMsg, { type: 'error' }> => m.type === 'error',
    );
    expect(err?.code).toBe('rate_limited');
  });
});

describe('TeamSession presence_position', () => {
  it('updates attachment lat/lng and rebroadcasts presence with new coords', async () => {
    const a = await openSocket(PLAYER_A.id, PLAYER_A.name);
    const b = await openSocket(PLAYER_B.id, PLAYER_B.name);

    // Wait for both attach presence frames.
    await new Promise((r) => setTimeout(r, 50));

    // A sends a position update.
    a.ws.send(JSON.stringify({
      v: 1, type: 'presence_position',
      lat: 44.5, lng: 26.2, accuracy: 10,
    }));

    // Wait for B to receive a presence frame with A's coords.
    await waitFor(() => {
      const frames = b.msgs.filter(
        (m): m is Extract<ServerMsg, { type: 'presence' }> => m.type === 'presence',
      );
      const latest = frames[frames.length - 1];
      return !!latest && latest.players.some(
        (p) => p.playerId === PLAYER_A.id && p.lat === 44.5 && p.lng === 26.2,
      );
    });
  });
});
