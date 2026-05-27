// Integration tests for worker/db/queries.ts. Each helper is covered with at
// least one happy path and one miss/edge case. Tests share a single D1 binding
// via @cloudflare/vitest-pool-workers; rows are cleared before each test.

import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendAuditLog,
  getHunt,
  getPlayer,
  getPlayerByClientId,
  getTeam,
  getTeamByInviteCode,
  getTeamState,
  insertHunt,
  insertTeam,
  listAuditLog,
  listHunts,
  listPlayersByTeam,
  listTeamsByHunt,
  patchHunt,
  touchPlayer,
  upsertPlayer,
  writeTeamState,
} from '../../worker/db/queries';

async function clearAll() {
  // FK order: state -> players -> teams -> hunts. audit_log is independent.
  await env.DB.prepare('DELETE FROM team_state').run();
  await env.DB.prepare('DELETE FROM players').run();
  await env.DB.prepare('DELETE FROM teams').run();
  await env.DB.prepare('DELETE FROM hunts').run();
  await env.DB.prepare('DELETE FROM audit_log').run();
}

beforeEach(clearAll);

async function seedHunt(id = 'h1') {
  return insertHunt(env.DB, {
    id,
    name: `hunt-${id}`,
    friend_name: 'mihali',
    deadline_iso: '2026-05-28T01:10:00+03:00',
    config_json: '{"friendName":"mihali"}',
    created_at: 1000,
  });
}

async function seedTeam(huntId = 'h1', id = 't1', invite = 'ABCD1234') {
  return insertTeam(env.DB, {
    id,
    hunt_id: huntId,
    invite_code: invite,
    name: `team-${id}`,
    created_at: 2000,
  });
}

describe('hunts', () => {
  it('inserts and reads a hunt', async () => {
    const inserted = await seedHunt();
    const fetched = await getHunt(env.DB, 'h1');
    expect(fetched).toEqual(inserted);
  });

  it('returns null for missing hunt', async () => {
    expect(await getHunt(env.DB, 'nope')).toBeNull();
  });

  it('lists hunts newest first', async () => {
    await insertHunt(env.DB, {
      id: 'h1', name: 'a', friend_name: 'x',
      deadline_iso: 'd', config_json: '{}', created_at: 1000,
    });
    await insertHunt(env.DB, {
      id: 'h2', name: 'b', friend_name: 'y',
      deadline_iso: 'd', config_json: '{}', created_at: 2000,
    });
    const list = await listHunts(env.DB);
    expect(list.map((h) => h.id)).toEqual(['h2', 'h1']);
  });

  it('returns empty list when no hunts', async () => {
    expect(await listHunts(env.DB)).toEqual([]);
  });

  it('patches a hunt and returns the new row', async () => {
    await seedHunt();
    const patched = await patchHunt(env.DB, 'h1', {
      deadline_iso: '2030-01-01T00:00:00Z',
      config_json: '{"friendName":"new"}',
    });
    expect(patched?.deadline_iso).toBe('2030-01-01T00:00:00Z');
    expect(patched?.config_json).toBe('{"friendName":"new"}');
    expect(patched?.name).toBe('hunt-h1');
  });

  it('patch with empty body returns current row', async () => {
    const original = await seedHunt();
    const patched = await patchHunt(env.DB, 'h1', {});
    expect(patched).toEqual(original);
  });

  it('patch missing hunt returns null', async () => {
    expect(await patchHunt(env.DB, 'ghost', { name: 'x' })).toBeNull();
  });
});

describe('teams', () => {
  beforeEach(async () => {
    await seedHunt();
  });

  it('inserts and reads a team', async () => {
    const inserted = await seedTeam();
    expect(await getTeam(env.DB, 't1')).toEqual(inserted);
  });

  it('looks up by invite code', async () => {
    await seedTeam();
    const found = await getTeamByInviteCode(env.DB, 'ABCD1234');
    expect(found?.id).toBe('t1');
  });

  it('returns null for unknown invite code', async () => {
    await seedTeam();
    expect(await getTeamByInviteCode(env.DB, 'NOPE0000')).toBeNull();
  });

  it('lists teams for a hunt', async () => {
    await seedTeam('h1', 't1', 'INVITE001');
    await seedTeam('h1', 't2', 'INVITE002');
    const list = await listTeamsByHunt(env.DB, 'h1');
    expect(list.map((t) => t.id).sort()).toEqual(['t1', 't2']);
  });

  it('returns empty list for hunt with no teams', async () => {
    expect(await listTeamsByHunt(env.DB, 'h1')).toEqual([]);
  });
});

