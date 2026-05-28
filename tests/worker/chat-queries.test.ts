// Unit tests for chat-related D1 helpers in worker/db/queries.ts.

import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  insertChatMessage,
  insertHunt,
  insertTeam,
  listRecentChat,
  upsertPlayer,
  wipeChatForTeam,
} from '../../worker/db/queries';

async function clearAll() {
  await env.DB.prepare('DELETE FROM chat_messages').run();
  await env.DB.prepare('DELETE FROM team_state').run();
  await env.DB.prepare('DELETE FROM players').run();
  await env.DB.prepare('DELETE FROM teams').run();
  await env.DB.prepare('DELETE FROM hunts').run();
}

beforeEach(clearAll);

async function seedTeamWithPlayer(suffix = '') {
  const huntId = `hunt-${suffix || 'a'}`;
  const teamId = `team-${suffix || 'a'}`;
  const playerId = `player-${suffix || 'a'}`;
  await insertHunt(env.DB, {
    id: huntId,
    name: 'h',
    friend_name: 'f',
    deadline_iso: '2026-12-01T00:00:00+03:00',
    config_json: '{}',
  });
  await insertTeam(env.DB, {
    id: teamId,
    hunt_id: huntId,
    invite_code: `INVT${suffix || 'A'}001`,
    name: 't',
  });
  await upsertPlayer(env.DB, {
    id: playerId,
    team_id: teamId,
    name: `player ${suffix || 'a'}`,
    client_id: `cid-${suffix || 'a'}-${'x'.repeat(16)}`,
  });
  return { teamId, playerId };
}

describe('insertChatMessage', () => {
  it('persists a chat row and returns it with id + created_at', async () => {
    const { teamId, playerId } = await seedTeamWithPlayer();
    const row = await insertChatMessage(env.DB, {
      team_id: teamId,
      player_id: playerId,
      body: 'hi team',
    });
    expect(row.id).toBeGreaterThan(0);
    expect(row.team_id).toBe(teamId);
    expect(row.player_id).toBe(playerId);
    expect(row.body).toBe('hi team');
    expect(row.created_at).toBeGreaterThan(0);
  });
});

describe('listRecentChat', () => {
  it('returns last N messages newest-first', async () => {
    const { teamId, playerId } = await seedTeamWithPlayer();
    for (let i = 0; i < 5; i++) {
      await insertChatMessage(env.DB, {
        team_id: teamId,
        player_id: playerId,
        body: `msg ${i}`,
        created_at: 1716800000000 + i * 1000,
      });
    }
    const rows = await listRecentChat(env.DB, teamId, 3);
    expect(rows).toHaveLength(3);
    expect(rows[0].body).toBe('msg 4'); // newest first
    expect(rows[2].body).toBe('msg 2');
  });

  it('returns empty array when team has no chat', async () => {
    const { teamId } = await seedTeamWithPlayer();
    const rows = await listRecentChat(env.DB, teamId, 50);
    expect(rows).toEqual([]);
  });

  it('isolates teams (cross-team leakage check)', async () => {
    const a = await seedTeamWithPlayer('a');
    const b = await seedTeamWithPlayer('b');
    await insertChatMessage(env.DB, {
      team_id: a.teamId,
      player_id: a.playerId,
      body: 'A secret',
    });
    await insertChatMessage(env.DB, {
      team_id: b.teamId,
      player_id: b.playerId,
      body: 'B secret',
    });
    const aRows = await listRecentChat(env.DB, a.teamId, 50);
    const bRows = await listRecentChat(env.DB, b.teamId, 50);
    expect(aRows).toHaveLength(1);
    expect(aRows[0].body).toBe('A secret');
    expect(bRows).toHaveLength(1);
    expect(bRows[0].body).toBe('B secret');
  });
});

describe('wipeChatForTeam', () => {
  it('deletes all rows for the target team and returns count', async () => {
    const { teamId, playerId } = await seedTeamWithPlayer();
    for (let i = 0; i < 4; i++) {
      await insertChatMessage(env.DB, {
        team_id: teamId,
        player_id: playerId,
        body: `m${i}`,
      });
    }
    const wiped = await wipeChatForTeam(env.DB, teamId);
    expect(wiped).toBe(4);
    expect(await listRecentChat(env.DB, teamId, 50)).toEqual([]);
  });

  it('does not touch other teams', async () => {
    const a = await seedTeamWithPlayer('a');
    const b = await seedTeamWithPlayer('b');
    await insertChatMessage(env.DB, {
      team_id: a.teamId,
      player_id: a.playerId,
      body: 'A',
    });
    await insertChatMessage(env.DB, {
      team_id: b.teamId,
      player_id: b.playerId,
      body: 'B',
    });
    await wipeChatForTeam(env.DB, a.teamId);
    const bRows = await listRecentChat(env.DB, b.teamId, 50);
    expect(bRows).toHaveLength(1);
    expect(bRows[0].body).toBe('B');
  });

  it('returns 0 when team has no chat', async () => {
    const { teamId } = await seedTeamWithPlayer();
    expect(await wipeChatForTeam(env.DB, teamId)).toBe(0);
  });
});
