// Prepared-statement helpers for the multiplayer backend's D1 access.
//
// Every helper is async, returns parsed/typed rows from ./schema, and uses
// parameter binding (never string concat) for safety. Helpers that look up by
// primary key return `null` on miss; helpers that list return `[]` on empty.

import type {
  AuditLogRow,
  ChatMessageRow,
  HuntRow,
  PlayerRow,
  PushSubscriptionRow,
  TeamRow,
  TeamStateRow,
} from './schema';

// ---------- hunts ----------

export async function insertHunt(
  db: D1Database,
  input: {
    id: string;
    name: string;
    friend_name: string;
    deadline_iso: string;
    config_json: string;
    created_at?: number;
  },
): Promise<HuntRow> {
  const created_at = input.created_at ?? Date.now();
  await db
    .prepare(
      `INSERT INTO hunts (id, name, friend_name, deadline_iso, config_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.name,
      input.friend_name,
      input.deadline_iso,
      input.config_json,
      created_at,
    )
    .run();
  return { ...input, created_at };
}

export async function getHunt(db: D1Database, id: string): Promise<HuntRow | null> {
  return await db
    .prepare(`SELECT * FROM hunts WHERE id = ?`)
    .bind(id)
    .first<HuntRow>();
}

export async function listHunts(db: D1Database): Promise<HuntRow[]> {
  const result = await db
    .prepare(`SELECT * FROM hunts ORDER BY created_at DESC`)
    .all<HuntRow>();
  return result.results ?? [];
}

const HUNT_PATCH_KEYS = ['name', 'friend_name', 'deadline_iso', 'config_json'] as const;
type HuntPatchKey = (typeof HUNT_PATCH_KEYS)[number];
type HuntPatch = Partial<Pick<HuntRow, HuntPatchKey>>;

export async function patchHunt(
  db: D1Database,
  id: string,
  patch: HuntPatch,
): Promise<HuntRow | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  for (const key of HUNT_PATCH_KEYS) {
    const value = patch[key];
    if (value === undefined) continue;
    updates.push(`${key} = ?`);
    values.push(value);
  }
  if (updates.length === 0) {
    return getHunt(db, id);
  }
  values.push(id);
  await db
    .prepare(`UPDATE hunts SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
  return getHunt(db, id);
}

// ---------- teams ----------

export async function insertTeam(
  db: D1Database,
  input: {
    id: string;
    hunt_id: string;
    invite_code: string;
    name: string;
    created_at?: number;
  },
): Promise<TeamRow> {
  const created_at = input.created_at ?? Date.now();
  await db
    .prepare(
      `INSERT INTO teams (id, hunt_id, invite_code, name, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(input.id, input.hunt_id, input.invite_code, input.name, created_at)
    .run();
  return { ...input, created_at };
}

export async function getTeam(db: D1Database, id: string): Promise<TeamRow | null> {
  return await db
    .prepare(`SELECT * FROM teams WHERE id = ?`)
    .bind(id)
    .first<TeamRow>();
}

export async function getTeamByInviteCode(
  db: D1Database,
  inviteCode: string,
): Promise<TeamRow | null> {
  return await db
    .prepare(`SELECT * FROM teams WHERE invite_code = ?`)
    .bind(inviteCode)
    .first<TeamRow>();
}

export async function listTeamsByHunt(
  db: D1Database,
  huntId: string,
): Promise<TeamRow[]> {
  const result = await db
    .prepare(`SELECT * FROM teams WHERE hunt_id = ? ORDER BY created_at DESC`)
    .bind(huntId)
    .all<TeamRow>();
  return result.results ?? [];
}

// ---------- players ----------

/**
 * Upsert by (team_id, client_id) — the unique index from migration 0001.
 * Re-binds existing rows (preserving id) and updates last_seen_at.
 */
export async function upsertPlayer(
  db: D1Database,
  input: {
    id: string;
    team_id: string;
    name: string;
    client_id: string;
    now?: number;
  },
): Promise<PlayerRow> {
  const now = input.now ?? Date.now();
  // Try to find existing first; if present, update last_seen_at + name and return it.
  const existing = await getPlayerByClientId(db, input.team_id, input.client_id);
  if (existing) {
    await db
      .prepare(`UPDATE players SET name = ?, last_seen_at = ? WHERE id = ?`)
      .bind(input.name, now, existing.id)
      .run();
    return { ...existing, name: input.name, last_seen_at: now };
  }
  await db
    .prepare(
      `INSERT INTO players (id, team_id, name, client_id, joined_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(input.id, input.team_id, input.name, input.client_id, now, now)
    .run();
  return {
    id: input.id,
    team_id: input.team_id,
    name: input.name,
    client_id: input.client_id,
    joined_at: now,
    last_seen_at: now,
  };
}

export async function getPlayer(db: D1Database, id: string): Promise<PlayerRow | null> {
  return await db
    .prepare(`SELECT * FROM players WHERE id = ?`)
    .bind(id)
    .first<PlayerRow>();
}

export async function getPlayerByClientId(
  db: D1Database,
  teamId: string,
  clientId: string,
): Promise<PlayerRow | null> {
  return await db
    .prepare(`SELECT * FROM players WHERE team_id = ? AND client_id = ?`)
    .bind(teamId, clientId)
    .first<PlayerRow>();
}

export async function listPlayersByTeam(
  db: D1Database,
  teamId: string,
): Promise<PlayerRow[]> {
  const result = await db
    .prepare(`SELECT * FROM players WHERE team_id = ? ORDER BY joined_at ASC`)
    .bind(teamId)
    .all<PlayerRow>();
  return result.results ?? [];
}

export async function touchPlayer(
  db: D1Database,
  id: string,
  now?: number,
): Promise<void> {
  await db
    .prepare(`UPDATE players SET last_seen_at = ? WHERE id = ?`)
    .bind(now ?? Date.now(), id)
    .run();
}

// ---------- team_state ----------

export async function getTeamState(
  db: D1Database,
  teamId: string,
): Promise<TeamStateRow | null> {
  return await db
    .prepare(`SELECT * FROM team_state WHERE team_id = ?`)
    .bind(teamId)
    .first<TeamStateRow>();
}

export async function writeTeamState(
  db: D1Database,
  input: {
    team_id: string;
    step_kind: string;
    step_payload_json: string;
    unlocked_json: string;
    started_at: number | null;
    updated_at?: number;
  },
): Promise<TeamStateRow> {
  const updated_at = input.updated_at ?? Date.now();
  await db
    .prepare(
      `INSERT INTO team_state (team_id, step_kind, step_payload_json, unlocked_json, started_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(team_id) DO UPDATE SET
         step_kind = excluded.step_kind,
         step_payload_json = excluded.step_payload_json,
         unlocked_json = excluded.unlocked_json,
         started_at = excluded.started_at,
         updated_at = excluded.updated_at`,
    )
    .bind(
      input.team_id,
      input.step_kind,
      input.step_payload_json,
      input.unlocked_json,
      input.started_at,
      updated_at,
    )
    .run();
  return { ...input, updated_at };
}

// ---------- audit_log ----------

export async function appendAuditLog(
  db: D1Database,
  input: {
    admin_email: string;
    action: string;
    target: string;
    payload_json?: string | null;
    created_at?: number;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_log (admin_email, action, target, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      input.admin_email,
      input.action,
      input.target,
      input.payload_json ?? null,
      input.created_at ?? Date.now(),
    )
    .run();
}

export async function listAuditLog(
  db: D1Database,
  limit = 100,
): Promise<AuditLogRow[]> {
  const result = await db
    .prepare(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?`)
    .bind(limit)
    .all<AuditLogRow>();
  return result.results ?? [];
}

// ---------- chat ----------

export async function insertChatMessage(
  db: D1Database,
  input: {
    team_id: string;
    player_id: string;
    body: string;
    created_at?: number;
  },
): Promise<ChatMessageRow> {
  const created_at = input.created_at ?? Date.now();
  const row = await db
    .prepare(
      `INSERT INTO chat_messages (team_id, player_id, body, created_at)
       VALUES (?, ?, ?, ?)
       RETURNING id, team_id, player_id, body, created_at`,
    )
    .bind(input.team_id, input.player_id, input.body, created_at)
    .first<ChatMessageRow>();
  if (!row) {
    throw new Error('insertChatMessage: RETURNING produced no row');
  }
  return row;
}

export async function listRecentChat(
  db: D1Database,
  teamId: string,
  limit = 50,
): Promise<ChatMessageRow[]> {
  const result = await db
    .prepare(
      `SELECT * FROM chat_messages
       WHERE team_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .bind(teamId, limit)
    .all<ChatMessageRow>();
  return result.results ?? [];
}

export async function wipeChatForTeam(
  db: D1Database,
  teamId: string,
): Promise<number> {
  const result = await db
    .prepare(`DELETE FROM chat_messages WHERE team_id = ?`)
    .bind(teamId)
    .run();
  return result.meta?.changes ?? 0;
}

// ---------- push subscriptions ----------

export async function upsertPushSubscription(
  db: D1Database,
  input: {
    player_id: string;
    team_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  },
): Promise<PushSubscriptionRow> {
  const created_at = Date.now();
  // ON CONFLICT(endpoint): refresh the row to keep player_id/team_id current
  // (e.g. player re-binds after team move). One subscription per endpoint.
  const row = await db
    .prepare(
      `INSERT INTO push_subscriptions
         (player_id, team_id, endpoint, p256dh, auth, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         player_id = excluded.player_id,
         team_id = excluded.team_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth
       RETURNING *`,
    )
    .bind(
      input.player_id,
      input.team_id,
      input.endpoint,
      input.p256dh,
      input.auth,
      created_at,
    )
    .first<PushSubscriptionRow>();
  if (!row) {
    throw new Error('upsertPushSubscription: RETURNING produced no row');
  }
  return row;
}

export async function deletePushSubscriptionByEndpoint(
  db: D1Database,
  endpoint: string,
): Promise<number> {
  const r = await db
    .prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`)
    .bind(endpoint)
    .run();
  return r.meta?.changes ?? 0;
}

export async function listPushSubsForTeamExcludingSender(
  db: D1Database,
  teamId: string,
  excludePlayerId: string,
): Promise<PushSubscriptionRow[]> {
  const r = await db
    .prepare(
      `SELECT * FROM push_subscriptions
       WHERE team_id = ? AND player_id != ?`,
    )
    .bind(teamId, excludePlayerId)
    .all<PushSubscriptionRow>();
  return r.results ?? [];
}