describe('players', () => {
  beforeEach(async () => {
    await seedHunt();
    await seedTeam();
  });

  it('inserts a new player and reads it', async () => {
    const created = await upsertPlayer(env.DB, {
      id: 'p1', team_id: 't1', name: 'andi', client_id: 'client-a', now: 3000,
    });
    expect(created.id).toBe('p1');
    expect(await getPlayer(env.DB, 'p1')).toEqual(created);
  });

  it('upsert re-binds existing (team_id, client_id) without changing id', async () => {
    await upsertPlayer(env.DB, {
      id: 'p1', team_id: 't1', name: 'andi', client_id: 'client-a', now: 3000,
    });
    const rebound = await upsertPlayer(env.DB, {
      id: 'p2-different', team_id: 't1', name: 'andrei', client_id: 'client-a', now: 4000,
    });
    expect(rebound.id).toBe('p1');
    expect(rebound.name).toBe('andrei');
    expect(rebound.last_seen_at).toBe(4000);
    expect(rebound.joined_at).toBe(3000);
    const all = await listPlayersByTeam(env.DB, 't1');
    expect(all.length).toBe(1);
  });

  it('different client_id creates a new player', async () => {
    await upsertPlayer(env.DB, {
      id: 'p1', team_id: 't1', name: 'a', client_id: 'cli-a', now: 3000,
    });
    await upsertPlayer(env.DB, {
      id: 'p2', team_id: 't1', name: 'b', client_id: 'cli-b', now: 3001,
    });
    expect((await listPlayersByTeam(env.DB, 't1')).length).toBe(2);
  });

  it('getPlayerByClientId returns null for unknown pair', async () => {
    expect(await getPlayerByClientId(env.DB, 't1', 'ghost')).toBeNull();
  });

  it('touchPlayer updates last_seen_at', async () => {
    await upsertPlayer(env.DB, {
      id: 'p1', team_id: 't1', name: 'a', client_id: 'c', now: 3000,
    });
    await touchPlayer(env.DB, 'p1', 9999);
    expect((await getPlayer(env.DB, 'p1'))?.last_seen_at).toBe(9999);
  });
});

describe('team_state', () => {
  beforeEach(async () => {
    await seedHunt();
    await seedTeam();
  });

  it('inserts then upserts via on-conflict', async () => {
    const first = await writeTeamState(env.DB, {
      team_id: 't1', step_kind: 'intro', step_payload_json: '{}',
      unlocked_json: '[false,false,false]', started_at: null, updated_at: 5000,
    });
    expect(first.step_kind).toBe('intro');

    const second = await writeTeamState(env.DB, {
      team_id: 't1', step_kind: 'location', step_payload_json: '{"n":0}',
      unlocked_json: '[true,false,false]', started_at: 1000, updated_at: 6000,
    });
    expect(second.step_kind).toBe('location');

    const fetched = await getTeamState(env.DB, 't1');
    expect(fetched?.step_kind).toBe('location');
    expect(fetched?.started_at).toBe(1000);
  });

  it('getTeamState returns null when no row', async () => {
    expect(await getTeamState(env.DB, 't1')).toBeNull();
  });
});

describe('audit_log', () => {
  it('appends and lists newest first', async () => {
    await appendAuditLog(env.DB, {
      admin_email: 'a@example.com', action: 'create_hunt', target: 'h1',
      payload_json: '{}', created_at: 1000,
    });
    await appendAuditLog(env.DB, {
      admin_email: 'a@example.com', action: 'patch_hunt', target: 'h1',
      created_at: 2000,
    });
    const list = await listAuditLog(env.DB);
    expect(list.map((r) => r.action)).toEqual(['patch_hunt', 'create_hunt']);
    expect(list[0].payload_json).toBeNull();
  });

  it('returns empty list when no entries', async () => {
    expect(await listAuditLog(env.DB)).toEqual([]);
  });

  it('respects limit', async () => {
    for (let i = 0; i < 5; i++) {
      await appendAuditLog(env.DB, {
        admin_email: 'a@example.com', action: 'noop', target: 't',
        created_at: 1000 + i,
      });
    }
    expect((await listAuditLog(env.DB, 2)).length).toBe(2);
  });
});
