# goodLoot Native Launch Playbook

Step-by-step from "code is ready" to "friends are testing the app on
their phones." This document is for the human operator; the agent has
already done all the code work.

The fastest path is **Android APK to friends** — no developer
accounts, no cost, no review. Start there. iOS comes later (App
Store or TestFlight).

---

## Phase A — Android APK for testing (zero cost, ~30 minutes)

### A1. Install Android Studio

Download and install from <https://developer.android.com/studio>.
Open it once and let it install the default SDK + emulator (you don't
need to use the emulator if you'll test on a real phone, but it
finishes the SDK install).

The agent's scripts assume the standard Studio install path. You don't
need to change any defaults.

### A2. One-time: create the Android project folder

In the repo root:

```bash
npm run cap:add:android
```

This creates `android/`. **Commit it** — Capacitor projects always
have these folders in git.

### A3. Generate the icons + splash for native projects

The agent already produced `resources/icon.png` and
`resources/splash.png`. Fan them out to the platform-specific
locations:

```bash
npm run cap:assets
```

(Re-run any time the brand changes.)

### A4. Build the APK

Two routes — same result:

**Option 1: Android Studio GUI**
```bash
npm run cap:sync          # copies the web build into android/
npm run cap:open:android  # opens Studio
```
In Studio: top menu → Build → Build Bundle(s) / APK(s) → Build APK(s).
After ~30s a notification appears with a "locate" link. The file is
at `android/app/build/outputs/apk/debug/app-debug.apk`.

**Option 2: CLI**
```bash
npm run cap:sync
cd android
./gradlew assembleDebug
```
(Windows: `gradlew.bat assembleDebug`.) Same APK path.

### A5. Distribute to testers

Send `app-debug.apk` via WhatsApp / Telegram / Drive / email. Each
tester:

1. Opens the file on their Android phone
2. First time only: Settings → Apps → Special access → Install unknown
   apps → permit their messenger app
3. Tap "Install"
4. App appears on home screen with the goodLoot icon

Testers do NOT need a Play Store account. They do NOT need to enable
developer options. The "unknown source" warning is standard for any
sideloaded APK.

### A6. Updates

When you change anything, re-run A4 to produce a new APK. Send it
again. Testers install over the existing app (data is preserved
because the bundle ID stays the same: `com.useadonis.goodloot`).

**Even better**: because `capacitor.config.ts` sets `server.url =
hunt.use-adonis.com`, web changes ship without rebuilding the APK.
You only rebuild when changing native config (icons, splash, plugins,
bundle ID).

---

## Phase B — iOS for testing (requires Mac, ~1 hour)

### B1. Get access to a Mac

Required for any iOS build. Options:
- Your own Mac (preferred)
- A friend's Mac for one afternoon
- A cloud Mac service (MacStadium, MacInCloud) — $30-100/month
- A Hackintosh if you're into that — not officially supported

### B2. Install Xcode

From the Mac App Store. ~10 GB. First open: agree to license, install
"Command Line Tools" if prompted.

### B3. Sign in with a free Apple ID

Xcode → Settings → Accounts → "+" → Apple ID. A free Apple ID is
enough for personal sideloading; you don't need the $99/yr Developer
Program yet.

### B4. Create the iOS project folder

```bash
brew install cocoapods       # iOS dep manager, one-time
npm run cap:add:ios
npm run cap:assets           # if you haven't already
npm run cap:sync
npm run cap:open:ios         # opens Xcode
```

### B5. Pick the signing identity in Xcode

In the project navigator (left), click the goodLoot project, then
the App target, then "Signing & Capabilities". Set:
- Team: your free Apple ID
- Bundle Identifier: `com.useadonis.goodloot`

Xcode will provision a 7-day signing certificate automatically.

### B6. Run on your iPhone

- Connect your iPhone to the Mac via cable
- Trust the computer when prompted on the phone
- In Xcode, top bar → device selector → pick your phone
- Click ▶ (Run). First time: phone asks you to trust the
  developer profile (Settings → General → VPN & Device Management
  → trust the goodLoot profile)

The app installs to your home screen. Lasts 7 days, then you re-run
this step to refresh.

### B7. Distribute to friends? Need $99/yr.

To put goodLoot on a teammate's iPhone without your laptop, you need
either:
- **Apple Developer Program** ($99/yr) — unlocks TestFlight (up to
  10,000 testers via a public link, builds valid 90 days)
- **AltStore / Sideloadly** — third-party tools that re-sign IPAs
  with the user's own free Apple ID. Free but each user does the
  sideload themselves, awkward UX.

For early-stage testing, your iOS friends will use
`hunt.use-adonis.com` in Safari with PWA install (already shipped in
Phase 2). That works fully — no native app needed for them yet.

---

## Phase C — App Store / Play Store (public listing)

