// Tests for the admin chat-wipe endpoint and the DO internal broadcast.

import {
  abortAllDurableObjects,
  env,
  SELF,
  runInDurableObject,
} from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  insertChatMessage,
  insertHunt,
  insertTeam,
  upsertPlayer,
} from '../../worker/db/queries';
import type { ServerMsg } from '../../shared/messages';

const HUNT_ID = 'hunt-wipe-1';
const TEAM_ID = 'team-wipe-1';
const PLAYER_ID = 'player-wipe-1';

async function clearAll() {
  await env.DB.prepare('DELETE FROM chat_messages').run();
  await env.DB.prepare('DELETE FROM team_state').run();
  await env.DB.prepare('DELETE FROM players').run();
  await env.DB.prepare('DELETE FROM teams').run();
  await env.DB.prepare('DELETE FROM hunts').run();
  await env.DB.prepare('DELETE FROM audit_log').run();
}

async function seed() {
  await insertHunt(env.DB, {
    id: HUNT_ID,
    name: 'h',
    friend_name: 'm',
    deadline_iso: '2030-01-01T00:00:00Z',
    config_json: '{}',
  });
  await insertTeam(env.DB, {
    id: TEAM_ID,
    hunt_id: HUNT_ID,
    invite_code: 'WIPE0001',
    name: 't',
  });
  await upsertPlayer(env.DB, {
    id: PLAYER_ID,
    team_id: TEAM_ID,
    name: 'andi',
    client_id: 'cid-' + 'x'.repeat(20),
  });
  // Three chat rows to wipe.
  for (let i = 0; i < 3; i++) {
    await insertChatMessage(env.DB, {
      team_id: TEAM_ID,
      player_id: PLAYER_ID,
      body: `m${i}`,
    });
  }
}

beforeEach(async () => {
  await abortAllDurableObjects();
  await clearAll();
  await seed();
});

describe('POST /api/admin/hunts/:huntId/teams/:teamId/chat/wipe', () => {
  it('deletes rows, writes audit_log, returns count', async () => {
    const res = await SELF.fetch(
      `http://localhost/api/admin/hunts/${HUNT_ID}/teams/${TEAM_ID}/chat/wipe`,
      { method: 'POST' },
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ ok: boolean; wiped: number }>();
    expect(body.ok).toBe(true);
    expect(body.wiped).toBe(3);

    // Rows gone.
    const count = await env.DB
      .prepare('SELECT COUNT(*) AS c FROM chat_messages WHERE team_id = ?')
      .bind(TEAM_ID)
      .first<{ c: number }>();
    expect(count?.c ?? 0).toBe(0);

    // Audit log row written.
    const audit = await env.DB
      .prepare(`SELECT * FROM audit_log WHERE action = 'chat.wipe'`)
      .first<{
        admin_email: string;
        action: string;
        target: string;
        payload_json: string | null;
      }>();
    expect(audit).toBeTruthy();
    expect(audit!.target).toBe(TEAM_ID);
    expect(audit!.action).toBe('chat.wipe');
  });

  it('returns 404 when team does not belong to hunt', async () => {
    // Different hunt id with no matching team.
    const res = await SELF.fetch(
      `http://localhost/api/admin/hunts/ghost-hunt/teams/${TEAM_ID}/chat/wipe`,
      { method: 'POST' },
    );
    expect(res.status).toBe(404);
    const body = await res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('not_found');

    // No audit log row for the failure.
    const count = await env.DB
      .prepare(`SELECT COUNT(*) AS c FROM audit_log`)
      .first<{ c: number }>();
    expect(count?.c ?? 0).toBe(0);
  });

  it('returns 0 wiped when team has no chat (idempotent)', async () => {
    // Wipe once to empty it, then wipe again.
    await SELF.fetch(
      `http://localhost/api/admin/hunts/${HUNT_ID}/teams/${TEAM_ID}/chat/wipe`,
      { method: 'POST' },
    );
    const res = await SELF.fetch(
      `http://localhost/api/admin/hunts/${HUNT_ID}/teams/${TEAM_ID}/chat/wipe`,
      { method: 'POST' },
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ wiped: number }>();
    expect(body.wiped).toBe(0);
  });
});

describe('TeamSession /internal/chat/wipe — broadcast', () => {
  it('broadcasts chat_wiped to every connected socket', async () => {
    const id = env.TEAM_SESSION.idFromName(TEAM_ID);
    const stub = env.TEAM_SESSION.get(id);

    // Open two sockets.
    async function openSocket(playerId: string, name: string) {
      const url = `http://internal/ws?player_id=${playerId}&player_name=${encodeURIComponent(name)}`;
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

    const a = await openSocket(PLAYER_ID, 'andi');
    const b = await openSocket('player-other', 'maria');

    // Reset attachments — runInDurableObject lets us peek at the count, but
    // we mainly need the sockets to be live. Wait a tick to ensure attach
    // events processed.
    await new Promise((r) => setTimeout(r, 50));

    // Fire the internal endpoint.
    const wipeRes = await stub.fetch('http://internal/internal/chat/wipe', {
      method: 'POST',
    });
    expect(wipeRes.status).toBe(200);

    // Wait for broadcast.
    const start = Date.now();
    while (
      !a.msgs.some((m) => m.type === 'chat_wiped') ||
      !b.msgs.some((m) => m.type === 'chat_wiped')
    ) {
      if (Date.now() - start > 1000) throw new Error('chat_wiped not broadcast');
      await new Promise((r) => setTimeout(r, 10));
    }

    expect(a.msgs.find((m) => m.type === 'chat_wiped')).toBeDefined();
    expect(b.msgs.find((m) => m.type === 'chat_wiped')).toBeDefined();
  });
});
