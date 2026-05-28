-- 0003_push.sql — Web Push subscriptions for the PWA notification flow.
-- See specs/2026-05-27-platform-polish.md §Data model.
--
-- One row per (player, endpoint) — a single player may install on multiple
-- devices, each with its own endpoint.

CREATE TABLE push_subscriptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id  TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id    TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_push_team ON push_subscriptions(team_id);
CREATE INDEX idx_push_player ON push_subscriptions(player_id);
