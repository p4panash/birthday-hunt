// Admin SPA regression. Covers list / create / detail / jump flows on the
// Trove-styled UI. The /admin route depends on ACCESS_DEV_BYPASS=true being
// set on the worker (the webServer in playwright.config.ts handles that).

import { expect, test } from '@playwright/test';
import { seedHuntAndTeam } from './helpers';

test.describe('admin SPA', () => {
  test('list view loads with sidebar brand', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/admin');

    await expect(page.getByText(/goodLoot admin/i)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /all hunts/i }),
    ).toBeVisible();
    await ctx.close();
  });

  test('create hunt → redirects to detail with hunt id in url', async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/admin/new');

    const name = `e2e-admin-${Date.now()}`;
    await page.locator('input.input').first().fill(name);
    await page.getByRole('button', { name: /create hunt/i }).click();

    await page.waitForURL(/\/admin\/hunts\//, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await ctx.close();
  });

  test('hunt detail page polls and displays team progress chips', async ({
    browser,
    request,
  }) => {
    const { huntId } = await seedHuntAndTeam(request);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`/admin/hunts/${huntId}`);

    // The seeded team-e2e team appears with player/step/unlocked chips.
    await expect(page.getByText(/team-e2e/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/0 players/i).first()).toBeVisible();
    await expect(page.getByText(/intro/i).first()).toBeVisible();
    await expect(page.getByText(/0\/3 unlocked/i)).toBeVisible();
    await ctx.close();
  });

  test('create team on existing hunt shows new invite code', async ({
    browser,
    request,
  }) => {
    const { huntId } = await seedHuntAndTeam(request);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`/admin/hunts/${huntId}`);

    await page.getByPlaceholder('team name').fill('team-extra');
    await page.getByRole('button', { name: /add team/i }).click();

    await expect(page.getByText('team-extra')).toBeVisible({ timeout: 5_000 });

    // Both invite codes (the seeded one + the new one) match the Crockford
    // base32 pattern.
    const codes = await page
      .locator('span.mono')
      .filter({ hasText: /^[0-9A-HJKMNP-TV-Z\s]{8,12}$/ })
      .allTextContents();
    const cleaned = codes
      .map((c) => c.replace(/\s/g, ''))
      .filter((c) => /^[0-9A-HJKMNP-TV-Z]{8}$/.test(c));
    expect(cleaned.length).toBeGreaterThanOrEqual(2);
    await ctx.close();
  });

  test('jump menu lists override actions', async ({ browser, request }) => {
    const { huntId } = await seedHuntAndTeam(request);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`/admin/hunts/${huntId}`);
    await expect(page.getByText(/team-e2e/i)).toBeVisible();

    await page.getByRole('button', { name: /^jump$/i }).click();
    await expect(page.getByRole('button', { name: /start hunt/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /reset to intro/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /jump to finale/i })).toBeVisible();
    await ctx.close();
  });
});
