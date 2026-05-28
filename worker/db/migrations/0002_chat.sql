-- 0002_chat.sql — team chat persistence for the Social bundle (Phase 1).
-- See specs/2026-05-27-social-bundle.md §Data model.
--
-- Reactions and pings are intentionally ephemeral — broadcast-only via the
-- TeamSession Durable Object, never persisted. Only chat lands here.

CREATE TABLE chat_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id    TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id  TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- SQLite (and therefore D1) silently ignores ASC/DESC direction on index
-- columns; the planner still uses this index to satisfy
-- `ORDER BY created_at DESC` via a backwards traversal. Omit the direction
-- to avoid implying a guarantee we don't get.
CREATE INDEX idx_chat_team_created
  ON chat_messages(team_id, created_at);
