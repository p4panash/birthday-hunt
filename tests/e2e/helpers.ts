// Shared helpers for the Playwright regression suite. Every spec imports
// from here so seed shapes and join semantics stay consistent.

import { expect, type APIRequestContext, type Page } from '@playwright/test';

export interface SeededHunt {
  huntId: string;
  teamId: string;
  inviteCode: string;
}

const checkpoint = (id: 1 | 2 | 3, code: string) => ({
  id,
  name: `c${id}`,
  teaser: 't',
  realHint: 'h',
  lat: 44.4 + id / 100,
  lng: 26.1 + id / 100,
  radiusMeters: 25,
  code,
  successCopy: 's',
});

/** Minimum valid HuntConfig that satisfies the Zod schema. */
export const validConfig = {
  friendName: 'test-friend',
  intro: {
    eyebrow: 'happy birthday!',
    headline: 'hey [FRIEND_NAME].',
    body: 'go.',
    cta: "let's go →",
    finePrint: '',
  },
  gpsPreface: {
    headline: 'we need to know where you are.',
    body: 'gps please.',
    allowCta: 'allow location',
  },
  deadlineISO: '2030-01-01T00:00:00Z',
  countdown: { eyebrow: 'tick tock.' },
  checkpoints: [checkpoint(1, 'A'), checkpoint(2, 'B'), checkpoint(3, 'C')],
  warmthStatuses: { veryFar: '', far: '', close: '', onTop: '' },
  stuckSheet: {
    title: 'stuck?',
    realHintIntro: '',
    codeLabel: '',
    codePlaceholder: '',
    unlockCta: 'unlock',
    closeCta: 'close',
  },
  reveal: { headline: 'GOTCHA.', nextCta: 'next →', finaleCta: 'finale →' },
  finale: {
    headline: 'LEGEND.',
    subheadline: '',
    lockerHintLabel: '',
    instruction: '',
    qrBrightnessTip: '',
    openLockerMapLabel: '',
  },
  easyboxLocation: {
    name: 'box',
    hint: '',
    mapsUrl: 'https://maps.example.com/x',
  },
  errors: { wrongCode: '', gpsDenied: '', gpsFlaky: '' },
  photos: [],
  sound: { unlockSrc: '', finaleSrc: '' },
};

/**
 * Create a fresh hunt + team via the admin API (ACCESS_DEV_BYPASS=true allows
 * unauthenticated admin calls in the e2e environment). Returns identifiers
 * for further test setup.
 */
export async function seedHuntAndTeam(
  api: APIRequestContext,
  opts: { name?: string; deadline?: string } = {},
): Promise<SeededHunt> {
  const name = opts.name ?? `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const huntRes = await api.post('http://localhost:8787/api/admin/hunts', {
    data: {
      name,
      friend_name: 'test-friend',
      deadline_iso: opts.deadline ?? '2030-01-01T00:00:00Z',
      config: validConfig,
    },
  });
  expect(huntRes.status(), `create hunt: ${await huntRes.text()}`).toBe(201);
  const { hunt } = (await huntRes.json()) as { hunt: { id: string } };

  const teamRes = await api.post(
    `http://localhost:8787/api/admin/hunts/${hunt.id}/teams`,
    { data: { name: 'team-e2e' } },
  );
  expect(teamRes.status()).toBe(201);
  const { team } = (await teamRes.json()) as {
    team: { id: string; invite_code: string };
  };

  return { huntId: hunt.id, teamId: team.id, inviteCode: team.invite_code };
}

/** Dispatch an admin override action on a team (RESET, START_HUNT, etc.). */
export async function adminAction(
  api: APIRequestContext,
  huntId: string,
  teamId: string,
  action: unknown,
): Promise<void> {
  const res = await api.post(
    `http://localhost:8787/api/admin/hunts/${huntId}/teams/${teamId}/action`,
    { data: { action } },
  );
  expect(res.status(), `admin action: ${await res.text()}`).toBe(200);
}

/**
 * Drive the Join screen as a player. Asserts we land on the team-mode intro,
 * recognisable by the .eyebrow text.
 */
export async function joinAs(
  page: Page,
  inviteCode: string,
  name: string,
): Promise<void> {
  await page.goto('/join');
  await page.getByPlaceholder('ABCD1234').fill(inviteCode);
  await page.getByLabel('your name').fill(name);
  await page.getByRole('button', { name: /let's go/i }).click();
  await expect(
    page.locator('.eyebrow').filter({ hasText: /happy birthday/i }),
  ).toBeVisible({ timeout: 10_000 });
}

/** Strip any persisted team session so the next page load lands in solo mode. */
export async function clearTeamSession(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('bday-hunt-team-session-v1');
  });
}
