// Admin routes (mount at /api/admin). Every handler runs after requireAdmin
// middleware, so c.get('admin') is always set. Mutations append to audit_log.

import { Hono } from 'hono';
import { generateInviteCode } from '../lib/invite';
import { nanoid } from '../lib/id';
import { requireAdmin } from '../middleware/access';
import {
  appendAuditLog,
  getHunt,
  getTeamState,
  insertHunt,
  insertTeam,
  listHunts,
  listPlayersByTeam,
  listTeamsByHunt,
  patchHunt,
} from '../db/queries';
import {
  CreateHuntRequestSchema,
  CreateTeamRequestSchema,
  PatchHuntRequestSchema,
} from '../lib/validators';
import type { Env } from '../index';
import type { HuntRow, TeamRow } from '../db/schema';

const admin = new Hono<{ Bindings: Env }>();

admin.use('*', requireAdmin);

function huntToResponse(row: HuntRow) {
  return {
    id: row.id,
    name: row.name,
    friend_name: row.friend_name,
    deadline_iso: row.deadline_iso,
    config: JSON.parse(row.config_json) as unknown,
    created_at: row.created_at,
  };
}

function teamToResponse(row: TeamRow) {
  return {
    id: row.id,
    hunt_id: row.hunt_id,
    invite_code: row.invite_code,
    name: row.name,
    created_at: row.created_at,
  };
}

// ── Hunts ────────────────────────────────────────────────────────────

admin.post('/hunts', async (c) => {
  const admin = c.get('admin');
  const body = CreateHuntRequestSchema.parse(await c.req.json());

  const id = nanoid();
  const hunt = await insertHunt(c.env.DB, {
    id,
    name: body.name,
    friend_name: body.friend_name,
    deadline_iso: body.deadline_iso,
    config_json: JSON.stringify(body.config),
  });

  await appendAuditLog(c.env.DB, {
    admin_email: admin.email,
    action: 'create_hunt',
    target: id,
    payload_json: JSON.stringify({ name: body.name }),
  });

  return c.json({ hunt: huntToResponse(hunt) }, 201);
});

admin.get('/hunts', async (c) => {
  const rows = await listHunts(c.env.DB);
  return c.json({ hunts: rows.map(huntToResponse) });
});

admin.get('/hunts/:id', async (c) => {
  const id = c.req.param('id');
  const hunt = await getHunt(c.env.DB, id);
  if (!hunt) {
    return c.json({ error: { code: 'not_found', message: 'hunt not found' } }, 404);
  }

  const teams = await listTeamsByHunt(c.env.DB, id);
  const teamsWithProgress = await Promise.all(
    teams.map(async (team) => {
      const [players, state] = await Promise.all([
        listPlayersByTeam(c.env.DB, team.id),
        getTeamState(c.env.DB, team.id),
      ]);
      const unlocked = state
        ? (JSON.parse(state.unlocked_json) as boolean[])
        : [false, false, false];
      return {
        ...teamToResponse(team),
        players: players.length,
        step: state?.step_kind ?? 'intro',
        unlocked_count: unlocked.filter(Boolean).length,
        started_at: state?.started_at ?? null,
        updated_at: state?.updated_at ?? null,
      };
    }),
  );

  return c.json({
    hunt: huntToResponse(hunt),
    teams: teamsWithProgress,
  });
});

admin.patch('/hunts/:id', async (c) => {
  const admin = c.get('admin');
  const id = c.req.param('id');
  const body = PatchHuntRequestSchema.parse(await c.req.json());

  const patch: Parameters<typeof patchHunt>[2] = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.friend_name !== undefined) patch.friend_name = body.friend_name;
  if (body.deadline_iso !== undefined) patch.deadline_iso = body.deadline_iso;
  if (body.config !== undefined) patch.config_json = JSON.stringify(body.config);

  const updated = await patchHunt(c.env.DB, id, patch);
  if (!updated) {
    return c.json({ error: { code: 'not_found', message: 'hunt not found' } }, 404);
  }

  await appendAuditLog(c.env.DB, {
    admin_email: admin.email,
    action: 'patch_hunt',
    target: id,
    payload_json: JSON.stringify(Object.keys(patch)),
  });

  return c.json({ hunt: huntToResponse(updated) });
});

// ── Teams ────────────────────────────────────────────────────────────

admin.post('/hunts/:huntId/teams', async (c) => {
  const admin = c.get('admin');
  const huntId = c.req.param('huntId');
  const body = CreateTeamRequestSchema.parse(await c.req.json());

  const hunt = await getHunt(c.env.DB, huntId);
  if (!hunt) {
    return c.json({ error: { code: 'not_found', message: 'hunt not found' } }, 404);
  }

  // Retry on collision (vanishingly rare at ~1.1T code space).
  let team: TeamRow | null = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      team = await insertTeam(c.env.DB, {
        id: nanoid(),
        hunt_id: huntId,
        invite_code: generateInviteCode(),
        name: body.name,
      });
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (!team) {
    throw lastErr instanceof Error ? lastErr : new Error('failed to create team');
  }

  await appendAuditLog(c.env.DB, {
    admin_email: admin.email,
    action: 'create_team',
    target: team.id,
    payload_json: JSON.stringify({ hunt_id: huntId, name: body.name }),
  });

  return c.json({ team: teamToResponse(team) }, 201);
});

export { admin as adminRoutes };
