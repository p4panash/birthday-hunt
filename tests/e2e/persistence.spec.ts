// Persistence + reconnect regression. Covers refresh behaviour and the
// optimistic "land directly on the current step" rejoin path.

import { expect, test } from '@playwright/test';
import { adminAction, joinAs, seedHuntAndTeam } from './helpers';

test.describe('persistence', () => {
  test('new player joining mid-game lands on the current team step', async ({
    browser,
    request,
  }) => {
    const { huntId, teamId, inviteCode } = await seedHuntAndTeam(request);

    // Advance team to gps-preface BEFORE anyone joins.
    await adminAction(request, huntId, teamId, { type: 'START_HUNT' });

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/join');
    await page.getByPlaceholder('ABCD1234').fill(inviteCode);
    await page.getByLabel('your name').fill('latejoin');
    await page.getByRole('button', { name: /let's go/i }).click();

    // We should land directly on the gps-preface screen, NOT intro.
    await expect(
      page.getByText(/we need to know where you are/i),
    ).toBeVisible({ timeout: 10_000 });
    await ctx.close();
  });

  test('reload after join keeps team session in localStorage', async ({
    browser,
    request,
  }) => {
    const { inviteCode } = await seedHuntAndTeam(request);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await joinAs(page, inviteCode, 'andi');

    const before = await page.evaluate(() =>
      localStorage.getItem('bday-hunt-team-session-v1'),
    );
    expect(before).not.toBeNull();

    await page.reload();

    const after = await page.evaluate(() =>
      localStorage.getItem('bday-hunt-team-session-v1'),
    );
    expect(after).toBe(before);
    await ctx.close();
  });

  test('same client_id re-binds to same player_id on rejoin', async ({
    browser,
    request,
  }) => {
    const { inviteCode } = await seedHuntAndTeam(request);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await joinAs(page, inviteCode, 'andi');

    const firstSession = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('bday-hunt-team-session-v1')!),
    );

    // Clear the session marker but KEEP the client_id (which lives under a
    // different key) — this simulates a player who cleared site data but
    // whose browser hasn't been reset.
    await page.evaluate(() => {
      localStorage.removeItem('bday-hunt-team-session-v1');
    });

    await page.goto('/join');
    await page.getByPlaceholder('ABCD1234').fill(inviteCode);
    await page.getByLabel('your name').fill('andi-again');
    await page.getByRole('button', { name: /let's go/i }).click();

    await expect(
      page.locator('.eyebrow').filter({ hasText: /happy birthday/i }),
    ).toBeVisible({ timeout: 10_000 });

    const secondSession = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('bday-hunt-team-session-v1')!),
    );
    // Re-bound to the same player row.
    expect(secondSession.player_id).toBe(firstSession.player_id);
    await ctx.close();
  });
});
