// Persisted session for team mode. After a successful join, the team + player
// ids land here. Reloading the page restores the session without going through
// the join screen again. Schema version is in the key — bump on shape changes.

const KEY = 'bday-hunt-team-session-v1';

export interface TeamSession {
  team_id: string;
  player_id: string;
}

export function loadTeamSession(): TeamSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TeamSession>;
    if (
      typeof parsed.team_id === 'string' &&
      typeof parsed.player_id === 'string'
    ) {
      return { team_id: parsed.team_id, player_id: parsed.player_id };
    }
  } catch {
    /* corrupt or unavailable — treat as no session */
  }
  return null;
}

export function saveTeamSession(session: TeamSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* swallow — we'll just have to re-join on next reload */
  }
}

export function clearTeamSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* swallow */
  }
}
