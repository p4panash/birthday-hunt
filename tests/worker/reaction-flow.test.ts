// Tests for the TeamSession DO react_send handler (T17).
//   - Valid emoji broadcasts react_show to every socket
//   - Sender info resolved from attachment, not envelope
//   - Server-side id, sender info enforced
//   - Rate-limit enforcement (2/sec, 60/min)
//   - Invalid emoji rejected

import {
  abortAllDurableObjects,
  env,
  runInDurableObject,
} from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ServerMsg } from '../../shared/messages';
import { upsertPlayer } from '../../worker/db/queries';

const TEAM_ID = 'team-react-1';
const HUNT_ID = 'hunt-react-1';
const PLAYER_A = { id: 'player-react-a', name: 'andi' };
const PLAYER_B = { id: 'player-react-b', name: 'maria' };

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
     VALUES (?, ?, 'REACT001', 't', 2000)`,
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

function getStub(teamId = TEAM_ID) {
  return env.TEAM_SESSION.get(env.TEAM_SESSION.idFromName(teamId));
}

async function openSocket(
  playerId: string,
  playerName: string,
): Promise<{ ws: WebSocket; msgs: ServerMsg[] }> {
  const stub = getStub();
  const url = `http://internal/ws?player_id=${playerId}&player_name=${encodeURIComponent(playerName)}`;
  const res = await stub.fetch(url, { headers: { Upgrade: 'websocket' } });
  if (res.status !== 101) {
    throw new Error(`expected 101, got ${res.status}`);
  }
  const ws = res.webSocket!;
  const msgs: ServerMsg[] = [];
  ws.addEventListener('message', (e) => {
    const data = typeof e.data === 'string' ? e.data : '';
    msgs.push(JSON.parse(data) as ServerMsg);
  });
  ws.accept();
  return { ws, msgs };
}

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}

function reactsIn(msgs: ServerMsg[]): Array<
  Extract<ServerMsg, { type: 'react_show' }>
> {
  return msgs.filter(
    (m): m is Extract<ServerMsg, { type: 'react_show' }> =>
      m.type === 'react_show',
  );
}

describe('TeamSession react_send', () => {
  it('broadcasts react_show with sender info to all sockets', async () => {
    const a = await openSocket(PLAYER_A.id, PLAYER_A.name);
    const b = await openSocket(PLAYER_B.id, PLAYER_B.name);

    a.ws.send(JSON.stringify({ v: 1, type: 'react_send', emoji: '🎉' }));

    await waitFor(() => reactsIn(b.msgs).length > 0);
    const r = reactsIn(b.msgs)[0];
    expect(r.emoji).toBe('🎉');
    expect(r.sender_id).toBe(PLAYER_A.id);
    expect(r.sender_name).toBe(PLAYER_A.name);
    expect(typeof r.id).toBe('string');
    expect(r.id.length).toBeGreaterThan(0);

    // Sender also receives (so they can render their own echo via WS, even
    // though the UI already echoes locally for snappiness).
    expect(reactsIn(a.msgs).length).toBeGreaterThan(0);
  });

  it('assigns a unique id to each reaction', async () => {
    const a = await openSocket(PLAYER_A.id, PLAYER_A.name);
    a.ws.send(JSON.stringify({ v: 1, type: 'react_send', emoji: '🎉' }));
    await new Promise((r) => setTimeout(r, 800)); // stay under 2/sec
    a.ws.send(JSON.stringify({ v: 1, type: 'react_send', emoji: '❤️' }));

    await waitFor(() => reactsIn(a.msgs).length === 2, 2000);
    const ids = reactsIn(a.msgs).map((r) => r.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('rejects invalid emoji with error envelope', async () => {
    const a = await openSocket(PLAYER_A.id, PLAYER_A.name);
    a.ws.send(JSON.stringify({ v: 1, type: 'react_send', emoji: '💩' }));
    // Invalid emoji should fail Zod parse → error frame.
    await waitFor(
      () => a.msgs.some((m) => m.type === 'error'),
    );
    // No react_show in any socket.
    expect(reactsIn(a.msgs).length).toBe(0);
  });

  it('rejects burst with rate_limited (3rd reaction in same second)', async () => {
    const a = await openSocket(PLAYER_A.id, PLAYER_A.name);
    // 2/sec cap. Send 3 back-to-back.
    a.ws.send(JSON.stringify({ v: 1, type: 'react_send', emoji: '🎉' }));
    a.ws.send(JSON.stringify({ v: 1, type: 'react_send', emoji: '❤️' }));
    a.ws.send(JSON.stringify({ v: 1, type: 'react_send', emoji: '🔥' }));

    await waitFor(
      () => reactsIn(a.msgs).length >= 2 && a.msgs.some((m) => m.type === 'error'),
    );
    expect(reactsIn(a.msgs).length).toBe(2);
    const err = a.msgs.find(
      (m): m is Extract<ServerMsg, { type: 'error' }> => m.type === 'error',
    );
    expect(err?.code).toBe('rate_limited');
    expect(err?.retry_after_ms).toBeGreaterThan(0);
  });
});
