// Solo mode regression — preserves the v1 behaviour. The non-negotiable
// constraint in the multiplayer spec is that visiting `/` without a team
// session must render the v1 intro from src/config.ts.

import { expect, test } from '@playwright/test';
import { clearTeamSession } from './helpers';

test.describe('solo mode', () => {
  test('root URL renders the v1 intro with config from src/config.ts', async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await clearTeamSession(page);
    await page.goto('/');

    // The friend name is baked into src/config.ts as "Mihali"; the v1
    // headline interpolates it via [FRIEND_NAME] → "hey Mihali."
    await expect(page.getByText(/hey Mihali/i)).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator('.eyebrow')).toContainText('happy birthday');
    await ctx.close();
  });

  test('?test=1 shows the test badge in solo mode', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await clearTeamSession(page);
    await page.goto('/?test=1');

    await expect(page.getByText(/^TEST$/)).toBeVisible({ timeout: 5_000 });
    await ctx.close();
  });

  test('clicking let\'s go advances solo state to GpsPreface', async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await clearTeamSession(page);
    await page.goto('/');

    await page.getByRole('button', { name: /let's go/i }).click();
    await expect(
      page.getByText(/we need to know where you are/i),
    ).toBeVisible({ timeout: 5_000 });
    await ctx.close();
  });
});
