# Spec: Native Wrap & Store Launch (Phase 3 of goodLoot roadmap)

> **Status:** Draft 2026-05-27.
> **Predecessors:** Phase 1 (Social Bundle), Phase 2 (Platform Polish) —
> both shipped on `feat/goodloot`, live on `hunt.use-adonis.com`.

## Objective

Ship goodLoot as a real installable mobile app in the Apple App Store
and Google Play Store. The web experience at `hunt.use-adonis.com`
remains the canonical product; the native shell is a thin Capacitor
wrapper that loads the same SPA, with native plugins replacing the
Web APIs where they outclass the browser (push, splash, status bar).

Players who find goodLoot via the store get the "real app" experience:
search by name, install with one tap, badge counts, native
notifications, no PWA install friction.

### Why this matters

Phase 2 delivered PWA installability — 80% of "downloadable app feel"
without paying $99/yr to Apple. But the user's stated expectation
during the brainstorm is: "cei care joaca jocul sau sunt cautatori
o sa descarce un app." That phrase implies App Store search +
install, not "Add to Home Screen." Phase 3 closes that gap.

The web app stays the source of truth. The native shell is *not* a
rewrite — Capacitor wraps the existing dist/ output and runs it in
a WKWebView (iOS) / WebView (Android) with native bridges for the
features the browser handles weakly.

### Users and roles

Unchanged. Same player + admin separation. Admin remains
web-only (`/admin` on the domain); no admin shipped in the store
build.

### Success criteria

- **App Store**: goodLoot listed under the developer's account,
  searchable by name, install one-tap, opens to the same UX as
  the web SPA. No "this is just a website" review rejection.
- **Play Store**: same.
- **Native push** works without a PWA install gesture — token is
  acquired on first launch, registered with the Worker. New chat
  → native notification on locked device, opens to the right team
  on tap.
- **Splash + icon** are branded goodLoot, not Capacitor defaults.
- **Status bar + safe areas** look native on both platforms (no
  white gap at the top, no overlapping notch).
- **Deep links**: a tap on a notification or a shared invite URL
  opens the app to the right screen (join flow with invite prefilled,
  or team mode if already joined).
- **Same codebase**: 95%+ of `src/` is reused unmodified. The native
  shell is `ios/` + `android/` folders plus a `capacitor.config.ts`
  + a few `@capacitor/*` plugin calls behind feature detection.
- **Phase 1+2 regression-free**: web app continues to work
  identically.

### Non-goals (explicit)

- **No native UI rewrites.** Everything renders in the WebView.
- **No app-only features.** Anything that works in the app must also
  work in the browser at `hunt.use-adonis.com`. The store version is
  a wrapper, not a fork.
- **No in-app purchases / billing.** goodLoot stays free.
- **No analytics SDKs** (Firebase, Mixpanel, etc.) in the wrap. The
  store reviewers will scan for trackers; we ship the minimum.
- **No `/admin` in the native build.** Admin is operator UI; the
  store version's allowed routes deliberately exclude it.
- **No iOS push without APNs setup.** We use FCM for both platforms
  via Capacitor's PushNotifications plugin — FCM handles APNs token
  exchange on the server side, so we only manage one push provider.
- **No automatic CI/CD for store builds in this phase.** First
  submission is local build → manual upload. Automation lands later.

---

## Architecture

```
   ┌──────────────────────────────────────────────────────────────┐
   │ goodLoot.app  (App Store / Play Store)                        │
   │  ┌────────────────────────────────────────────────────┐      │
   │  │ Capacitor shell                                    │      │
   │  │  • iOS: WKWebView                                  │      │
   │  │  • Android: WebView (system Chromium)              │      │
   │  │  • Loads from bundled `web/` dir (offline)         │      │
   │  │  • Bridges to:                                     │      │
   │  │    – @capacitor/push-notifications (FCM tokens)    │      │
   │  │    – @capacitor/splash-screen                      │      │
   │  │    – @capacitor/status-bar                         │      │
   │  │    – @capacitor/app (deep-link / resume events)    │      │
   │  │    – @capacitor/preferences (native key-value;     │      │
   │  │      replaces localStorage for sensitive bits)     │      │
   │  └────────────────┬───────────────────────────────────┘      │
   │                   ▼                                          │
   │   React SPA (existing src/ from Phase 1+2)                   │
   │   – useTeamState, social bundle, PWA layer                   │
   │   – Detects Capacitor.isNativePlatform() and routes push     │
   │     subscription through the plugin instead of pushManager   │
   └──────────────────────────────────────────────────────────────┘
                                │
                                ▼
                  hunt.use-adonis.com/api/*  (Worker)
                  • Same endpoints as web
                  • Push endpoint stores FCM tokens too
                    (transparent — they conform to the Push API
                    shape: endpoint + p256dh + auth keys provided
                    by Capacitor)
```

### Bundling strategy

Two paths:

1. **Live web** (recommended for v1): the native shell loads
   `https://hunt.use-adonis.com` directly. Same SW, same updates
   roll out without store review. Trade-off: requires network on
   first open (subsequent loads use the SW cache).
2. **Bundled web** (fallback): `dist/` is copied into the iOS +
   Android asset bundles. App works zero-network on first launch,
   but updates require a store-review cycle.

We ship **path 1** initially — the agile feedback loop matters more
than first-launch offline. The Capacitor `server.url` in
`capacitor.config.ts` points to `hunt.use-adonis.com`. If a future
store reviewer flags this as a "WebView wrapper" rejection (Apple
4.2 "Minimum Functionality"), we switch to path 2 with a build-time
copy step.

### Push: native token reuses the Web Push schema

