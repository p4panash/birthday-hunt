# Master Plan — Birthday Hunt

Synthesis of the three research docs. Single source of truth for what we're building. Where this master plan and a research doc disagree, the master plan wins — research docs are frozen artifacts, this is the live decision record.

**Read alongside:**
- [`01-tech-stack.md`](./01-tech-stack.md) — deep stack rationale, code snippets. **Note:** ignore the encryption section (§10) — superseded; see §2.2 below.
- [`02-ux-design.md`](./02-ux-design.md) — screen wireframes, copy bank, animation specs. **Note:** the "code input always visible" recommendation in §1.3 and §5.3 is superseded; see §2.1 below. The animation aesthetic in §2 is modified — see §2.4 below.
- [`03-hosting-and-secrets.md`](./03-hosting-and-secrets.md) — the encryption design is no longer used. The runbook structure is still useful but skip the encrypt-assets steps.

---

## 1. The app in one paragraph

A mobile-first single-page React app with a **huge ticking countdown** at the top showing how long until the EasyBox auto-returns his package (eMag/Sameday gives 48h, so it's there for atmosphere — scary styling on a number that's never actually close to zero). Three Bucharest locations. At each, the friend's phone shows a cheeky hint and a "warmth pulse" GPS indicator. When he's within 50m, the next slice of the final QR auto-slides into place — no input required. If GPS misbehaves or he genuinely can't find the spot, he taps a single **"stuck?"** button which opens a sheet containing both the real hint AND a code-entry field; he texts the user, the user texts back a 4–6 char code, he types it, same unlock fires. After all three slices, they animate into one assembled QR that opens the EasyBox. Aesthetic is **Michael Reeves energy** — derpy, wobbly, simple, cute — on top of the warm Confetti Dusk palette. Two sounds play, ever: one at the third-slice unlock, one at the final QR reveal. Test mode lets the dev rehearse the full flow without moving. Hosted as a plain public site on GitHub Pages. No backend, no secrets, no encryption.

---

## 2. Resolved decisions

### 2.1 GPS auto-unlocks. Code entry is one tap deep, inside the "stuck?" sheet.

- **Primary path:** within 50m → app dispatches `UNLOCK_CHECKPOINT(n)` → slice n reveals. He doesn't see a code field at all.
- **Fallback path:** he taps the **"stuck?"** button → a slide-up sheet shows the real hint at the top and a small `got a code? [____] [unlock]` row at the bottom → he messages the user → user texts the code → he types it → same unlock fires.

Code validation is a plain string compare against `config.checkpoints[n].code` (case-insensitive, whitespace-trimmed). Wrong code → input shakes + coral.

### 2.2 No encryption layer. Everything ships in cleartext.

The hosting research doc proposed AES-GCM encryption of the QR slices. **Superseded** — the threat model is implausible for a one-recipient gift. We removed:

- `scripts/encrypt-assets.mjs`, `src/crypto/decrypt.ts`, the `secrets/` folder, the repo secrets, and the encrypt-and-deploy runbook.

What we keep instead: `public/qr.png` as a plain static asset, codes in `src/config.ts` as plain strings, client-side `<canvas>` slicing in the reveal animation. Build pipeline is just `vite build`.

### 2.3 QR slicing: client-side canvas from one source PNG

`public/qr.png` is the canonical QR. The app loads it once at startup (preload via `<link rel="preload">`), then for each reveal animation it slices a vertical third onto a temporary canvas and renders that into the slice cell.

```ts
export function sliceThird(img: HTMLImageElement, index: 0 | 1 | 2): string {
  const c = document.createElement('canvas');
  const w = img.width, h = img.height;
  c.width = Math.ceil(w / 3); c.height = h;
  c.getContext('2d')!.drawImage(img, -index * (w / 3), 0);
  return c.toDataURL('image/png');
}
```

At finale time, the full QR is rendered directly from `qr.png`. How the QR PNG gets generated is a one-time user-side task (online generator, EasyBox app share, screenshot, etc.).

### 2.4 Animation aesthetic: Michael Reeves energy (derpy, wobbly, simple)

