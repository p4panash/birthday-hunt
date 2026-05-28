// Public + player-facing routes for Web Push subscription management.
//
// /api/push/vapid-public-key             — public read; SW needs this to subscribe
// /api/teams/:teamId/push/subscribe      — player stores their subscription
// /api/teams/:teamId/push/unsubscribe    — player removes their subscription
//
// Player identity comes from the body (player_id). We verify the player
// belongs to the team — anyone with an invite code could in principle POST
// here, so the team_id + player_id pair is the boundary.

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import {
  deletePushSubscriptionForPlayer,
  getPlayer,
  upsertPushSubscription,
} from '../db/queries';

// SSRF defense: the Worker fetches the `endpoint` URL when fanning out
// push payloads. Restricting the host allowlist prevents an attacker who
// can subscribe (anyone with an invite + valid player_id) from making the
// Worker call arbitrary URLs (e.g. internal services, CF metadata, etc.).
//
// The hosts below cover the major push services. Add (don't replace) when
// onboarding new platforms.
const ALLOWED_PUSH_HOSTS = new Set([
  // Google Chrome / Android
  'fcm.googleapis.com',
  // Mozilla Firefox
  'updates.push.services.mozilla.com',
  // Apple Safari (iOS 16.4+ PWA push)
  'web.push.apple.com',
  // Microsoft Edge (current)
  'wns2-by3p.notify.windows.com',
  'wns2-bn3p.notify.windows.com',
  'wns2-am3p.notify.windows.com',
  'wns2-co4p.notify.windows.com',
  'wns2-db5p.notify.windows.com',
  'wns2-pn1p.notify.windows.com',
]);

function isAllowedPushEndpoint(rawUrl: string): boolean {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  return ALLOWED_PUSH_HOSTS.has(u.hostname.toLowerCase());
}

const SubscribeSchema = z.object({
  player_id: z.string().min(1),
  // client_id is the only client-bound secret. The server stores it on
  // `players.client_id` at join time, the browser keeps it in localStorage,
  // and it's NEVER exposed to other teammates (presence frames carry only
  // player_id + name). Requiring it here turns subscribe from "anyone in
  // the team can subscribe as anyone" into "you can subscribe only as
  // yourself" — without standing up a new session layer.
  client_id: z.string().min(8).max(128),
  endpoint: z
    .string()
    .url()
    .max(1024)
    .refine(isAllowedPushEndpoint, {
      message: 'endpoint host not allowlisted',
    }),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(64),
  }),
});

const UnsubscribeSchema = z.object({
  player_id: z.string().min(1),
  client_id: z.string().min(8).max(128),
  endpoint: z.string().url().max(1024),
});

const push = new Hono<{ Bindings: Env }>();

push.get('/vapid-public-key', (c) => {
  const key = c.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return c.json(
      { error: { code: 'push_unconfigured', message: 'push is not enabled' } },
      503,
    );
  }
  return c.json({ key });
});

push.post('/teams/:teamId/subscribe', async (c) => {
  const teamId = c.req.param('teamId');
  const body = SubscribeSchema.parse(await c.req.json());

  // Verify the player exists, belongs to the team, AND proves identity
  // via client_id. Returning 404 for all three failure modes avoids
  // leaking which axis failed (player exists? wrong team? wrong secret?).
  const player = await getPlayer(c.env.DB, body.player_id);
  if (
    !player ||
    player.team_id !== teamId ||
    player.client_id !== body.client_id
  ) {
    return c.json(
      { error: { code: 'not_found', message: 'player not in team' } },
      404,
    );
  }

  await upsertPushSubscription(c.env.DB, {
    player_id: body.player_id,
    team_id: teamId,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
  });
  return c.json({ ok: true });
});

push.post('/teams/:teamId/unsubscribe', async (c) => {
  const teamId = c.req.param('teamId');
  const body = UnsubscribeSchema.parse(await c.req.json());

  // Same identity proof as subscribe. The DELETE is then constrained to
  // (endpoint, player_id) so a caller can only remove their OWN
  // subscription — not somebody else's by guessing an endpoint URL.
  const player = await getPlayer(c.env.DB, body.player_id);
  if (
    !player ||
    player.team_id !== teamId ||
    player.client_id !== body.client_id
  ) {
    return c.json(
      { error: { code: 'not_found', message: 'player not in team' } },
      404,
    );
  }

  const wiped = await deletePushSubscriptionForPlayer(
    c.env.DB,
    body.player_id,
    body.endpoint,
  );
  return c.json({ ok: true, wiped });
});

export { push as pushRoutes };
