// Join screen regression. Covers the happy path (already exercised by
// cooperative.spec) plus the negative paths the UI must handle gracefully.

import { expect, test } from '@playwright/test';
import { seedHuntAndTeam } from './helpers';

test.describe('join screen', () => {
  test('rejects an unknown invite code with a friendly message', async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/join');

    await page.getByPlaceholder('ABCD1234').fill('ZZZZ9999');
    await page.getByLabel('your name').fill('ghost');
    await page.getByRole('button', { name: /let's go/i }).click();

    await expect(
      page.getByText(/no team with that code/i),
    ).toBeVisible({ timeout: 5_000 });
    await ctx.close();
  });

  test('rejects a malformed invite code (lowercase / wrong length)', async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/join');

    // The form auto-uppercases as you type, so to force a validation failure
    // we set the value through programmatic input (bypassing the
    // onChange transform) and submit.
    await page.evaluate(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('input');
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )!.set!;
      setter.call(inputs[0], 'bad');
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      setter.call(inputs[1], 'x');
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.getByRole('button', { name: /let's go/i }).click();

    await expect(
      page.getByText(/check the invite code format/i),
    ).toBeVisible({ timeout: 5_000 });
    await ctx.close();
  });

  test("disables let's go until both fields are filled", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/join');

    const submit = page.getByRole('button', { name: /let's go/i });
    await expect(submit).toBeDisabled();

    await page.getByPlaceholder('ABCD1234').fill('ABCD1234');
    await expect(submit).toBeDisabled();

    await page.getByLabel('your name').fill('andi');
    await expect(submit).toBeEnabled();
    await ctx.close();
  });

  test('/join?invite=CODE pre-fills the invite input', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/join?invite=ABCD1234');

    await expect(page.getByPlaceholder('ABCD1234')).toHaveValue('ABCD1234');
    await ctx.close();
  });

  test('/join?invite=abcd1234 auto-uppercases the pre-filled code', async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/join?invite=abcd1234');

    await expect(page.getByPlaceholder('ABCD1234')).toHaveValue('ABCD1234');
    await ctx.close();
  });

  test('valid invite + name lands in team mode', async ({
    browser,
    request,
  }) => {
    const { inviteCode } = await seedHuntAndTeam(request);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/join');

    await page.getByPlaceholder('ABCD1234').fill(inviteCode);
    await page.getByLabel('your name').fill('andi');
    await page.getByRole('button', { name: /let's go/i }).click();

    await expect(
      page.locator('.eyebrow').filter({ hasText: /happy birthday/i }),
    ).toBeVisible({ timeout: 10_000 });

    // The session should be persisted so a reload stays in team mode.
    const session = await page.evaluate(() =>
      localStorage.getItem('bday-hunt-team-session-v1'),
    );
    expect(session).not.toBeNull();
    expect(JSON.parse(session!)).toMatchObject({
      team_id: expect.any(String),
      player_id: expect.any(String),
    });
    await ctx.close();
  });
});