The UX research doc proposed a polished "photo develops + FLIP into grid" reveal. **Modified.** Structure stays (slice appears → flies into its scaffold cell → confetti), but the primitives swap from "smooth spring physics" to "exaggerated jank that makes him laugh."

**Principles:**
- **Squash and stretch, hard.** Things landing in place overshoot by ~15%, squish flat to ~80% on impact, bounce back. Aggressive easings (`cubic-bezier(.34,1.56,.64,1)` and worse).
- **Wobble at rest.** Idle elements gently rotate ±2° every ~1.4s. Buttons jiggle.
- **Derpy faces are the unit of expression.** A reusable SVG mascot — a coral blob with two googly eyes and a `_` mouth — embedded in screens as the host. Four expressions cover everything we need: `idle`, `excited` (getting close to a checkpoint), `wrong-code` (X_X flash, momentary), `celebrating` (finale).
- **MS-Paint-quality intentional crudeness.** No subtle gradients or soft shadows on the mascot. Flat fills, 2-3px black strokes, asymmetric on purpose. If it looks like a designer drew it, it's wrong.

**Where this shows up:**

| Element | Derpy treatment |
|---|---|
| Mascot (corner of every gameplay screen, ~80×80px) | Idle wobble; eyes track toward the warmth pulse; throws confetti at unlocks |
| Reveal animation | Mascot waddles in from off-screen, spits out the QR slice, slice does 1.5 rotations + overshoots + squish-bounces into its scaffold cell. Mascot does a stupid little victory shimmy. Confetti is "X" shapes and squiggles, not circles |
| Warmth pulse | A wobbling blob that gets visibly excited (vibrating faster, eyes growing) as he gets closer. Cold = slumped blob. Warm = bouncy alert blob |
| Buttons | On tap: scale punch (1.0 → 0.85 → 1.1 → 1.0 in 250ms with elastic out) |
| Wrong code | Input box visibly grimaces (skews ±3°, X_X eyes flash on the mascot) before settling |
| Finale | Mascot full-body celebrates (bouncing offset by 8px, eyes turn to `^_^`, mouth opens to `/uuu\`), QR slices smash together with a crash-zoom |

**What we keep from the original UX doc §2:**
- The `layoutId` FLIP trick to get slices into their scaffold cells (now with sillier easing).
- 3.6s total reveal duration.
- `prefers-reduced-motion` fallback — quiet opacity fade, mascot stops wobbling.

**Tech:** all done with `motion` v11 (keyframes + aggressive easings + `useAnimate`). The mascot is a single hand-drawn SVG with named groups (`#eyes`, `#mouth`, `#body`) that we tween/swap. No extra dependency.

### 2.5 Huge countdown banner — visually scary, behaviorally simple

A persistent banner at the top of every screen (intro through finale) showing `HH:MM:SS` until the EasyBox auto-returns the package.

- Driven by `config.deadlineISO: string` — a single ISO 8601 timestamp set when the package is loaded into the EasyBox.
- Ticks once per second via `setInterval`, computes `deadline - Date.now()`.
- **Styled to LOOK ominous, behaviorally static.** Big mono coral digits on the plum background (~64px), drop shadow, slight glow, subtle idle wobble (Michael Reeves vibe). The visual *is* the urgency.
- **No urgency tiers, no color shifts, no mascot panic states based on time remaining.** Reason: eMag/Sameday gives 48 hours from drop-off and the user controls when to send the link, so the friend has way more than enough time. The countdown is atmospheric, not actually threatening.
- **Expired state** (shouldn't happen in practice): renders `00:00:00`, no special copy, no UI changes. The hunt continues normally.
- Visible from intro to finale (no opt-out — just always show).

Component: `src/components/CountdownBanner.tsx`, hook `src/lib/countdown.ts` (returns `{ms, hh, mm, ss}`). Test mode gets a single "set deadline to now + 30s" button so you can eyeball that the timer counts down correctly. That's it.

### 2.6 Palette: Confetti Dusk

Deep plum (`#1F1430`) + hot coral (`#FF6B5B`) + butter cream (`#FFD89C`). Fraunces (display) + Inter (body, including the countdown digits) + Caveat (handwritten captions only). The mascot uses coral body, cream eye whites, plum pupils.

### 2.7 Routing: none. State machine in one component.

5 logical screens (intro → gps-preface → location-active × 3 → reveal × 3 → finale), strict linear flow, no deep links. `useReducer` + a tiny `useLocalStorageSync` hook. Schema versioned as `bday-hunt-v1`.

### 2.8 Test mode: `?test=1`, sticky in localStorage

Detected on load, stored in `localStorage['bday-hunt-test']`. Renders a corner badge + long-press debug drawer with: skip-to-step, reset-progress, simulate-at-location, simulate-far, trigger-reveal-now, set-deadline-now+30s.

### 2.9 Deployment: GitHub Actions to GitHub Pages, no secrets required

`npm ci` → `npm run build` → upload → deploy. No repo secrets. Workflow runs on push to `main`.

### 2.10 Language: English now, translate later

Copy bank in `02-ux-design.md` §3 is English. Romanian translation deferred to phase 9.

### 2.11 Sound: silent except on wins

No global sound system, no config flag. Two files, played at four moments:

1. **Every checkpoint unlock** (slices 1, 2, and 3 — three plays of the same file) → `public/sound/unlock.ogg` ("win" sound, ≤2s).
2. **Assembled EasyBox QR finishes appearing** (finale animation completes, one play) → `public/sound/finale.ogg` ("payoff" sound, ≤2s).

Implementation: two `<audio>` elements with `preload="auto"`. The unlock element gets `.currentTime = 0; .play()` on each unlock so it can replay rapidly if needed. ~5 lines of code total.

If a file is missing (placeholder phase, files not sourced yet), `.play()` rejects silently — no fallback needed, no error states to handle.

User sources both files during phase 9 content fill. Free options: freesound.org, Pixabay sound, or record a kazoo on your phone.

### 2.12 Photos: infrastructure now, content later

`config.photos: PhotoConfig[]` is wired and the `PhotoInterstitial` screen exists — array is empty for v1.

---

## 3. Final stack (pinned)

| Layer | Choice | Why (one line) |
|---|---|---|
| Bundler | Vite 5 | Smallest static output, simplest GH Pages story |
| UI | React 18 + TypeScript 5 | Catches config typos; bundle is fine |
| Animation | `motion` v11 | `layoutId` + `useAnimate` + aggressive keyframes do all the derpy work |
| Confetti | `canvas-confetti` v1 | 5 KB, custom shapes (X, squiggle) via `shapes:` |
| Geolocation | Native `watchPosition` | 20 LOC custom hook |
| State | `useReducer` + localStorage | No Zustand, no Redux, no router |
| Countdown | Native `setInterval` + `Date.now()` | No dep |
| Sound | Native `<audio>` + `.play()` | No dep, two files |
| Deploy | GitHub Actions → Pages | `actions/deploy-pages@v4`, no repo secrets |

Install:

```bash
npm create vite@latest birthday-hunt -- --template react-ts
cd birthday-hunt
npm i motion canvas-confetti
npm i -D @types/canvas-confetti
```

Three runtime packages. The mascot is a single SVG, not a dependency.

---

## 4. Repo layout

```
birthday-hunt/
├── planning/
├── public/
│   ├── qr.png                     # the final QR — plain PNG, committed
│   ├── photos/                    # empty for v1
│   └── sound/
│       ├── unlock.ogg             # plays on every checkpoint unlock (×3)
│       └── finale.ogg             # plays when the assembled QR appears
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── config.ts                  # SINGLE EDIT POINT — checkpoints, copy, codes, deadlineISO
│   ├── state/
│   │   └── huntReducer.ts
│   ├── geo/
│   │   ├── haversine.ts
│   │   └── useGeoWatch.ts
│   ├── screens/
│   │   ├── Intro.tsx
│   │   ├── GpsPreface.tsx
│   │   ├── LocationActive.tsx
│   │   ├── Reveal.tsx
│   │   ├── PhotoInterstitial.tsx
│   │   └── Finale.tsx
│   ├── components/
│   │   ├── CountdownBanner.tsx
│   │   ├── ProgressScaffold.tsx
│   │   ├── WarmthPulse.tsx        # the wobbling blob
│   │   ├── StuckSheet.tsx
│   │   ├── Mascot.tsx
│   │   ├── TestModeBadge.tsx
│   │   └── TestDrawer.tsx
│   ├── lib/
│   │   ├── sliceQr.ts
│   │   ├── countdown.ts
│   │   ├── testMode.ts
│   │   └── useLocalStorageSync.ts
│   ├── assets/
│   │   └── mascot.svg
│   └── styles/
│       ├── globals.css
│       └── tokens.css
├── .github/workflows/deploy.yml
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── .gitignore
└── README.md
```

---

## 5. Build phases

### Phase 0 — Scaffold (≈25 min)
- `npm create vite@latest` + dependencies
- `vite.config.ts` with `base: '/birthday-hunt/'`
- `.gitignore`, `tokens.css` (Confetti Dusk), Google Fonts imports
- Generic public-facing `README.md`
- Placeholder `public/qr.png` (any throwaway QR)

### Phase 1 — State machine + screen stubs (≈45 min)
- `huntReducer` with the 5-step state machine
- `useLocalStorageSync` hook + schema versioning
- All six screen components rendering "STEP N" placeholders
- `App.tsx` switching on `state.currentStep`

### Phase 2 — Config + copy + styling (≈60 min)
- `config.ts` typed, including `deadlineISO`, checkpoints, codes, copy
- All copy from `02-ux-design.md` §3 wired into screens (English)
- Confetti Dusk applied, mobile viewport meta + safe-area, portrait-lock

### Phase 3 — Geolocation + warmth blob (≈60 min)
- `haversine.ts` + `useGeoWatch.ts`
- `WarmthPulse` as the wobbling blob (excited as he gets closer)
- 4-state status line copy from `02-ux-design.md` §5.2
- Wire to `LocationActive`: distance < `radiusMeters` → `UNLOCK_CHECKPOINT`
- Verify on real phone

### Phase 4 — Countdown banner (≈25 min)
- `countdown.ts` hook (returns `{ms, hh, mm, ss}` — no urgency tiers)
- `CountdownBanner.tsx` component — big mono coral digits on plum, drop shadow, slight idle wobble
- Sticky positioning at top of all gameplay screens
- Single test-mode button: "set deadline to now + 30s"

### Phase 5 — Mascot + QR slicing + stuck sheet (≈75 min)
- Hand-draw `mascot.svg` — coral blob, googly eyes, derpy mouth, named groups `#body #eyes #mouth`
- `Mascot.tsx` — four expressions: `idle | excited | wrong-code | celebrating`. Swap SVG path data via `motion` + idle wobble loop
- `sliceQr.ts` (canvas helper)
- `StuckSheet.tsx` (slide-up with real hint + code input + shake-on-wrong)

### Phase 6 — Derpy animations (≈90 min)
- `ProgressScaffold` (3 cells: empty/active/completed)
- Reveal animation per §2.4: mascot enters → spits slice → slice yeets-rotates-overshoots-squishes into scaffold cell → mascot shimmy → "X"-shaped confetti
- Aggressive easings throughout
- `prefers-reduced-motion` fallback
- Finale: scaffold slams into one QR with crash-zoom, mascot full-body celebrates

### Phase 7 — Sound + test mode (≈45 min)
- Drop placeholder `public/sound/unlock.ogg` and `finale.ogg` (any short clips for now)
- Two `<audio>` elements; `unlock` plays on every `UNLOCK_CHECKPOINT` transition (`currentTime = 0; play()` for rapid replays), `finale` plays on finale-animation-complete
- `testMode.ts` detection (`?test=1` sticky)
- `TestModeBadge` + long-press → `TestDrawer`: skip-to-step, simulate-at-location, simulate-far, trigger-reveal-now, reset-progress, set-deadline-now+30s
- Mocked `watchPosition` in test mode
- Verify: a fresh phone can play the full hunt; `?test=1` on a desk runs the whole flow

### Phase 8 — Deploy pipeline (≈20 min)
- `.github/workflows/deploy.yml` — minimal build + deploy
- Settings → Pages → Source: GitHub Actions
- First push, verify Action, smoke-test live URL incognito

### Phase 9 — Content fill + ship (≈30 min + walking time)
- Replace placeholder coords in `config.ts` with the actual 3 spots
- Replace placeholder codes in `config.ts`; save them in phone notes
- Replace `public/qr.png` with the real EasyBox QR
- Set `config.deadlineISO` to the EasyBox return timestamp (~48h from drop-off)
- Source the two sound files (`unlock.ogg`, `finale.ogg`) and drop into `public/sound/`
- Walk the route in test mode and tune `radiusMeters` per location
- (Optional) translate copy to Romanian
- Hand the URL to the friend

**Total estimated build: ~7 hours of focused work.**

---

## 6. Open questions / things only the user can answer

1. **The 3 actual Bucharest locations.** Placeholders are Piața Universității, Cișmigiu, Ateneul Român.
2. **The 3 actual unlock codes.** Stored in `config.ts`; keep a copy on your phone.
3. **The final QR PNG** — drop into `public/qr.png`.
4. **`config.deadlineISO`** — the EasyBox return deadline (typically drop-off + 48h).
5. **Friend's name + age** for `config.friendName` and intro copy.
6. **Final language** — English in the bank, translate during phase 9 if needed.
7. **Photos** — empty for v1.
8. **The two sound files** — `unlock.ogg` (plays on every checkpoint win) and `finale.ogg` (plays at the assembled QR reveal), both short (≤2s, ≤30KB). Sourced during phase 9.
9. **GitHub username + repo name** — determines `base` path and live URL.

---

## 7. What's explicitly out of scope

- No analytics, no telemetry, no error reporting.
- No backend, no database, no auth.
- No encryption, no hashing, no obfuscation.
- No PWA / installable manifest.
- No i18n machinery.
- No automated tests beyond manual phone-in-hand verification.
- No CI lint/format gates beyond Vite's TS check on build.
- No support for >3 locations.
- No social / share buttons.
- No server-driven countdown — `deadlineISO` is fixed, his phone clock is trusted.
- No urgency tiers on the countdown (no color shifts, no mascot panic, no copy changes based on time remaining).
- No always-on sound, no mute toggle, no audio config.

---

## 8. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| GPS accuracy too poor on hunt day under trees/buildings | Medium | 50m radius floor; "stuck?" is always one tap away |
| Friend's phone denies geolocation outright | Medium | He taps "stuck?", you text him a code, same unlock path |
| You're not reachable when he texts for a code | Medium | Pre-save codes in your phone's notes |
| QR doesn't scan due to slice-rendering artifacts | Low | High-quality source PNG (≥800px wide), error-correction H; verified at finale |
| Phone runs out of battery mid-hunt | Low | localStorage persists progress; countdown re-syncs on next load |
| He shares the URL — someone else opens it | Low | They'd need to be in Bucharest walking three landmarks within 48h. Accepted. |
| Network drops mid-hunt | Low | All assets cached after first load; countdown is purely client-side |
| GH Actions deploy breaks on hunt day | Low | Test the deploy a day in advance; manual `gh-pages` fallback |
| Mascot SVG looks too polished and the joke dies | Medium | Resist the urge to clean it up. Asymmetry + 2-3px black strokes + flat fills only |
| Sound file not present at runtime | Low | `.play()` rejects silently; no UI fallback needed |
| Wrong coords / wrong radius for a real location | Medium-High | **Walk the route in test mode before hunt day.** Non-negotiable. |

---

## 9. The "what to do next" question

**Option A — Start building (phases 0–8).** Scaffold + everything except final content. You fill the 9 open questions in phase 9.

**Option B — Tighten further first.** Push back on any of §2's decisions.

**Option C — Just the planning.** Hand back the docs.

Recommendation: **A**.
