// Player-facing routes. No CF Access — anyone with an invite code can join.
// The WebSocket upgrade route is added by T17 (after the TeamSession DO is
// wired); for now this file only handles join + initial state + hunt config.

import { Hono } from 'hono';
import {
  getHunt,
  getPlayer,
  getPlayerByClientId,
  getTeam,
  getTeamByInviteCode,
  getTeamState,
  listPlayersByTeam,
  upsertPlayer,
} from '../db/queries';
import { nanoid } from '../lib/id';
import { JoinTeamRequestSchema } from '../lib/validators';
import type { Env } from '../index';

/** Per spec § resolved-decision #8 — caps concurrent players on a team. */
const MAX_PLAYERS_PER_TEAM = 10;

const teams = new Hono<{ Bindings: Env }>();

teams.post('/join', async (c) => {
  const body = JoinTeamRequestSchema.parse(await c.req.json());

  const team = await getTeamByInviteCode(c.env.DB, body.invite_code);
  if (!team) {
    return c.json(
      { error: { code: 'invalid_invite', message: 'invite code not found' } },
      404,
    );
  }

  const hunt = await getHunt(c.env.DB, team.hunt_id);
  if (!hunt) {
    // Should never happen — FK guarantees it. Defensive 500.
    return c.json(
      { error: { code: 'orphan_team', message: 'hunt missing for team' } },
      500,
    );
  }

  // Enforce the team-size cap BEFORE upserting. Re-binding an existing player
  // (same client_id) does not consume a new slot, so check that first.
  //
  // Known race: the read-then-write between the count and upsertPlayer is not
  // atomic. Two simultaneous new-player requests at count==9 could both pass
  // the check and land 11 rows. D1 has no SELECT...FOR UPDATE; the proper fix
  // is either an atomic conditional INSERT or routing through TeamSession DO
  // (which serialises mutations per team). At ≤10 friends joining a birthday
  // hunt, the probability of a race is vanishing — accepted risk for v1.
  const existing = await getPlayerByClientId(
    c.env.DB,
    team.id,
    body.client_id,
  );
  if (!existing) {
    const current = await listPlayersByTeam(c.env.DB, team.id);
    if (current.length >= MAX_PLAYERS_PER_TEAM) {
      return c.json(
        {
          error: {
            code: 'team_full',
            message: `team is full (max ${MAX_PLAYERS_PER_TEAM} players)`,
          },
        },
        403,
      );
    }
  }

  const player = await upsertPlayer(c.env.DB, {
    id: nanoid(),
    team_id: team.id,
    name: body.player_name,
    client_id: body.client_id,
  });

  return c.json({
    team: {
      id: team.id,
      name: team.name,
      hunt_id: team.hunt_id,
    },
    player: {
      id: player.id,
      name: player.name,
    },
    hunt: {
      id: hunt.id,
      name: hunt.name,
      friend_name: hunt.friend_name,
      deadline_iso: hunt.deadline_iso,
      config: JSON.parse(hunt.config_json) as unknown,
    },
  });
});

teams.get('/:id', async (c) => {
  const teamId = c.req.param('id');
  const team = await getTeam(c.env.DB, teamId);
  if (!team) {
    return c.json(
      { error: { code: 'not_found', message: 'team not found' } },
      404,
    );
  }
  const state = await getTeamState(c.env.DB, teamId);
  return c.json({
    team: {
      id: team.id,
      name: team.name,
      hunt_id: team.hunt_id,
    },
    state: state
      ? {
          step: {
            kind: state.step_kind,
            ...(JSON.parse(state.step_payload_json) as Record<string, unknown>),
          },
          unlocked: JSON.parse(state.unlocked_json) as [
            boolean, boolean, boolean,
          ],
          startedAt: state.started_at,
          testMode: false,
        }
      : null,
  });
});

// ── WebSocket upgrade ────────────────────────────────────────────────
// Validates the player belongs to the team, then forwards to the TeamSession
// Durable Object. The DO handles the actual upgrade and message lifecycle.

teams.get('/:id/ws', async (c) => {
  if (c.req.header('upgrade') !== 'websocket') {
    return c.text('expected websocket upgrade', 426);
  }
  const teamId = c.req.param('id');
  const playerId = c.req.query('player_id');
  if (!playerId) {
    return c.text('player_id required', 400);
  }

  const team = await getTeam(c.env.DB, teamId);
  if (!team) return c.text('team not found', 404);

  const player = await getPlayer(c.env.DB, playerId);
  if (!player || player.team_id !== teamId) {
    return c.text('invalid player', 403);
  }

  const doId = c.env.TEAM_SESSION.idFromName(teamId);
  const stub = c.env.TEAM_SESSION.get(doId);

  const url = new URL('http://internal/ws');
  url.searchParams.set('player_id', player.id);
  url.searchParams.set('player_name', player.name);

  return stub.fetch(url.toString(), {
    method: 'GET',
    headers: { Upgrade: 'websocket' },
  });
});

const huntsPublic = new Hono<{ Bindings: Env }>();

huntsPublic.get('/:id/config', async (c) => {
  const id = c.req.param('id');
  const hunt = await getHunt(c.env.DB, id);
  if (!hunt) {
    return c.json(
      { error: { code: 'not_found', message: 'hunt not found' } },
      404,
    );
  }
  return c.json({
    id: hunt.id,
    name: hunt.name,
    friend_name: hunt.friend_name,
    deadline_iso: hunt.deadline_iso,
    config: JSON.parse(hunt.config_json) as unknown,
  });
});

export { teams as teamRoutes, huntsPublic as huntPublicRoutes };
