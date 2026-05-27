// E2E for the Social bundle (Phase 1). Two-tab cooperative scenarios that
// exercise chat (P1), reactions (P2), pings (P3), and the admin chat-wipe
// flow (P1.5). Tests are tagged with the phase letter in the describe block
// so they can be filtered as features come online.

import { expect, test } from '@playwright/test';
import { clearTeamSession, joinAs, seedHuntAndTeam } from './helpers';

test.describe('Social bundle — chat (P1)', () => {
  test('two players see each other\'s messages within 2s', async ({
    browser,
    request,
  }) => {
    const seed = await seedHuntAndTeam(request);

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      await joinAs(pageA, seed.inviteCode, 'andi');
      await joinAs(pageB, seed.inviteCode, 'maria');

      // Open chat drawer in A, send a message.
      await pageA.getByTestId('chat-fab').click();
      await pageA.getByTestId('chat-input').fill('hello team');
      await pageA.getByTestId('chat-send').click();

      // B sees an unread badge appear, opens chat, sees the message.
      await expect(pageB.getByTestId('chat-unread-badge')).toBeVisible({
        timeout: 5_000,
      });
      await expect(pageB.getByTestId('chat-unread-badge')).toHaveText('1');
      await pageB.getByTestId('chat-fab').click();
      await expect(
        pageB.getByTestId('chat-list').getByText('hello team'),
      ).toBeVisible({ timeout: 2_000 });
      // Badge clears on open.
      await expect(pageB.getByTestId('chat-unread-badge')).toBeHidden();
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('chat persists across reload', async ({ browser, request }) => {
    const seed = await seedHuntAndTeam(request);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await joinAs(page, seed.inviteCode, 'andi');
      await page.getByTestId('chat-fab').click();
      await page.getByTestId('chat-input').fill('survive reload');
      await page.getByTestId('chat-send').click();
      await expect(
        page.getByTestId('chat-list').getByText('survive reload'),
      ).toBeVisible({ timeout: 2_000 });

      // Reload the page — snapshot on attach should restore.
      await page.reload();
      // After reload, drawer is closed; open it.
      await expect(page.getByTestId('chat-fab')).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('chat-fab').click();
      await expect(
        page.getByTestId('chat-list').getByText('survive reload'),
      ).toBeVisible({ timeout: 5_000 });
    } finally {
      await ctx.close();
    }
  });

  test('solo mode has no chat fab', async ({ page }) => {
    await clearTeamSession(page);
    await page.goto('/');
    // Wait for solo intro to render (eyebrow).
    await expect(page.locator('.eyebrow')).toBeVisible({ timeout: 10_000 });
    // No chat fab in solo mode.
    expect(await page.getByTestId('chat-fab').count()).toBe(0);
  });
});
