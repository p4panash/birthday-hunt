// Tests for worker/do/TeamSession.ts — state persistence, WS broadcast,
// presence. Uses runInDurableObject for direct method calls and stub.fetch for
// WebSocket lifecycle.

import {
  abortAllDurableObjects,
  env,
  runInDurableObject,
} from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

const TEAM_ID = 'team-test-1';
const HUNT_ID = 'hunt-test-1';

async function clearAll() {
  await env.DB.prepare('DELETE FROM team_state').run();
  await env.DB.prepare('DELETE FROM players').run();
  await env.DB.prepare('DELETE FROM teams').run();
  await env.DB.prepare('DELETE FROM hunts').run();
  await env.DB.prepare('DELETE FROM audit_log').run();
}

async function seedTeam() {
  await env.DB.prepare(
    `INSERT INTO hunts (id, name, friend_name, deadline_iso, config_json, created_at)
     VALUES (?, 'h', 'm', '2030-01-01T00:00:00Z', '{}', 1000)`,
  ).bind(HUNT_ID).run();

  await env.DB.prepare(
    `INSERT INTO teams (id, hunt_id, invite_code, name, created_at)
     VALUES (?, ?, 'ABCD1234', 't', 2000)`,
  ).bind(TEAM_ID, HUNT_ID).run();
}

beforeEach(async () => {
  // Reset DO instances FIRST so any lingering WS connections from prior tests
  // don't see the cleared D1 mid-flight.
  await abortAllDurableObjects();
  await clearAll();
  await seedTeam();
});

function getStub(teamId = TEAM_ID) {
  const id = env.TEAM_SESSION.idFromName(teamId);
  return env.TEAM_SESSION.get(id);
}

