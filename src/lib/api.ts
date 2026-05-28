// Typed HTTP client for the Worker's player-facing endpoints. Every response
// is parsed by Zod so the rest of the app never sees an unverified shape.

import { z, ZodError } from 'zod';
import { HuntConfigSchema } from 'shared/config/schema';
import { HuntStateSchema } from 'shared/state/schema';

const TeamSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  hunt_id: z.string(),
});

const PlayerSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
});

const HuntSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  friend_name: z.string(),
  deadline_iso: z.string(),
  config: HuntConfigSchema,
});

export const JoinResponseSchema = z.object({
  team: TeamSummarySchema,
  player: PlayerSummarySchema,
  hunt: HuntSummarySchema,
});
export type JoinResponse = z.infer<typeof JoinResponseSchema>;

export const TeamStateResponseSchema = z.object({
  team: TeamSummarySchema,
  state: HuntStateSchema.nullable(),
});
export type TeamStateResponse = z.infer<typeof TeamStateResponseSchema>;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// VITE_API_BASE_URL points at the Worker's origin when frontend and backend
// live on different domains (e.g. *.pages.dev frontend + *.workers.dev Worker).
// Empty string ⇒ same-origin (vite dev proxy, or future Pages+Worker route
// binding on a custom domain).
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

async function fetchJson<T>(
  path: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: API_BASE ? 'include' : 'same-origin',
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new ApiError(res.status, 'bad_json', 'response was not JSON');
    }
  }
  if (!res.ok) {
    const errBody = json as
      | { error?: { code?: string; message?: string } }
      | null;
    throw new ApiError(
      res.status,
      errBody?.error?.code ?? 'unknown',
      errBody?.error?.message ?? `HTTP ${res.status}`,
    );
  }
  try {
    return schema.parse(json);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new ApiError(res.status, 'response_shape', err.message);
    }
    throw err;
  }
}

export async function joinTeam(input: {
  invite_code: string;
  player_name: string;
  client_id: string;
}): Promise<JoinResponse> {
  return fetchJson(
    '/api/teams/join',
    { method: 'POST', body: JSON.stringify(input) },
    JoinResponseSchema,
  );
}

export async function getTeamState(teamId: string): Promise<TeamStateResponse> {
  return fetchJson(
    `/api/teams/${encodeURIComponent(teamId)}`,
    { method: 'GET' },
    TeamStateResponseSchema,
  );
}

export function teamWebSocketUrl(teamId: string, playerId: string): string {
  const tid = encodeURIComponent(teamId);
  const pid = encodeURIComponent(playerId);
  if (API_BASE) {
    // Cross-origin Worker (e.g. *.workers.dev). Swap http(s) → ws(s).
    const wsBase = API_BASE.replace(/^http/, 'ws');
    return `${wsBase}/api/teams/${tid}/ws?player_id=${pid}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/api/teams/${tid}/ws?player_id=${pid}`;
}
