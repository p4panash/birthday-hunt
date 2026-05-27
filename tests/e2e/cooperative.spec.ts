// Two-tab cooperative play e2e (Phase 2.K, CP-7).
//
// Setup: hunt + team are created via the admin API (which uses
// ACCESS_DEV_BYPASS=true locally). Then two browser contexts join the same
// team via the Join screen and we assert the state machine advances in both
// tabs whenever one of them dispatches an action.

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(ROOT, '../..');

interface CreatedHunt {
  huntId: string;
  teamId: string;
  inviteCode: string;
}

// We need a valid HuntConfig for the create-hunt API. Easiest path: load the
// solo-mode default from src/config.ts via a tiny extraction. For e2e we
// inline a minimal valid config so we don't depend on any build step.
const ck = (id: 1 | 2 | 3, code: string) => ({
  id, name: `c${id}`, teaser: 't', realHint: 'h',
  lat: 44.4 + id / 100, lng: 26.1 + id / 100,
  radiusMeters: 25, code, successCopy: 's',
});

const validConfig = {
  friendName: 'mihali',
  intro: { eyebrow: '', headline: '', body: '', cta: '', finePrint: '' },
  gpsPreface: { headline: '', body: '', allowCta: '' },
  deadlineISO: '2030-01-01T00:00:00Z',
  countdown: { eyebrow: '' },
  checkpoints: [ck(1, 'A'), ck(2, 'B'), ck(3, 'C')],
  warmthStatuses: { veryFar: '', far: '', close: '', onTop: '' },
  stuckSheet: {
    title: '', realHintIntro: '', codeLabel: '', codePlaceholder: '',
    unlockCta: '', closeCta: '',
  },
  reveal: { headline: '', nextCta: '', finaleCta: '' },
  finale: {
    headline: '', subheadline: '', lockerHintLabel: '',
    instruction: '', qrBrightnessTip: '', openLockerMapLabel: '',
  },
  easyboxLocation: {
    name: 'box', hint: 'h', mapsUrl: 'https://maps.example.com/x',
  },
  errors: { wrongCode: '', gpsDenied: '', gpsFlaky: '' },
  photos: [],
  sound: { unlockSrc: '', finaleSrc: '' },
};

async function seedHuntAndTeam(api: APIRequestContext): Promise<CreatedHunt> {
  const huntRes = await api.post('http://localhost:8787/api/admin/hunts', {
    data: {
      name: `e2e-${Date.now()}`,
      friend_name: 'mihali',
      deadline_iso: '2030-01-01T00:00:00Z',
      config: validConfig,
    },
  });
  expect(huntRes.status()).toBe(201);
  const { hunt } = await huntRes.json();

  const teamRes = await api.post(
    `http://localhost:8787/api/admin/hunts/${hunt.id}/teams`,
    { data: { name: `team-e2e` } },
  );
  expect(teamRes.status()).toBe(201);
  const { team } = await teamRes.json();

  return { huntId: hunt.id, teamId: team.id, inviteCode: team.invite_code };
}

async function joinAs(page: Page, inviteCode: string, name: string) {
  await page.goto('/join');
  await page.getByPlaceholder('ABCD1234').fill(inviteCode);
  await page.getByLabel('your name').fill(name);
  await page.getByRole('button', { name: /let's go/i }).click();
  // After join, we land on the team-mode intro screen. The intro screen
  // is uniquely identifiable by its eyebrow text — the join screen has
  // "got a code?" instead.
  await expect(page.locator('.eyebrow').filter({ hasText: /happy birthday/i })).toBeVisible({
    timeout: 10_000,
  });
}

test.describe('cooperative play', () => {
  test('two tabs see the same state machine progression', async ({
    browser,
    request,
  }) => {
    const { inviteCode } = await seedHuntAndTeam(request);

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await joinAs(pageA, inviteCode, 'andi');
    await joinAs(pageB, inviteCode, 'bogdan');

    // Both tabs are on intro. Trigger START_HUNT from A via the "let's go" CTA.
    await pageA.getByRole('button', { name: /let's go/i }).click();

    // Both should advance to GpsPreface, identifiable by its serif headline.
    const gpsHeadline = /we need to know where you are/i;
    await expect(pageA.getByText(gpsHeadline)).toBeVisible({ timeout: 5_000 });
    await expect(pageB.getByText(gpsHeadline)).toBeVisible({ timeout: 5_000 });

    await ctxA.close();
    await ctxB.close();
  });

  test('refreshing a tab restores the team session', async ({
    browser,
    request,
  }) => {
    const { inviteCode } = await seedHuntAndTeam(request);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await joinAs(page, inviteCode, 'andi');

    await page.reload();

    // Without re-entering the code, we should still land in team mode — same
    // intro screen, identifiable by its eyebrow.
    await expect(
      page.locator('.eyebrow').filter({ hasText: /happy birthday/i }),
    ).toBeVisible({ timeout: 10_000 });
    await ctx.close();
  });
});

// Read this file at runtime if you need to debug what the seed payload looks
// like — leaving the import here so node resolves it without complaint.
void readFileSync;
void REPO;
