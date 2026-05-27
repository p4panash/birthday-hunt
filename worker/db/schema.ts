// TypeScript row types matching the D1 schema in ./migrations/0001_init.sql.
// These are wire-shape types (snake_case, primitives) — callers translate them
// to higher-level domain types where needed (e.g. unlocked_json → boolean[3]).

export interface HuntRow {
  id: string;
  name: string;
  friend_name: string;
  deadline_iso: string;
  config_json: string;
  created_at: number;
}

export interface TeamRow {
  id: string;
  hunt_id: string;
  invite_code: string;
  name: string;
  created_at: number;
}

export interface PlayerRow {
  id: string;
  team_id: string;
  name: string;
  client_id: string;
  joined_at: number;
  last_seen_at: number;
}

export interface TeamStateRow {
  team_id: string;
  step_kind: string;
  step_payload_json: string;
  unlocked_json: string;
  started_at: number | null;
  updated_at: number;
}

export interface AuditLogRow {
  id: number;
  admin_email: string;
  action: string;
  target: string;
  payload_json: string | null;
  created_at: number;
}

export interface ChatMessageRow {
  id: number;
  team_id: string;
  player_id: string;
  body: string;
  created_at: number;
}
