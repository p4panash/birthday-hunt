-- Initial schema for birthday-hunt multiplayer backend.
-- See specs/multiplayer-backend.md §Data Model for field rationale.
--
-- Never edit this migration once shipped. Add a new 000N_*.sql instead.

CREATE TABLE hunts (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  friend_name  TEXT NOT NULL,
  deadline_iso TEXT NOT NULL,
  config_json  TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);

CREATE TABLE teams (
  id           TEXT PRIMARY KEY,
  hunt_id      TEXT NOT NULL REFERENCES hunts(id),
  invite_code  TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);

CREATE INDEX idx_teams_invite_code ON teams(invite_code);
CREATE INDEX idx_teams_hunt        ON teams(hunt_id);

CREATE TABLE players (
  id           TEXT PRIMARY KEY,
  team_id      TEXT NOT NULL REFERENCES teams(id),
  name         TEXT NOT NULL,
  client_id    TEXT NOT NULL,
  joined_at    INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE INDEX idx_players_team             ON players(team_id);
CREATE UNIQUE INDEX idx_players_team_cli  ON players(team_id, client_id);

CREATE TABLE team_state (
  team_id           TEXT PRIMARY KEY REFERENCES teams(id),
  step_kind         TEXT NOT NULL,
  step_payload_json TEXT NOT NULL,
  unlocked_json     TEXT NOT NULL,
  started_at        INTEGER,
  updated_at        INTEGER NOT NULL
);

CREATE TABLE audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_email  TEXT NOT NULL,
  action       TEXT NOT NULL,
  target       TEXT NOT NULL,
  payload_json TEXT,
  created_at   INTEGER NOT NULL
);

CREATE INDEX idx_audit_created ON audit_log(created_at DESC);