async function openSocket(
  teamId: string,
  playerId: string,
  playerName: string,
): Promise<{ ws: WebSocket; msgs: unknown[] }> {
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
  const msgs: unknown[] = [];
  ws.addEventListener('message', (e) => {
    msgs.push(JSON.parse(typeof e.data === 'string' ? e.data : ''));
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

describe('TeamSession — state persistence', () => {
  it('starts with initial state', async () => {
    const stub = getStub();
    await runInDurableObject(stub, async (instance) => {
      const s = await instance.getState();
      expect(s.step).toEqual({ kind: 'intro' });
      expect(s.unlocked).toEqual([false, false, false]);
      expect(s.startedAt).toBeNull();
    });
  });

  it('applies an action and persists to D1', async () => {
    const stub = getStub();
    await runInDurableObject(stub, async (instance) => {
      await instance.applyAction({ type: 'START_HUNT' });
    });

    const row = await env.DB
      .prepare('SELECT * FROM team_state WHERE team_id = ?')
      .bind(TEAM_ID)
      .first<{ step_kind: string }>();
    expect(row?.step_kind).toBe('gps-preface');
  });

  it('rehydrates state from D1 across DO instances', async () => {
    // Seed D1 directly
    await env.DB
      .prepare(
        `INSERT INTO team_state (team_id, step_kind, step_payload_json, unlocked_json, started_at, updated_at)
         VALUES (?, 'location', '{"n":1}', '[true,false,false]', 5000, 9000)`,
      )
      .bind(TEAM_ID)
      .run();

    // Fresh DO stub should rehydrate from D1
    const stub = getStub();
    await runInDurableObject(stub, async (instance) => {
      const s = await instance.getState();
      expect(s.step).toEqual({ kind: 'location', n: 1 });
      expect(s.unlocked).toEqual([true, false, false]);
      expect(s.startedAt).toBe(5000);
    });
  });

  it('progresses through full reducer sequence', async () => {
    const stub = getStub();
    await runInDurableObject(stub, async (instance) => {
      await instance.applyAction({ type: 'START_HUNT' });
      await instance.applyAction({ type: 'GRANT_GPS' });
      await instance.applyAction({ type: 'UNLOCK_CHECKPOINT', n: 0 });

      const s = await instance.getState();
      expect(s.step).toEqual({ kind: 'reveal', n: 0 });
      expect(s.unlocked).toEqual([true, false, false]);
    });
  });
});

describe('TeamSession — WebSocket broadcast', () => {
  it('sends initial state frame on connect', async () => {
    const { ws, msgs } = await openSocket(TEAM_ID, 'p1', 'andi');
    await waitFor(() => msgs.some((m) => (m as { type: string }).type === 'state'));
    ws.close();
  });

  it('broadcasts state changes to all connected sockets', async () => {
    const { ws: wsA, msgs: msgsA } = await openSocket(TEAM_ID, 'pa', 'andi');
    const { ws: wsB, msgs: msgsB } = await openSocket(TEAM_ID, 'pb', 'bogdan');

    // Each socket starts with at least a state frame.
    await waitFor(() =>
      msgsA.some((m) => (m as { type: string }).type === 'state') &&
      msgsB.some((m) => (m as { type: string }).type === 'state'),
    );

    const countStateGpsPreface = (msgs: unknown[]) =>
      msgs.filter(
        (m) =>
          (m as { type: string }).type === 'state' &&
          (m as { state?: { step?: { kind: string } } }).state?.step?.kind ===
            'gps-preface',
      ).length;

    expect(countStateGpsPreface(msgsA)).toBe(0);
    expect(countStateGpsPreface(msgsB)).toBe(0);

    wsA.send(
      JSON.stringify({ v: 1, type: 'action', action: { type: 'START_HUNT' } }),
    );

    await waitFor(
      () =>
        countStateGpsPreface(msgsA) >= 1 && countStateGpsPreface(msgsB) >= 1,
      2000,
    );

    wsA.close();
    wsB.close();
  });

  it('responds to ping with pong', async () => {
    const { ws, msgs } = await openSocket(TEAM_ID, 'p1', 'andi');
    await waitFor(() => msgs.some((m) => (m as { type: string }).type === 'state'));

    ws.send(JSON.stringify({ v: 1, type: 'ping' }));
    await waitFor(
      () => msgs.some((m) => (m as { type: string }).type === 'pong'),
      1000,
    );
    ws.close();
  });

  it('responds with error on malformed message', async () => {
    const { ws, msgs } = await openSocket(TEAM_ID, 'p1', 'andi');
    await waitFor(() => msgs.some((m) => (m as { type: string }).type === 'state'));

    ws.send('not json');
    await waitFor(
      () => msgs.some((m) => (m as { type: string }).type === 'error'),
      1000,
    );
    ws.close();
  });
});

describe('TeamSession — presence', () => {
  it('emits presence frame listing connected players', async () => {
    const { ws, msgs } = await openSocket(TEAM_ID, 'p1', 'andi');
    await waitFor(
      () => msgs.some((m) => (m as { type: string }).type === 'presence'),
      1000,
    );
    const presence = msgs.find(
      (m) => (m as { type: string }).type === 'presence',
    ) as { players: Array<{ playerId: string; name: string }> };
    expect(presence.players).toHaveLength(1);
    expect(presence.players[0]).toMatchObject({ playerId: 'p1', name: 'andi' });
    ws.close();
  });

  it('updates presence when second player joins', async () => {
    const { ws: wsA, msgs: msgsA } = await openSocket(TEAM_ID, 'pa', 'andi');
    await waitFor(() => msgsA.some((m) => (m as { type: string }).type === 'presence'));

    const { ws: wsB } = await openSocket(TEAM_ID, 'pb', 'bogdan');

    await waitFor(() => {
      const lastPresence = [...msgsA]
        .reverse()
        .find((m) => (m as { type: string }).type === 'presence') as
        | { players: unknown[] }
        | undefined;
      return lastPresence !== undefined && lastPresence.players.length === 2;
    }, 2000);

    wsA.close();
    wsB.close();
  });

  it('rejects upgrade without player_id', async () => {
    const stub = getStub();
    const res = await stub.fetch('http://internal/ws', {
      headers: { Upgrade: 'websocket' },
    });
    expect(res.status).toBe(400);
  });
});
