# Spec: Platform Polish (Phase 2 of goodLoot multi-phase roadmap)

> **Status:** Draft 2026-05-27. Pending user approval.
> **Predecessor:** `specs/2026-05-27-social-bundle.md` (shipped on
> `feat/goodloot`, 13 commits, live on `hunt.use-adonis.com`).
> **Successor planned:** Native Wrap & Store Launch (Capacitor + App
> Store/Play Store).

## Objective

Turn the in-browser experience into something a user would recognise
as "an app you'd download from a store" — without writing any native
code yet. Two strands of work:

1. **PWA shell** — installable from the browser (Add to Home Screen),
   fullscreen launch, branded icon + splash, offline shell that boots
   even with no network, Web Push notifications on Android (iOS PWA
   push works for installed PWAs on iOS 16.4+).
2. **Brand cleanup** — strip "Mihali" / "birthday-hunt" from chrome
   that the store listing and PWA install prompt will surface. The
   recipient's name comes from the active hunt's config; only the
   solo-mode demo hunt keeps Mihali as its content.

Phase 2 is *intentionally* not the full multi-tenant lobby rewrite
(public hunt browser, QR scan landing, "create your own hunt" flow).
Those are valuable but each their own design problem. Phase 2 ships
the smallest set of changes that makes goodLoot installable, brand-
coherent in the store listing surface, and ready to wrap with
Capacitor in Phase 3.

### Why this matters

The user's expectation, articulated during brainstorming on
2026-05-27: "cei care joaca jocul sau sunt cautatori o sa descarce
un app pentru a folosii aceasta parte a sistemului" — players
download an app to play. PWA install gives 80% of that
experience instantly (icon on home screen, fullscreen, no
browser chrome) and is fully reversible. Capacitor (Phase 3)
gets the App Store badge of legitimacy; PWA gets the experience
right first.

### Users and roles

Unchanged from Phase 1. The PWA install affordance shows up for
both players (after they join a hunt) and admins (when they hit
`/admin`).

### Success criteria

- **Installable** — On Android Chrome and iOS Safari 16.4+, a
  `beforeinstallprompt` event fires; players see an "Install
  goodLoot" affordance at least once. After install, launching from
  the home screen opens in fullscreen with the goodLoot icon and
  splash.
- **Offline shell** — Killing the network on a previously-loaded
  device, then reopening from the home screen icon, renders the
  empty shell (intro screen frame) within 1 second, with a banner
  "you're offline — reconnect to continue your hunt." No white
  screen.
- **Branded chrome** — Browser tab title is "goodLoot" (not
  "Birthday Hunt"). Share-preview (Open Graph + Twitter card) reads
  "goodLoot — co-op treasure hunts" with a generic OG image. Admin
  header says "goodLoot Admin", not "birthday-hunt admin". The PWA
  manifest's `name` is "goodLoot", `short_name` is "goodLoot".
- **Web Push (Android)** — A player who has installed the PWA can
  opt in to push notifications. When a teammate sends a chat
  message and the recipient's PWA is backgrounded, an OS-level
  notification surfaces with the sender name + message preview.
- **Solo-mode demo retained** — Loading `/` with no invite still
  shows Mihali's hunt (it's our showcase content). Loading
  `/?hunt=<id>` loads a different solo hunt config when we have
  more. Loading `/join?invite=<code>` works as before.
- **Phase 1 regression-free** — Chat, reactions, map+pings all
  still work. The Playwright social.spec must pass unmodified.

### Non-goals (explicit)

- **No public hunt browser / lobby.** The home page stays the same;
  invite codes remain the primary way into a real hunt.
- **No "create your own hunt" self-service.** Hunt creation stays
  admin-only via `/admin`.
- **No removal of solo mode.** The Mihali demo hunt remains as the
  default. We're just rebranding the chrome around it.
- **No iOS push without PWA install.** iOS only supports Web Push
  via installed PWAs (16.4+). We surface the install prompt; users
  who decline don't get push.
- **No background GPS.** Out of scope; Phase 3 (Capacitor) is
  where native background tasks would belong if needed.
- **No payments / billing / accounts.** goodLoot stays anonymous-
  invite-code based.
