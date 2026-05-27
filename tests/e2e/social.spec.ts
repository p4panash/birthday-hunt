// E2E for the Social bundle (Phase 1). Two-tab cooperative scenarios that
// exercise chat (P1), reactions (P2), pings (P3), and the admin chat-wipe
// flow (P1.5). Tests are tagged with the phase letter in the describe block
// so they can be filtered as features come online.

import { expect, test } from '@playwright/test';
import {
  adminAction,
  clearTeamSession,
  joinAs,
  seedHuntAndTeam,
} from './helpers';

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

test.describe('Social bundle — reactions (P2)', () => {
  test('tapping an emoji broadcasts to teammates and floats on their screen', async ({
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

      // Sanity: B's reaction layer present (no reactions yet).
      await expect(pageB.getByTestId('reaction-layer')).toBeAttached();

      // A taps the 🎉 emoji.
      await pageA.getByTestId('reaction-🎉').click();

      // B sees at least one floating-reaction with that emoji within 2s.
      await expect(
        pageB.locator('[data-testid="floating-reaction"][data-emoji="🎉"]'),
      ).toBeVisible({ timeout: 2_000 });
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('solo mode has no reaction tray', async ({ page }) => {
    await clearTeamSession(page);
    await page.goto('/');
    await expect(page.locator('.eyebrow')).toBeVisible({ timeout: 10_000 });
    expect(await page.getByTestId('reaction-tray').count()).toBe(0);
  });
});

test.describe('Social bundle — map + pings (P3)', () => {
  test.use({
    geolocation: { latitude: 44.41, longitude: 26.11 },
    permissions: ['geolocation'],
  });

  test('player tap on map broadcasts a ping to teammate', async ({
    browser,
    request,
  }) => {
    const seed = await seedHuntAndTeam(request);

    const ctxA = await browser.newContext({
      geolocation: { latitude: 44.41, longitude: 26.11 },
      permissions: ['geolocation'],
    });
    const ctxB = await browser.newContext({
      geolocation: { latitude: 44.41, longitude: 26.11 },
      permissions: ['geolocation'],
    });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    try {
      await joinAs(pageA, seed.inviteCode, 'andi');
      await joinAs(pageB, seed.inviteCode, 'maria');

      // Admin jumps the team to location 1 so the map mounts.
      await adminAction(request, seed.huntId, seed.teamId, {
        type: 'JUMP_TO_STEP',
        step: { kind: 'location', n: 0 },
      });

      // Both players see the team-map container.
      await expect(pageA.getByTestId('team-map')).toBeVisible({
        timeout: 5_000,
      });
      await expect(pageB.getByTestId('team-map')).toBeVisible({
        timeout: 5_000,
      });

      // A taps the center of the map → local echo + WS broadcast.
      const aMap = pageA.getByTestId('team-map');
      const aBox = await aMap.boundingBox();
      expect(aBox).toBeTruthy();
      // Click slightly off-center to avoid hitting a marker on top of self.
      await pageA.mouse.click(
        aBox!.x + aBox!.width * 0.7,
        aBox!.y + aBox!.height * 0.3,
      );

      // B should see a ping marker (yellow pulse) appear on its map.
      await expect(
        pageB.locator('.bday-ping-marker').first(),
      ).toBeVisible({ timeout: 3_000 });
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('solo mode has no team-map', async ({ page }) => {
    await clearTeamSession(page);
    await page.goto('/');
    await expect(page.locator('.eyebrow')).toBeVisible({ timeout: 10_000 });
    expect(await page.getByTestId('team-map').count()).toBe(0);
  });
});

test.describe('Social bundle — admin wipe (P1.5)', () => {
  test('admin wipe clears both players\' drawers and writes audit log', async ({
    browser,
    request,
  }) => {
    const seed = await seedHuntAndTeam(request);

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const ctxAdmin = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    const pageAdmin = await ctxAdmin.newPage();

    try {
      await joinAs(pageA, seed.inviteCode, 'andi');
      await joinAs(pageB, seed.inviteCode, 'maria');

      // Each sends one message.
      await pageA.getByTestId('chat-fab').click();
      await pageA.getByTestId('chat-input').fill('hi from andi');
      await pageA.getByTestId('chat-send').click();

      await pageB.getByTestId('chat-fab').click();
      await pageB.getByTestId('chat-input').fill('hi from maria');
      await pageB.getByTestId('chat-send').click();

      // Both see both messages.
      await expect(
        pageA.getByTestId('chat-list').getByText('hi from maria'),
      ).toBeVisible({ timeout: 3_000 });
      await expect(
        pageB.getByTestId('chat-list').getByText('hi from andi'),
      ).toBeVisible({ timeout: 3_000 });

      // Admin opens hunt detail and clicks "wipe chat" (with confirm).
      await pageAdmin.goto(`/admin/hunts/${seed.huntId}`);
      pageAdmin.once('dialog', (d) => d.accept());
      await pageAdmin.getByTestId(`wipe-chat-${seed.teamId}`).click();

      // Both player tabs see chat empty within a couple seconds.
      const empty = 'No messages yet';
      await expect(pageA.getByText(empty)).toBeVisible({ timeout: 3_000 });
      await expect(pageB.getByText(empty)).toBeVisible({ timeout: 3_000 });

      // Audit log endpoint shows the chat.wipe row.
      const audit = await request.get(
        'http://localhost:8787/api/admin/audit_log?limit=10',
      );
      const body = (await audit.json()) as {
        entries: { action: string; target: string }[];
      };
      const wipeEntry = body.entries.find(
        (e) => e.action === 'chat.wipe' && e.target === seed.teamId,
      );
      expect(wipeEntry, 'audit log entry for chat.wipe').toBeTruthy();
    } finally {
      await ctxA.close();
      await ctxB.close();
      await ctxAdmin.close();
    }
  });
});
