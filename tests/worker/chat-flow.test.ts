// Integration tests for the TeamSession DO chat path (T6-T8).
//   - chat_send body validation + persistence + broadcast
//   - chat_snapshot on WS attach
//   - Per-player rate limit
//   - player_name resolved from attachment, not envelope

import {
  abortAllDurableObjects,
  env,
  runInDurableObject,
} from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ChatMessage, ServerMsg } from '../../shared/messages';
import { insertChatMessage, upsertPlayer } from '../../worker/db/queries';

const TEAM_ID = 'team-chat-1';
const HUNT_ID = 'hunt-chat-1';
const PLAYER_A = { id: 'player-a', name: 'andi' };
const PLAYER_B = { id: 'player-b', name: 'maria' };

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
     VALUES (?, ?, 'CHAT0001', 't', 2000)`,
  ).bind(TEAM_ID, HUNT_ID).run();
  await upsertPlayer(env.DB, {
    id: PLAYER_A.id,
    team_id: TEAM_ID,
    name: PLAYER_A.name,
    client_id: 'cid-a-' + 'x'.repeat(16),
  });
  await upsertPlayer(env.DB, {
    id: PLAYER_B.id,
    team_id: TEAM_ID,
    name: PLAYER_B.name,
    client_id: 'cid-b-' + 'x'.repeat(16),
  });
}

beforeEach(async () => {
  await abortAllDurableObjects();
  await clearAll();
  await seed();
});

function getStub(teamId = TEAM_ID) {
  const id = env.TEAM_SESSION.idFromName(teamId);
  return env.TEAM_SESSION.get(id);
}

async function openSocket(
  teamId: string,
  playerId: string,
  playerName: string,
): Promise<{ ws: WebSocket; msgs: ServerMsg[] }> {
  const stub = getStub(teamId);
  const url = `http://internal/ws?player_id=${playerId}&player_name=${encodeURIComponent(playerName)}`;
  const res = await stub.fetch(url, {
    headers: { Upgrade: 'websocket' },
  });
  if (res.status !== 101) {
    throw new Error(`expected 101, got ${res.status}: ${await res.text()}`);
  }
  const ws = res.webSocket;
  if (!ws) throw new Error('response missing webSocket');
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
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor timed out');
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

function findMsg<T extends ServerMsg['type']>(
  msgs: ServerMsg[],
  type: T,
): Extract<ServerMsg, { type: T }> | undefined {
  return msgs.find((m) => m.type === type) as
    | Extract<ServerMsg, { type: T }>
    | undefined;
}

describe('TeamSession chat — happy path', () => {
  it('persists message and broadcasts chat_new to all connected sockets', async () => {
    const a = await openSocket(TEAM_ID, PLAYER_A.id, PLAYER_A.name);
    const b = await openSocket(TEAM_ID, PLAYER_B.id, PLAYER_B.name);

    a.ws.send(JSON.stringify({ v: 1, type: 'chat_send', body: 'hi team' }));

    await waitFor(() => !!findMsg(b.msgs, 'chat_new'));

    const incoming = findMsg(b.msgs, 'chat_new')!;
    expect(incoming.message.body).toBe('hi team');
    expect(incoming.message.player_id).toBe(PLAYER_A.id);
    expect(incoming.message.player_name).toBe(PLAYER_A.name);
    expect(incoming.message.id).toBeGreaterThan(0);

    // Sender also gets the broadcast (acts as ack).
    expect(findMsg(a.msgs, 'chat_new')).toBeTruthy();

    // Row persisted to D1.
    const row = await env.DB
      .prepare('SELECT * FROM chat_messages WHERE team_id = ?')
      .bind(TEAM_ID)
      .first<{ body: string; player_id: string }>();
    expect(row?.body).toBe('hi team');
    expect(row?.player_id).toBe(PLAYER_A.id);
  });

  it('resolves player_name from attachment, ignoring envelope-supplied data', async () => {
    const a = await openSocket(TEAM_ID, PLAYER_A.id, PLAYER_A.name);
    // Try to spoof a different player_name in the envelope (extra field).
    a.ws.send(
      JSON.stringify({
        v: 1,
        type: 'chat_send',
        body: 'spoof?',
        player_name: 'admin', // ignored
      }),
    );
    await waitFor(() => !!findMsg(a.msgs, 'chat_new'));
    const m = findMsg(a.msgs, 'chat_new')!;
    expect(m.message.player_name).toBe(PLAYER_A.name);
    expect(m.message.player_name).not.toBe('admin');
  });
});