This is the longest phase. Don't enter it until Phase A + B feel
solid.

### C1. Apple Developer Program — $99/year

<https://developer.apple.com/programs/enroll/>

- Wait 1-2 days for approval after payment
- You'll need a D-U-N-S number if registering as an organisation; as
  an individual, just your full legal name

### C2. Google Play Developer — $25 one-time

<https://play.google.com/console/signup>

- Wait 1-7 days for ID verification
- You'll be asked for a tax form (W-8BEN for non-US)

### C3. Generate the Android signing keystore

**ONE-OFF. If you lose this file, you can never update your app
again — Google will refuse new uploads.** Store it somewhere safe
(password manager attachment, encrypted backup).

```bash
keytool -genkey -v -keystore goodloot-release.keystore \
  -alias goodloot -keyalg RSA -keysize 2048 -validity 25000
```

Then add to `android/key.properties` (NOT committed):
```
storeFile=/absolute/path/to/goodloot-release.keystore
storePassword=<the password you set>
keyAlias=goodloot
keyPassword=<same password>
```

### C4. Build the release AAB

```bash
npm run cap:sync
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`.
Upload to Play Console.

### C5. Listing assets

Both stores want the following — prepare BEFORE clicking submit:

- App name: goodLoot (32 chars max for Play Store)
- Short description (80 chars): "Cooperative GPS treasure hunts
  with your team."
- Full description (4000 chars): see `docs/store-listing.md` —
  agent will draft if requested
- Screenshots: 2-8 per device class
  - iOS: 6.7" iPhone (1290x2796) and iPad 12.9" (2048x2732)
  - Android: 2-8 phone screenshots (16:9 or 9:16)
- Feature graphic (Play only): 1024x500
- App icon: already generated by `cap:assets`

### C6. Privacy + content rating

Apple privacy questionnaire — match these to `public/privacy.html`:
- Location: Yes, while playing, not linked to identity, not used for tracking
- Diagnostics: No
- User Content (chat): Yes, linked to identity, not used for tracking
- Identifiers: Device ID (client_id), not linked to identity, not for tracking
- Contact Info: No

Play Console Data Safety: same answers.

Privacy policy URL (both stores): `https://hunt.use-adonis.com/privacy`.
Terms URL: `https://hunt.use-adonis.com/terms`.

(Cloudflare Pages serves these from `public/privacy.html` and
`public/terms.html`; both extension-less URLs return 200.)

### C7. Submit

Apple: App Store Connect → upload via Xcode → in the listing,
"Submit for Review." Wait 1-7 days. Common rejection: "your app is
a WebView wrapper" — if it hits, switch `capacitor.config.ts` to
bundled mode (`server.url` removed, `webDir: 'dist'`), build again,
resubmit explaining "ships with offline content; Web fallback is
for fast iteration only."

Google Play: Play Console → upload AAB → fill listing → submit.
Usually approved within hours, sometimes days.

---

## Phase D — Push notifications (after C is green)

The push infrastructure is already live (Phase 2 / Phase 3 SPA
branches). On native it routes through Capacitor's
PushNotifications plugin. The cleanest production setup needs FCM
HTTP v1:

- Create a Firebase project tied to your Google Play app
- Download `google-services.json` (Android) and
  `GoogleService-Info.plist` (iOS) — drop into `android/app/` and
  `ios/App/App/` respectively (gitignored — never commit)
- The current Worker fan-out uses Web Push semantics shimmed onto
  FCM endpoints; this works for testing but for production scale,
  add a parallel FCM HTTP v1 path. Not a Phase 3 blocker.

---

## Troubleshooting

- **APK won't install ("App not installed")**: usually a signing
  mismatch with a previously-installed version. Uninstall the old
  one first, then install the new APK.
- **Capacitor sync fails with "command not found"**: `npx cap`
  needs `node_modules/.bin/cap` — run `npm install` first.
- **iOS push token never arrives**: APNs needs an Apple Developer
  Program account ($99/yr). Free Apple ID can build and run, but
  cannot receive APNs tokens.
- **App opens to a white screen**: WebView can't reach
  `hunt.use-adonis.com`. Check your phone's network. Or switch to
  bundled mode (remove `server.url`, set `webDir: 'dist'`, `npm
  run cap:sync`).

---

## Quick reference

| Goal | Command | Cost | Time |
|------|---------|------|------|
| Android APK for sideloading | `npm run cap:add:android && npm run cap:sync` then build in Studio | $0 | 30 min |
| iOS app on your phone (7 days) | Mac + Xcode + free Apple ID | $0 (need Mac) | 1 hour |
| TestFlight to friends | iOS + Apple Developer Program | $99/yr | 1-2 days |
| Play Store public | Google Play Developer + AAB | $25 | 1-7 days |
| App Store public | Apple Developer Program | $99/yr | 1-7 days |