Capacitor's `PushNotifications.register()` returns an FCM device token
on both iOS (after APNs exchange) and Android. We adapt the Worker's
existing subscription model:

- The native client treats the FCM token as a synthetic Push API
  subscription with `endpoint = https://fcm.googleapis.com/fcm/send/<token>`
  and a fixed `p256dh`/`auth` pair we generate locally (FCM doesn't
  actually use them for encryption, but the schema needs values).
  The Worker's existing fan-out path then sends to FCM directly via
  HTTP v1 protocol — falls cleanly into the `ALLOWED_PUSH_HOSTS`
  allowlist.

Alternative (cleaner long-term): add a second table
`fcm_subscriptions(player_id, team_id, fcm_token, ...)` and a
parallel fan-out path that uses FCM HTTP v1 with a service account.
Out of scope for the v1 store submission — Phase 3.5.

### Identity: `client_id` lives in native preferences

Phase 2's IDOR fix relies on `client_id` in localStorage. On the
native shell, we move it to `@capacitor/preferences` (encrypted on
Android via EncryptedSharedPreferences if available, plain KV on
iOS). Feature-detected: `Capacitor.isNativePlatform()` → preferences,
else → localStorage. Same key, same value.

---

## What goes in vs what the user does manually

**Agent can implement:**
- `capacitor.config.ts`, `ios/`, `android/` scaffolding
- App icons (multi-size from the Phase 2 SVG → all store-required sizes)
- Splash screens (all device sizes)
- Plugin integration (push, splash, status-bar, app, preferences)
- Conditional code (`isNativePlatform()` branches in the SPA)
- Privacy policy + Terms of Service Markdown → HTML pages served
  by Pages
- README updates documenting the build process

**User must do (cannot be automated):**
- Apple Developer Program enrollment ($99/year) — wait time 1-2 days
- Google Play Developer enrollment ($25 one-time) — wait 1-7 days
- App Store Connect: create app record, upload first build via
  Xcode + Transporter, fill the listing (description, screenshots,
  age rating, privacy questionnaire), submit for review (1-7 days
  Apple wait)
- Play Console: create app, upload AAB, fill listing, submit for
  review (typically hours, sometimes days)
- Signing certificates: Xcode handles iOS automatically once
  enrolled; Android requires generating a keystore (one-off)
- Firebase project creation + service-account JSON for FCM HTTP v1
  (only if we go the cleaner FCM path; not needed for web-push-
  shim path)
- Decide which Apple Developer Team / Google Play Account ID to
  publish under

We ship the spec + scaffolding + a `docs/native-launch-playbook.md`
that walks the user through the manual steps with screenshots and
expected wait times.

---

## Privacy policy + Terms of Service (required by stores)

Both stores require a public privacy policy URL before listing.
Apple also requires the privacy questionnaire to match the
collected data. goodLoot collects:

- Invite codes + player names (typed by user)
- GPS location during active hunt (only when the screen is open)
- Chat messages (typed by user)
- Device push token (after opt-in)
- `client_id` (random UUID, no PII)

No analytics. No third-party tracking. No advertising. No data
sale. Same content lives on `hunt.use-adonis.com/privacy` and
`/terms` as static pages served by Pages.

---

## Build pipeline (manual for v1)

```
# Once per dev environment
brew install cocoapods       # iOS dep manager
brew install android-studio  # for keystore + AAB build
npm install                  # capacitor + plugins
npx cap add ios
npx cap add android

# Per release
npm run build                # produces dist/ (web)
npx cap sync                 # copies + syncs plugins
npx cap open ios             # Xcode → Archive → Upload
npx cap open android         # Studio → Build → Signed AAB → upload
```

`npm run cap:release` will wrap these into one command, but each
step requires the user to be at the keyboard for signing prompts.

---

## Acceptance checklist (Phase 3 exit gate)

- [ ] `npx cap sync` clean on both ios/ and android/ folders.
- [ ] iOS build runs in iOS Simulator, opens to the SPA, push
      permission prompt fires.
- [ ] Android build runs in an emulator, same.
- [ ] App icon + splash branded correctly on both platforms.
- [ ] Push token registers with Worker → test push from another
      device → notification on locked screen.
- [ ] Deep link `goodloot://join?invite=XXXX` opens app to join
      screen with code prefilled.
- [ ] Apple Developer enrollment complete.
- [ ] Google Play Developer enrollment complete.
- [ ] App Store Connect listing draft complete with screenshots.
- [ ] Play Console listing draft complete with screenshots.
- [ ] First build uploaded to both stores. Status: "Waiting for
      Review" (Apple) / "In review" (Google).

(Acceptance does NOT require store approval — approval is on the
reviewers' timeline. Phase 3 ends when submission is complete.)

---

## Boundaries

**Always:**
- Feature-detect `Capacitor.isNativePlatform()` before calling any
  `@capacitor/*` API; the web SPA must still work in plain browsers.
- Keep the Capacitor config + iOS/Android folders out of the web
  bundle.
- Match privacy questionnaire answers to what the code actually
  collects. Reviewers diff the two.

**Ask first:**
- Before generating keystores (the file IS the signing identity;
  losing it bricks future updates).
- Before paying for any account or service.
- Before submitting to a store (final review of metadata + assets
  before the clock starts on reviewers).

**Never:**
- Ship `console.log()` of `client_id` or chat content in production
  builds. Apple reviewers grep for these.
- Hard-code API keys, FCM service-account JSON, or signing keys
  into the repo.
- Ship analytics SDKs in this phase.
- Change the URL the WebView loads without bumping the store-listed
  version (a "WebView pointing at a different site post-review" is
  a fast path to account suspension).
