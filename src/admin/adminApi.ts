// Admin HTTP client. Browser sends Cf-Access-Jwt-Assertion automatically when
// CF Access protects /admin/* in production; in dev, ACCESS_DEV_BYPASS=true on
// the Worker makes the requests pass without a real JWT.

import { ApiError } from '../lib/api';
import type { HuntConfig } from 'shared/config/types';

interface HuntSummary {
  id: string;
  name: string;
  friend_name: string;
  deadline_iso: string;
  config: HuntConfig;
  created_at: number;
}

interface PlayerSummary {
  id: string;
  name: string;
  joined_at: number;
  last_seen_at: number;
}

interface TeamSummary {
  id: string;
  hunt_id: string;
  invite_code: string;
  name: string;
  created_at: number;
  players?: number;
  roster?: PlayerSummary[];
  step?: string;
  unlocked_count?: number;
  started_at?: number | null;
  updated_at?: number | null;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

async function adminFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;
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
  return json as T;
}

export function listHunts() {
  return adminFetch<{ hunts: HuntSummary[] }>('/api/admin/hunts');
}

export function getHunt(id: string) {
  return adminFetch<{ hunt: HuntSummary; teams: TeamSummary[] }>(
    `/api/admin/hunts/${encodeURIComponent(id)}`,
  );
}

export function createHunt(input: {
  name: string;
  friend_name: string;
  deadline_iso: string;
  config: HuntConfig;
}) {
  return adminFetch<{ hunt: HuntSummary }>('/api/admin/hunts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function patchHunt(
  id: string,
  body: Partial<{
    name: string;
    friend_name: string;
    deadline_iso: string;
    config: HuntConfig;
  }>,
) {
  return adminFetch<{ hunt: HuntSummary }>(
    `/api/admin/hunts/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  );
}

export function createTeam(huntId: string, name: string) {
  return adminFetch<{ team: TeamSummary }>(
    `/api/admin/hunts/${encodeURIComponent(huntId)}/teams`,
    {
      method: 'POST',
      body: JSON.stringify({ name }),
    },
  );
}

export function sendTeamAction(huntId: string, teamId: string, action: unknown) {
  return adminFetch<{ state: unknown }>(
    `/api/admin/hunts/${encodeURIComponent(huntId)}/teams/${encodeURIComponent(teamId)}/action`,
    {
      method: 'POST',
      body: JSON.stringify({ action }),
    },
  );
}

export type { HuntSummary, TeamSummary };
