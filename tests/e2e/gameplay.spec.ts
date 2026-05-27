// Full state-machine gameplay: from intro all the way through finale, in both
// solo and team mode. We sidestep real GPS by using the in-app test-mode
// drawer (solo) or admin override actions (team) to dispatch JUMP_TO_STEP /
// UNLOCK_CHECKPOINT directly.

import { expect, test, type Page } from '@playwright/test';
import {
  adminAction,
  clearTeamSession,
  joinAs,
  seedHuntAndTeam,
} from './helpers';

async function openTestDrawer(page: Page) {
  await page.getByRole('button', { name: /open test mode drawer/i }).click();
  await expect(
    page.getByRole('dialog', { name: /test mode/i }),
  ).toBeVisible();
}

async function closeTestDrawer(page: Page) {
  // The drawer doesn't auto-close on JUMP_TO_STEP — clicking the dedicated
  // close button is the most stable path.
  const closeBtn = page.getByRole('dialog', { name: /test mode/i })
    .getByRole('button', { name: /^close$/i });
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click();
  }
  await expect(
    page.getByRole('dialog', { name: /test mode/i }),
  ).not.toBeVisible();
}

async function jumpSoloTo(page: Page, label: string) {
  await openTestDrawer(page);
  await page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).click();
  // Closing the drawer guarantees the underlying screen receives clicks.
  await closeTestDrawer(page);
}

test.describe('solo gameplay (full state machine)', () => {
  test.use({
    geolocation: { latitude: 44.41, longitude: 26.11 },
    permissions: ['geolocation'],
  });

  test('test mode badge → jump from intro to each step', async ({ page }) => {
    await clearTeamSession(page);
    await page.goto('/?test=1');

    await expect(page.getByText(/hey Mihali/i)).toBeVisible();

    // Jump to gps preface
    await jumpSoloTo(page, 'gps preface');
    await expect(
      page.getByText(/we need to know where you are/i),
    ).toBeVisible({ timeout: 5_000 });

    // Jump to location 1
    await jumpSoloTo(page, 'location 1');
    // LocationActive screen — the stuck button is the most stable anchor
    await expect(page.getByRole('button', { name: /stuck/i })).toBeVisible({
      timeout: 5_000,
    });

    // Jump to finale
    await jumpSoloTo(page, 'finale');
    // Finale shows the headline from config + QR — locker info card visible
    await expect(page.getByText(/YOU ABSOLUTE LEGEND/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('stuck sheet accepts the checkpoint code', async ({ page }) => {
    await clearTeamSession(page);
    await page.goto('/?test=1');
    await jumpSoloTo(page, 'location 1');

    await page.getByRole('button', { name: /stuck/i }).click();
    // The stuck sheet has a code input — fill the canonical code from
    // src/config.ts checkpoint 0 ("OZN") and submit.
    const codeInput = page.getByRole('textbox', { name: /code/i }).or(
      page.locator('input[placeholder="----"]'),
    );
    await codeInput.fill('OZN');
    await page.getByRole('button', { name: /^unlock$/i }).click();

    // Reveal screen appears with the "GOTCHA." headline.
    await expect(page.getByText(/GOTCHA/i)).toBeVisible({ timeout: 5_000 });
  });

  test('stuck sheet rejects the wrong code (shake, no advance)', async ({
    page,
  }) => {
    await clearTeamSession(page);
    await page.goto('/?test=1');
    await jumpSoloTo(page, 'location 1');

    await page.getByRole('button', { name: /stuck/i }).click();
    const codeInput = page.getByRole('textbox', { name: /code/i }).or(
      page.locator('input[placeholder="----"]'),
    );
    await codeInput.fill('XXXX');
    await page.getByRole('button', { name: /^unlock$/i }).click();

    // Still on location screen — stuck button still visible.
    await expect(page.getByText(/GOTCHA/i)).not.toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: /stuck/i })).toBeVisible();
  });

  test('refresh persists solo progress via localStorage', async ({ page }) => {
    await clearTeamSession(page);
    await page.goto('/?test=1');
    await jumpSoloTo(page, 'location 1');
    await expect(page.getByRole('button', { name: /stuck/i })).toBeVisible();

    await page.reload();

    // After reload, still at location 1 — stuck button still there.
    await expect(page.getByRole('button', { name: /stuck/i })).toBeVisible({
      timeout: 5_000,
    });
  });
});

test.describe('team gameplay (full state machine via admin overrides)', () => {
  test('admin advances team through intro → gps-preface → finale', async ({
    browser,
    request,
  }) => {
    const { huntId, teamId, inviteCode } = await seedHuntAndTeam(request);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await joinAs(page, inviteCode, 'andi');

    // intro is the join landing — confirm.
    await expect(
      page.locator('.eyebrow').filter({ hasText: /happy birthday/i }),
    ).toBeVisible();

    // START_HUNT → gps preface
    await adminAction(request, huntId, teamId, { type: 'START_HUNT' });
    await expect(
      page.getByText(/we need to know where you are/i),
    ).toBeVisible({ timeout: 5_000 });

    // JUMP_TO_STEP finale (skipping the location/reveal animations is fine —
    // we covered those in solo gameplay)
    await adminAction(request, huntId, teamId, {
      type: 'JUMP_TO_STEP',
      step: { kind: 'finale' },
    });
    await expect(page.getByText(/YOU ABSOLUTE LEGEND/i)).toBeVisible({
      timeout: 5_000,
    });

    await ctx.close();
  });

  test('admin RESET sends team back to intro', async ({ browser, request }) => {
    const { huntId, teamId, inviteCode } = await seedHuntAndTeam(request);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await joinAs(page, inviteCode, 'andi');

    // Advance, then reset.
    await adminAction(request, huntId, teamId, { type: 'START_HUNT' });
    await expect(
      page.getByText(/we need to know where you are/i),
    ).toBeVisible({ timeout: 5_000 });

    await adminAction(request, huntId, teamId, { type: 'RESET' });
    await expect(
      page.locator('.eyebrow').filter({ hasText: /happy birthday/i }),
    ).toBeVisible({ timeout: 5_000 });

    await ctx.close();
  });

  test('admin UNLOCK_CHECKPOINT renders reveal screen', async ({
    browser,
    request,
  }) => {
    const { huntId, teamId, inviteCode } = await seedHuntAndTeam(request);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await joinAs(page, inviteCode, 'andi');

    await adminAction(request, huntId, teamId, { type: 'START_HUNT' });
    await adminAction(request, huntId, teamId, { type: 'GRANT_GPS' });
    await adminAction(request, huntId, teamId, {
      type: 'UNLOCK_CHECKPOINT',
      n: 0,
    });

    await expect(page.getByText(/GOTCHA/i)).toBeVisible({ timeout: 5_000 });
    await ctx.close();
  });
});
