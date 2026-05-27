# Plan: Phase 2 Platform Polish — implementation plan

> **Spec:** `specs/2026-05-27-platform-polish.md`

## Dependency graph

Four vertical phases. Each ships independently, each is e2e-testable
on its own.

```
P0. Foundation
    • vite-plugin-pwa wired into vite.config.ts
    • manifest.webmanifest generated
    • static icons placed under public/icons/
    • brand cleanup in index.html + admin header
        ↓
P1. Service worker + offline shell
    • SW pre-caches static assets
    • /api/* network-first with offline fallback
    • registerSw helper + updatefound toast
        ↓
P2. Install prompt
    • beforeinstallprompt handler (Android/Chromium)
    • iOS Add-to-Home-Screen instructions card
    • 7-day suppression flag in localStorage
        ↓
P3. Web Push
    • D1 migration 0003_push.sql
    • Worker: GET vapid-public-key, POST subscribe/unsubscribe
    • TeamSession.handleChatSend forks: ws broadcast + push fan-out
    • Frontend: notifications opt-in pill + subscribe flow
    • SW push event handler renders OS notification
        ↓
P4. Verify + ship
    • npm run verify + Lighthouse PWA score check
    • Real-device install + push smoke (Android + iOS)
    • Deploy Worker + Pages with VAPID secrets set
```

## Per-phase contracts

### P0 — Foundation (~2 h)

**Exit conditions:**
- `vite-plugin-pwa` installed and configured for `generateSW`.
- `public/icons/` holds the 4 PNG icons (192, 512, maskable-512,
  apple-touch).
- `public/manifest.webmanifest` (or generated equivalent) declares
  `name`, `short_name`, `theme_color`, `background_color`,
  `display: standalone`, scope `/`, start_url `/`, the 4 icons.
- `index.html` title → "goodLoot — Cooperative Treasure Hunts",
  OG meta tags use generic copy, includes the apple-touch-icon
  link tag.
- `src/admin/AdminApp.tsx` header changed.
- `npm run build` produces a valid manifest under `dist/`.
- `npm run verify` still green.

### P1 — Service worker + offline shell (~3 h)

**Exit conditions:**
- `vite-plugin-pwa` generates `sw.js` at `dist/sw.js`.
- Pre-cached: index.html, main JS, main CSS, manifest, icons,
  fonts, the TeamMap lazy chunk.
- Runtime cache `stale-while-revalidate` for `/assets/**`.
- `/api/*` requests use `NetworkFirst` with a synthetic
  503 response when offline. Frontend's `api.ts` interprets a
  non-OK response with `x-pwa-offline: 1` and surfaces a banner.
- `src/main.tsx` calls `registerSw()` after first paint.
- `src/pwa/registerSw.ts` registers, listens for `updatefound`,
  and shows a "new version available" toast that triggers
  `skipWaiting` on click.
- Manual smoke: load app, kill network, reload → app shell
  appears with an offline banner.

### P2 — Install prompt (~1.5 h)

**Exit conditions:**
- `src/pwa/InstallPrompt.tsx` listens for `beforeinstallprompt`,
  stashes the event, renders a dismissable card after first paint.
- On `Install` click → calls `event.prompt()`, then
  awaits `userChoice`, then dismisses.
- On `Not now` → writes `pwa-install-suppress-until` to
  localStorage with `Date.now() + 7d`.
- iOS detection (UA-based, conservative — only "iPhone | iPad" +
  Safari + not standalone): renders a different card with
  "Share → Add to Home Screen" instructions.
- Mounted from `App.tsx` so it's available in any mode.

### P3 — Web Push (~6 h)

The largest slice; broken into sub-steps:

P3.a. **VAPID keys generated** locally (`npx web-push generate-vapid-keys`),
stored as `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT`
wrangler secrets in dev (`worker/.dev.vars`) and via `wrangler
secret put` in prod.

P3.b. **D1 migration**: `worker/db/migrations/0003_push.sql` with
`push_subscriptions` table per spec. Apply locally + remote.

P3.c. **Worker push library**: `worker/lib/push.ts` — wraps
`@negrel/webpush` (or hand-rolled VAPID signing if a tiny lib is
preferable) with a typed `sendPush(subscription, payload)` that
returns `{ ok, gone }`.

P3.d. **Worker routes**: `worker/routes/push.ts` with
`GET /api/push/vapid-public-key`, `POST /api/teams/:teamId/push/
subscribe`, `POST /api/teams/:teamId/push/unsubscribe`. Tests under
`tests/worker/push-subscribe.test.ts`.

P3.e. **DO chat handler fork**: after broadcasting `chat_new`, kick
off a background `sendChatPush(teamId, senderPlayerId, payload)`.
List subscriptions for the team excluding the sender, `Promise.
allSettled` on the push deliveries, delete subscriptions that
returned 410-Gone. Test: `tests/worker/push-dispatch.test.ts` —
verify the dispatch runs and that 410 cleans up.

P3.f. **Frontend push subscription helper**: `src/pwa/usePush.ts`
returns `{ enabled, supported, enable(), disable() }`. Calls
`navigator.serviceWorker.ready.pushManager.subscribe(...)` with
the VAPID public key fetched from the Worker.

P3.g. **UI affordance**: small pill near the chat fab — "Enable
notifications" when not subscribed, "Notifications on" when
subscribed (tap opens a confirm to disable).

P3.h. **SW push handler**: `src/sw.ts` exports a custom event
handler for `push` and `notificationclick` (the latter routes
back to the team URL).

**Exit conditions:**
- Worker tests added under push-* pass.
- Real Android device: install PWA, subscribe, send chat from another
  device → notification appears.

### P4 — Verify + ship (~2 h)

**Exit conditions:**
- `npm run verify` green.
- Lighthouse "PWA" audit passes (`installable`, `service worker`,
  `theme color`, `icons`).
- Code-reviewer subagent on full P0–P3 diff (cumulative).
- Security-auditor subagent on the push routes + VAPID handling.
- Deploy: `db:migrate:remote`, wrangler secrets for VAPID, worker
  deploy, pages deploy. Smoke install on iPhone + Android.

## Estimated total effort

~14.5 h; about 2 working days at the same TDD-first sustainable
pace as Phase 1.

## Known risks and mitigations

1. **iOS Safari push** is an active moving target. iOS 16.4+
   ships it for installed PWAs only. We surface install
   instructions instead of pretending we can push without
   install. If our user base is iOS-heavy, push UX is degraded
   until they install — known and accepted.
2. **Push endpoints rotate.** Mozilla and Apple endpoint URLs
   sometimes change subdomains; our `endpoint` field is opaque
   storage, no parsing. Handled.
3. **VAPID key rotation** is a manual operation that invalidates
   all subscriptions. Document the procedure in `DEPLOY.md`. Not
   automated — out of scope.
4. **OSM tile rate limits** can still bite on mobile if a popular
   PWA install spikes adoption. We deferred a tile CDN in Phase 1;
   re-evaluate when DAU > 500.
5. **Service worker cache invalidation** is famously dangerous.
   `vite-plugin-pwa` handles asset hashing and `skipWaiting`, but
   a bad SW shipping with a permanent bug could lock users on a
   broken version. Mitigation: every SW build includes a
   `clients.claim()` only after `skipWaiting`, and the
   updatefound toast gives users a manual escape hatch.

## Open decisions (NONE)

Plan is concrete enough to start implementation upon approval.
