// Cooperative multiplayer e2e (Phase 2.K CP-7). Two browser contexts join the
// same team and we verify the state machine + presence + admin overrides
// propagate end-to-end.

import { expect, test } from '@playwright/test';
import { adminAction, joinAs, seedHuntAndTeam } from './helpers';

test.describe('cooperative play', () => {
  test('two tabs join the same team and start hunt together', async ({
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

    // Tab A starts the hunt. Both tabs should advance to GpsPreface.
    await pageA.getByRole('button', { name: /let's go/i }).click();

    const gpsHeadline = /we need to know where you are/i;
    await expect(pageA.getByText(gpsHeadline)).toBeVisible({ timeout: 5_000 });
    await expect(pageB.getByText(gpsHeadline)).toBeVisible({ timeout: 5_000 });

    await ctxA.close();
    await ctxB.close();
  });

  test('refreshing the page restores the team session', async ({
    browser,
    request,
  }) => {
    const { inviteCode } = await seedHuntAndTeam(request);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await joinAs(page, inviteCode, 'andi');

    await page.reload();

    await expect(
      page.locator('.eyebrow').filter({ hasText: /happy birthday/i }),
    ).toBeVisible({ timeout: 10_000 });
    await ctx.close();
  });

  test('admin jump-to-step pushes new state to the player', async ({
    browser,
    request,
  }) => {
    const { huntId, teamId, inviteCode } = await seedHuntAndTeam(request);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await joinAs(page, inviteCode, 'andi');

    // Admin pushes START_HUNT via the override endpoint. The player's WebSocket
    // should receive the new state and the screen should advance to GpsPreface
    // without the player clicking anything.
    await adminAction(request, huntId, teamId, { type: 'START_HUNT' });

    await expect(
      page.getByText(/we need to know where you are/i),
    ).toBeVisible({ timeout: 5_000 });
    await ctx.close();
  });

  test('presence ribbon shows teammates with WebSocket health dot', async ({
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

    // Tab A should eventually show that another teammate joined.
    await expect(pageA.getByText(/\+ \d* ?(teammate|bogdan)/i)).toBeVisible({
      timeout: 6_000,
    });

    await ctxA.close();
    await ctxB.close();
  });
});