describe('TeamSession chat — body validation', () => {
  it('rejects body > 280 chars with error envelope, no broadcast', async () => {
    const a = await openSocket(TEAM_ID, PLAYER_A.id, PLAYER_A.name);
    const b = await openSocket(TEAM_ID, PLAYER_B.id, PLAYER_B.name);

    const tooLong = 'x'.repeat(281);
    a.ws.send(JSON.stringify({ v: 1, type: 'chat_send', body: tooLong }));

    await waitFor(() => !!findMsg(a.msgs, 'error'));
    // Zod's .max(280) on chat_send.body now fails fast at parse time, so the
    // error code is the generic 'invalid_message' (DoS prevention — see
    // shared/messages.ts). Either path is acceptable; both reject identically
    // from the player's perspective.
    const code = findMsg(a.msgs, 'error')!.code;
    expect(['invalid_message', 'body_too_long']).toContain(code);
    // B must not see any chat_new.
    expect(findMsg(b.msgs, 'chat_new')).toBeUndefined();
    // No row persisted.
    const count = await env.DB
      .prepare('SELECT COUNT(*) AS c FROM chat_messages')
      .first<{ c: number }>();
    expect(count?.c ?? 0).toBe(0);
  });

  it('rejects empty body', async () => {
    const a = await openSocket(TEAM_ID, PLAYER_A.id, PLAYER_A.name);
    a.ws.send(JSON.stringify({ v: 1, type: 'chat_send', body: '' }));
    await waitFor(() => !!findMsg(a.msgs, 'error'));
    expect(findMsg(a.msgs, 'error')!.code).toBe('body_empty');
  });
});

describe('TeamSession chat — rate limit (integration)', () => {
  it('rejects burst sends with error:rate_limited (perSecond cap)', async () => {
    const a = await openSocket(TEAM_ID, PLAYER_A.id, PLAYER_A.name);
    // Chat is capped at 1/sec. Two back-to-back sends: first succeeds, second
    // gets rate_limited. (Per-minute cap is covered by RateLimiter unit
    // tests in tests/worker/rate-limits.test.ts so we don't have to fake
    // 60s of wall time here.)
    a.ws.send(JSON.stringify({ v: 1, type: 'chat_send', body: 'first' }));
    a.ws.send(JSON.stringify({ v: 1, type: 'chat_send', body: 'second' }));

    await waitFor(
      () => !!findMsg(a.msgs, 'chat_new') && !!findMsg(a.msgs, 'error'),
    );

    expect(findMsg(a.msgs, 'chat_new')!.message.body).toBe('first');
    const err = findMsg(a.msgs, 'error')!;
    expect(err.code).toBe('rate_limited');
    expect(err.retry_after_ms).toBeGreaterThan(0);

    // Only one row persisted.
    const count = await env.DB
      .prepare('SELECT COUNT(*) AS c FROM chat_messages')
      .first<{ c: number }>();
    expect(count?.c ?? 0).toBe(1);
  });
});

describe('TeamSession chat — snapshot on attach', () => {
  it('sends chat_snapshot with last 50 messages chronologically', async () => {
    // Seed D1 with 60 rows.
    for (let i = 0; i < 60; i++) {
      await insertChatMessage(env.DB, {
        team_id: TEAM_ID,
        player_id: PLAYER_A.id,
        body: `m${i.toString().padStart(2, '0')}`,
        created_at: 1716800000000 + i * 100,
      });
    }

    const a = await openSocket(TEAM_ID, PLAYER_A.id, PLAYER_A.name);
    await waitFor(() => !!findMsg(a.msgs, 'chat_snapshot'));

    const snap = findMsg(a.msgs, 'chat_snapshot')!;
    expect(snap.messages).toHaveLength(50);
    // Chronological — oldest first, last id is highest.
    expect(snap.messages[0].body).toBe('m10');
    expect(snap.messages[49].body).toBe('m59');
    expect(snap.messages[0].id).toBeLessThan(snap.messages[49].id);
  });

  it('sends empty snapshot when team has no chat', async () => {
    const a = await openSocket(TEAM_ID, PLAYER_A.id, PLAYER_A.name);
    await waitFor(() => !!findMsg(a.msgs, 'chat_snapshot'));
    const snap = findMsg(a.msgs, 'chat_snapshot')!;
    expect(snap.messages).toEqual<ChatMessage[]>([]);
  });
});