- **No tile-server upgrade.** OSM tiles continue (Phase 1 risk #3).

---

## Architecture

### PWA shell

Three new artifacts under the SPA:

```
public/
  manifest.webmanifest        ← name, icons, theme, display=standalone
  icons/icon-192.png          ← Android home-screen
  icons/icon-512.png          ← splash / install dialog
  icons/icon-maskable-512.png ← Android adaptive icon
  icons/apple-touch-icon.png  ← iOS home-screen
src/
  sw.ts                       ← Service Worker source
  pwa/registerSw.ts            ← Registration helper, called from main.tsx
  pwa/InstallPrompt.tsx        ← One-time install affordance
```

Service worker strategy:

- **Pre-cache**: index.html + main JS chunk + main CSS + manifest +
  icons + Leaflet lazy chunk + fonts.
- **Runtime cache** (`stale-while-revalidate`): everything under
  `assets/`.
- **Network-first**: every `/api/*` request — fall back to a
  synthetic offline response so the React side renders a friendly
  banner instead of throwing.
- **No caching** of WebSocket upgrades or `/admin` (so admin
  changes are always live).

Generated via `vite-plugin-pwa` configured for `generateSW` with a
small custom hook for the offline-fallback shape. The plugin
handles cache busting, asset hashing, and SW lifecycle events.

### Web Push

Workers AI / Cloudflare PSK isn't necessary — the standard W3C
Push API + VAPID keys + the Worker as the push endpoint is enough:

```
Player                    Worker (Hono)             Push service
─────                     ─────────────             ────────────
PWA installs
  │
  └─ requests notification permission
  └─ subscribes to Push Manager with VAPID public key
  └─ POST /api/teams/:teamId/push/subscribe
       { endpoint, keys: { p256dh, auth } }
                          │
                          └─ stores subscription in
                             new D1 table push_subscriptions

Teammate sends chat       Worker chat handler
                          │
                          └─ broadcasts WS chat_new (existing)
                          └─ ALSO: for each subscription whose
                             player_id != sender, POST to
                             subscription.endpoint with VAPID-
                             signed payload "{sender_name}: {body}"
                                                    │
                                                    └─ Push service
                                                       delivers OS
                                                       notification
                                                       to device
```

Two D1 tables:

```sql
CREATE TABLE push_subscriptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id  TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id    TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_push_team ON push_subscriptions(team_id);
```

VAPID keys: generated once via `web-push` CLI, stored as wrangler
secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, plus a
`VAPID_CONTACT` email.

Push payload size is capped at ~4 KB. We send `{title:
sender_name, body: truncated 100 chars, tag: team_id, url:
/team-hunt}`.

### Brand cleanup

Minimal touch surface:

- `index.html` — title "goodLoot — Cooperative Treasure Hunts",
  OG meta tags rewritten generically. New OG image (placeholder
  for now; designed asset can ship in a follow-up).
- `src/admin/AdminApp.tsx` — sidebar header "goodLoot Admin"; the
  slug placeholder example becomes generic.
- `manifest.webmanifest` — `name: "goodLoot"`, `short_name:
  "goodLoot"`, `description: "Cooperative GPS treasure hunts for
  any occasion"`, `theme_color: "#1F1430"`, `background_color:
  "#1F1430"`.
- `package.json` `name` field stays `birthday-hunt` (internal,
  matches the GitHub repo) — only user-facing strings change.

---

## Data model (D1)

One new migration `0003_push.sql` for the `push_subscriptions`
table above. No modifications to existing tables.

---

## Worker API additions

```
POST /api/teams/:teamId/push/subscribe
  body: { player_id, endpoint, keys: { p256dh, auth } }
  → 200 { ok: true }
  → 400 if shape invalid
  → 404 if player not in team

POST /api/teams/:teamId/push/unsubscribe
  body: { endpoint }
  → 200 { ok: true }

GET /api/push/vapid-public-key
  → 200 { key: <base64url> }
  (cached public response, no auth)
```

No new admin endpoints — admins don't manage subscriptions.

The chat broadcast path in `worker/do/TeamSession.ts` is extended:
after broadcasting `chat_new` over WS, it spawns a fire-and-forget
`Promise.all` to POST the push payload to every subscription's
endpoint (excluding the sender's own subs).

VAPID signing uses the `@negrel/webpush` (lightweight, no Node-
crypto deps) library; it's Workers-compatible.

---

## Frontend changes

### PWA registration

`src/main.tsx` calls `registerSw()` after first paint. The helper
returns the registration plus an event-emitter for `updatefound`,
which the app uses to show a "new version available — refresh"
toast.

### Install prompt component

`src/pwa/InstallPrompt.tsx` — invisible until `beforeinstallprompt`
fires. On fire, it surfaces a one-time toast: "Install goodLoot
for home-screen access and push notifications." Two buttons:
"Install" (calls `event.prompt()`) and "Not now" (dismisses,
localStorage flag suppresses for 7 days).

On iOS Safari (where `beforeinstallprompt` doesn't fire), a
separate detection path shows a manual instructions card
("Tap the share button → Add to Home Screen") on first visit
from a non-installed iOS device. Same suppress-for-7-days behaviour.

### Push subscription UI

Player Mode adds a small "Enable notifications" pill near the
chat fab. Tap → request permission → if granted, subscribe to
Push Manager + POST to Worker. The pill disappears once subscribed.
A second tap on the same pill (renamed "Notifications on") opens
a confirmation dialog to unsubscribe.

State: a single boolean `pushEnabled` derived from
`navigator.serviceWorker.ready.pushManager.getSubscription()`.

### Branding

- Sidebar/header copy changes already enumerated above.
- A new `<link rel="manifest" href="/manifest.webmanifest">` in
  `index.html`.
- Apple-specific `<link rel="apple-touch-icon">` + meta tags for
  status bar style + capable=yes.

---

## Dependencies

Two new runtime additions:

```
vite-plugin-pwa@^0.20         // build-time SW + manifest generation
@negrel/webpush@^1            // VAPID signing in the Worker
workbox-window@^7              // SW registration client-side helper (peer of vite-plugin-pwa)
```

PWA tooling is mature; no exotic versions. `@negrel/webpush` is
Workers-runtime-only (no Node `crypto` shim needed).

Total expected bundle delta: ~10 KB gz to main from
`workbox-window` + the install/push UI. Service worker itself
runs separately and doesn't impact the page load budget.

---

## Testing strategy

### Worker tests (vitest + Miniflare D1)

- `tests/worker/push-subscribe.test.ts`:
  - happy subscribe + unsubscribe; idempotent re-subscribe;
    unknown player → 404; malformed keys → 400.
- `tests/worker/push-dispatch.test.ts`:
  - chat send broadcasts WS AND queues push to all other
    subscriptions; sender excluded.
  - Worker handles 410-Gone from a push endpoint by deleting that
    subscription (standard PSV behaviour).
- `tests/worker/vapid-key.test.ts`:
  - public endpoint returns the public key; no auth required.

### Frontend integration

- `src/pwa/registerSw.test.ts` (vitest, jsdom): registration
  fires, idempotent on second call.
- Manual smoke: install on a real Android device, verify icon +
  splash + push.

### E2E (Playwright)

`tests/e2e/pwa.spec.ts` (new):
- After build, manifest.webmanifest is served and has the right
  `name`/`short_name`/`theme_color`.
- Service worker file is served with `Content-Type:
  application/javascript`.
- The install affordance renders when the browser supports
  `beforeinstallprompt` (Chromium).
- Regression: hunt.use-adonis.com homepage still shows the solo
  intro (Mihali demo) when no invite is set.

---

## Acceptance checklist (Phase 2 exit gate)

- [ ] `npm run verify` passes.
- [ ] Lighthouse PWA score ≥ 90 on production.
- [ ] Manual install on a real Android device → icon + splash +
      fullscreen launch works.
- [ ] Manual install on a real iPhone (iOS 16.4+) →
      Add-to-Home-Screen → fullscreen launch works.
- [ ] Web Push: two devices on the same team, recipient PWA
      backgrounded → push notification arrives within 5s on
      Android.
- [ ] Brand audit: no "Birthday Hunt" or "Mihali" appears in
      browser tab title, OG preview, or admin chrome.
- [ ] Solo-mode demo still loads at `/`.

---

## Boundaries

**Always:**
- Pre-cache only static assets; never API responses (they
  change per-team).
- VAPID private key lives as a wrangler secret, never in code or
  build output.
- Push payloads truncate user content to 100 chars and never
  include sensitive data (chat content is the most personal we
  send; nothing about location or hunt internals).

**Ask first:**
- Before sending any push that's not a 1:1 reaction to a player
  action (no marketing, no "your hunt expires soon").
- Before extending push to admin events.
- Before adding any analytics SDK in the SW (out of scope).

**Never:**
- Cache `/admin` or `/api/admin/*` paths in the SW.
- Cache WebSocket upgrade responses.
- Ship the manifest with `display: "browser"` (defeats the install
  point).
- Send pushes to non-subscribed players (would require silent
  collection of endpoints — privacy violation).
