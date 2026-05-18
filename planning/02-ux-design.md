# 02 — UX Design: Birthday Treasure Hunt

> Single-page web app, mobile-first, one recipient ([FRIEND_NAME]), played in Bucharest. Three GPS-gated checkpoints → three QR slices → one assembled QR that unlocks an EasyBox locker. Tone: warm roast, friend-banter, zero corporate.

---

## TL;DR — the experience in 8 bullets

- **One thumb, one screen, one story.** Portrait-locked, full-bleed, no chrome. Feels closer to a Telegram easter egg than a web app.
- **Three acts, three slices, one payoff.** Each location reveals 1/3 of a QR onto a persistent 3-cell scaffold at the top of the screen — he watches the puzzle physically build.
- **Hints are two-tier.** A cheeky teaser is always visible; a "Stuck? Drop the actual hint" button is one tap away. Pride intact, frustration capped.
- **GPS is silent until it matters.** No meters, no compass — a soft "getting warmer" pulse and a single status line. Numbers feel like Strava; this should feel like a game.
- **Manual code is a safety net, not a backup plan.** Visible from minute 1 as a small "Got a code from the spot? Enter it" link under the hint. No anxiety about denied permissions.
- **Photos are interstitials, not gallery dumps.** Between steps: one full-bleed photo card, one caption, tap to continue. Configurable per slot.
- **Test mode is a corner badge + slide-up debug drawer.** Long-press the badge to open it. Invisible in production via a single config flag.
- **Palette: warm-festive ("Confetti Dusk").** Deep plum background, hot coral accent, butter-cream type. Fraunces + Inter. Feels handcrafted, not Canva.

---

## 1. Screen-by-screen wireframes

All screens are 100vh / 100vw, portrait, mobile-first. Safe-area padding top and bottom. Scroll is disabled except inside hint/photo cards.

### 1.1 Intro screen

```
+---------------------------------------+
|  [safe area]                          |
|                                       |
|     "happy birthday, you menace"      |   <- eyebrow, small caps, coral
|                                       |
|        HEY [FRIEND_NAME].              |   <- 48px serif (Fraunces)
|       I HID YOUR GIFT.                 |
|        GOOD LUCK.                      |
|                                       |
|   ~~~~ animated dotted path ~~~~      |   <- 3 dots pulsing left→right
|                                       |
|   3 stops. 3 clues. 1 locker.         |   <- 16px body
|   Walk. Don't Uber. I'll know.        |
|                                       |
|                                       |
|         [  let's go  →  ]             |   <- primary CTA, 56px tall
|                                       |
|   tap = i agree to walk around        |   <- 12px helper, low contrast
|   bucharest like a tourist            |
|                                       |
+---------------------------------------+
```

- **Hierarchy:** eyebrow → name headline → path → rules → CTA → fine print.
- **Action:** single button. Tapping it triggers the GPS permission request *next* screen, not immediately — gives us a frame to explain why.
- **Motion on enter:** headline fades + rises 12px over 600ms, path dots stagger in over 800ms, CTA scales from 0.96→1 with a tiny bounce.

### 1.2 GPS permission preface

Shown right after the intro CTA. We *don't* trigger `navigator.geolocation.getCurrentPosition` until he taps "Allow location" inside our screen — this almost always increases consent rate vs. cold-prompting.

```
+---------------------------------------+
|                                       |
|             ( map pin icon )          |
|                                       |
|        I need to know where           |
|             you are.                  |
|                                       |
|   Otherwise this hunt is just me      |
|   typing words at you. Pinky          |
|   promise: I'm not tracking you,      |
|   your phone is. I just listen.       |
|                                       |
|                                       |
|     [  allow location  ]              |   <- primary
|     [  i'll type codes instead  ]     |   <- secondary, smaller
|                                       |
+---------------------------------------+
```

- **Action:** "Allow location" triggers the native prompt. "I'll type codes instead" routes him to the same location screen but with the manual code field pre-expanded and the distance pulse hidden.

### 1.3 Location-active screen (the main game screen)

This is where he spends 90% of his time. One per step.

```
+---------------------------------------+
|  [ 1 ][ 2 ][ 3 ]              ( ⚙ )  |   <- progress scaffold (see §6), settings dot
|   ▓     □     □                       |
|                                       |
|   STOP 1 OF 3                         |   <- eyebrow, small caps
|                                       |
|   "The place where the lions          |   <- hint teaser, 22px serif italic
|    pretend they're not bored."        |
|                                       |
|       ( soft pulsing dot )            |   <- GPS warmth indicator, ~120px
|                                       |
|   getting warmer...                   |   <- status line, updates live
|                                       |
|                                       |
|   [ stuck? drop the actual hint ]     |   <- ghost button, full width
|                                       |
|   - - - - - - - - - - - - - - - - -   |   <- divider
|                                       |
|   got a code from the spot?           |   <- 14px label
|   [  _ _ _ _   ]   [ unlock ]         |   <- 4-char input, monospace
|                                       |
+---------------------------------------+
```

- **Hierarchy:** progress → step label → hint → GPS pulse → escape hatches (real hint + code).
- **GPS pulse behavior:** see §5. Color/scale animates with proximity. No meters.
- **Action paths:**
  1. He walks close enough → auto-advance to reveal.
  2. He taps "stuck?" → modal sheet with the real hint.
  3. He enters the 4-char code → manual advance to reveal.
- **No back button.** Forward-only journey. The settings dot opens a tiny sheet with "restart hunt" and (in test mode) the debug drawer.

### 1.4 Hint modal (the "stuck?" reveal)

Slide-up sheet, 70% screen height, dimmed backdrop.

```
+---------------------------------------+
|                                       |
|     ===                               |   <- drag handle
|                                       |
|     FINE. HERE IT IS.                 |
|                                       |
|     Go to [LOCATION_1_NAME].          |
|     Look for the [LANDMARK_DETAIL].   |
|     The code is taped to the back.    |
|                                       |
|     ( a small map thumbnail,          |
|       static, with one pin )          |
|                                       |
|     [ open in maps ]                  |   <- secondary
|     [ close and pretend i didn't ]    |   <- ghost
|                                       |
+---------------------------------------+
```

- "open in maps" deep-links `geo:` on Android, `maps:` on iOS. Coordinates from config.

### 1.5 Reveal moment

Triggered by GPS-in-range OR correct code. Full-screen takeover, ~4s total. See §2 for the animation spec.

```
+---------------------------------------+
|                                       |
|          ( confetti burst )           |
|                                       |
|         GOTCHA.                       |   <- 56px serif, coral
|                                       |
|     [ slice 1 of QR animates          |
|       into top-left cell of the       |
|       scaffold above ]                |
|                                       |
|     1 down. 2 to go.                  |
|                                       |
|                                       |
|        [ on to stop 2  → ]            |   <- appears at t=3s
|                                       |
+---------------------------------------+
```

### 1.6 Photo interstitial (optional, between steps)

Only shown if `photos` config has an entry for `afterStep: N`.

```
+---------------------------------------+
|                                       |
|   ( full-bleed photo, slightly        |
|     desaturated, with a paper-        |
|     polaroid frame )                  |
|                                       |
|                                       |
|   "remember when [CAPTION]?"          |   <- handwritten font, 20px
|                                       |
|        [ tap anywhere to continue ]   |   <- ghost, 13px, bottom
|                                       |
+---------------------------------------+
```

- Tap anywhere advances. Auto-advance after 8s if untouched (prevents stalls).

### 1.7 Finale screen

See §7 for the assembly animation. Final state:

```
+---------------------------------------+
|                                       |
|        YOU ABSOLUTE LEGEND.           |
|                                       |
|     +-----------------+               |
|     |                 |               |
|     |    [ FULL QR ]  |               |   <- ~70% screen width, white bg, 24px padding
|     |                 |               |
|     +-----------------+               |
|                                       |
|   show this at the locker.            |   <- instruction copy
|   [LOCKER_LOCATION_HINT]              |
|                                       |
|   [ brightness: max ] auto-set        |   <- if we can; otherwise hint
|                                       |
|   [ save QR to photos ]               |   <- secondary
|   [ open easybox map ]                |   <- secondary
|                                       |
+---------------------------------------+
```

- **NB / ambiguity for user to resolve:** EasyBox flow is typically *user scans locker's QR* not the other way around. So the "QR" here is more likely a URL/code/instruction sheet rendered as a QR for convenience. The UI treats it as "the thing you show / open at the locker" and leaves the semantic open in config (`finale.qrPayload: string` + `finale.instruction: string`). Resolve before launch.

### 1.8 Error states

#### GPS denied / unavailable
```
+---------------------------------------+
|                                       |
|   well that's awkward.                |
|                                       |
|   your phone won't tell me where      |
|   you are. no big deal — every        |
|   stop has a code taped to it.        |
|                                       |
|   keep an eye out, type it in.        |
|                                       |
|   [ ok, continue ]                    |
|                                       |
+---------------------------------------+
```
- Inline, non-blocking. Routes back to the location screen with manual code field expanded and labeled clearly.

#### Wrong code entered
- Input shakes (200ms, ±6px), turns coral, label flips to:
```
nope. that's not it. count the letters again, champ.
```
- Resets to neutral on next keystroke.

#### GPS in range but flaky (accuracy > 100m)
- Status line under the pulse: `your phone's a bit lost. waving at satellites...` Don't auto-advance until accuracy < 50m for 2 consecutive reads.

#### Offline / network drop
- Toast at top: `you're offline. that's fine, we cached everything. keep going.`

---

## 2. The reveal animation

**Primary idea — "Photo Develops + Snaps Into Grid":**

The QR slice materializes in the center of the screen as if a polaroid is developing (blurry → sharp, 0% → 100% opacity, slight scale 0.8 → 1.0), then physically *flies* up into its cell in the 3-grid scaffold at the top. Confetti bursts at the moment of snap. Haptic tap on the snap.

**Timeline (total 3.6s):**

| t (s) | event | motion primitive |
|---|---|---|
| 0.0 | Full-screen takeover, background dims to plum, "GOTCHA." text fades in from y+12 | `motion.div` opacity + y, `transition: { duration: 0.4, ease: 'easeOut' }` |
| 0.4 | Slice appears centered, blurred (`filter: blur(12px)`), opacity 0 | initial state |
| 0.4 → 1.4 | Develops: blur 12→0, opacity 0→1, scale 0.8→1.0 | `animate={{ filter: 'blur(0)', opacity: 1, scale: 1 }}` `transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}` |
| 1.4 → 1.6 | Tiny held breath, slight scale pulse 1.0 → 1.04 → 1.0 | keyframes |
| 1.6 → 2.4 | Slice flies up to its grid cell (FLIP-style — measure target rect, animate `x`/`y`/`scale` to it) | `motion` `layoutId="qr-slice-N"` is cleanest: the slice has the same `layoutId` as the scaffold cell, Framer auto-tweens between them. `transition={{ type: 'spring', stiffness: 280, damping: 26 }}` |
| 2.2 | Confetti burst at target cell. ~40 particles, coral + cream + plum, 1.2s lifetime | `canvas-confetti` library or hand-rolled with `motion` particles |
| 2.4 | Haptic tap (`navigator.vibrate(30)` on Android; iOS Safari ignores, that's fine) | — |
| 2.6 | "1 down. 2 to go." copy fades in | opacity 0→1, 0.3s |
| 3.2 | CTA "on to stop 2 →" slides up from bottom | y: 40→0, opacity 0→1, 0.4s |

**Library mapping (Framer Motion / `motion`):**

- `<AnimatePresence>` wraps the reveal overlay.
- `<motion.div layoutId={`qr-slice-${n}`}>` is the magic — same `layoutId` on the centered slice and the scaffold cell auto-animates the flight.
- `useAnimate()` for the develop sequence (blur + scale + opacity keyframes).
- Confetti: `canvas-confetti` (4kb, no React wrapper needed, fire from a ref).

**Alternative — "Decoding Glitch":**

Slice appears as a grid of random black/white cells (like a corrupted QR), and over 1.2s the cells "settle" into the correct pattern, row-by-row, with a subtle CRT scanline overlay and a faint glitchy chromatic-aberration on the edges. More cyber, less warm. Pick this if the final palette goes neon-arcade instead of warm-festive.

**Recommendation:** Photo-develops. It matches the warm palette, leaves room for the polaroid metaphor that ties into the photo interstitials, and the FLIP-into-grid is genuinely satisfying.

---

## 3. Copy bank

All copy in English, friend-banter register. Translate to Romanian later — keep placeholders intact.

### Intro / greeting

```
HEY [FRIEND_NAME]. I HID YOUR GIFT. GOOD LUCK.
```
```
[FRIEND_NAME], you're [AGE] today and somehow still my problem. let's go.
```
```
three stops. three clues. one locker. don't embarrass us.
```

### Hint teasers (always-visible cryptic line)

```
the place where the lions pretend they're not bored.
```
```
where the trams go to think about their life choices.
```
```
the bench where you made That Phone Call in 2022.
```

### Real-hint reveals (after "stuck?")

```
fine. here it is. go to [LOCATION_1_NAME]. look near the [LANDMARK_DETAIL]. code's taped behind it.
```

### GPS status — getting closer

```
warmer.
much warmer.
you're basically on top of it. look around.
```

### GPS status — wandering

```
... colder. did you take a wrong turn?
you're going the wrong way, my guy.
bucharest is big. but not THAT big. check the hint.
```

### Success exclamations (reveal screen)

```
GOTCHA. 1 down. 2 to go.
```
```
look at you, navigating. slice 2 unlocked.
```
```
THREE FOR THREE. ok now the real test.
```

### Error / oops

```
nope. that's not it. count the letters again, champ.
```
```
your phone won't share your location. cool. cool cool cool. type the codes instead.
```
```
you're offline. that's fine, we cached everything. keep going.
```

### Photo interstitial captions

```
remember when [CAPTION_1]? me neither. allegedly.
```
```
exhibit A: the witnesses. they all chipped in.
```

### Finale

```
YOU ABSOLUTE LEGEND. show this at the locker.
```
```
the gift is inside. don't shake it. happy birthday, you menace.
```

---

## 4. The hint mechanic

**Two-tier, always.**

**Tier 1 — Teaser (always visible):** a single italic sentence, cryptic but referentially honest. Should make him squint and grin, not give up. Aim for 60% solve rate without tier 2 from someone who knows Bucharest well.

> "the place where the lions pretend they're not bored." → Muzeul Antipa / Grădina Zoologică style reference.

**Tier 2 — Real hint (one tap):** explicit location name + a specific landmark detail to find the code at. Shown in a slide-up sheet with a "open in maps" deep link.

> "go to [LOCATION_1_NAME]. look near the [LANDMARK_DETAIL]. code's taped behind it."

**Design rationale:** The tap-to-reveal gates the spoiler so he gets credit for trying, but the button is *always* one tap away. No timed unlock, no "you must wander for 5 minutes first" — that's frustration-by-design and this is a gift, not a CAPTCHA.

**Per-location config shape:**
```ts
locations: [
  {
    teaser: "the place where the lions pretend they're not bored.",
    realHint: "go to [LOCATION_1_NAME]. look near the [LANDMARK_DETAIL]. code's taped behind it.",
    locationName: "Muzeul Antipa",
    landmarkDetail: "the dinosaur skeleton sign",
    coords: { lat: 44.4541, lng: 26.0859 },
    radiusMeters: 50,
    fallbackCode: "LION",
  },
  ...
]
```

---

## 5. GPS UX

### 5.1 Permission preface

See §1.2. Key line:

```
i'm not tracking you, your phone is. i just listen.
```

This single sentence does more for consent than any UX pattern. It's honest and slightly funny.

### 5.2 Live distance indicator — the "warmth pulse"

**No meters. No compass. No progress ring.** Reasoning: he's playing a game, not navigating Glovo. Numbers create anxiety; vague warmth creates curiosity.

A single circular pulse, ~120px diameter, that:

- **Color:** transitions from cool blue (`>500m`) → cream (`200m`) → coral (`<50m`).
- **Scale pulse rate:** slow heartbeat (1.2s cycle) when far, fast (0.5s cycle) when close. Maps inversely to distance.
- **Glow:** soft outer shadow that intensifies with proximity.

Status line below the pulse, max 4 states (avoid noise):

| Distance | Status |
|---|---|
| `>500m` | `somewhere out there.` |
| `200m – 500m` | `getting warmer...` |
| `50m – 200m` | `much warmer.` |
| `<50m` | `you're basically on top of it. look around.` |

Reads update on a debounced `watchPosition` (every 3s or 10m of movement, whichever first).

### 5.3 Fallback code entry

**Always visible from the start.** Small, beneath a divider, labeled `got a code from the spot? [ ____ ] [ unlock ]`. 4-char alphanumeric, monospace input, auto-uppercases.

**Why always visible:** removes the "did GPS fail?" anxiety entirely. If he finds the code first and types it, great — we don't gatekeep the experience on a sensor we don't control. If he never uses it, fine — it's a small visual element.

Codes are short, memorable, themed per location (`LION`, `TRAM`, `BENCH`). Validation is client-side from config; no need for a server.

---

## 6. Progress visualization

A persistent 3-cell scaffold at the top of every gameplay screen. This is *also* where QR slices land after each reveal — progress bar and QR puzzle are the same component. Two birds, one elegant UI.

```
[ 1 ][ 2 ][ 3 ]
 ▓    □    □
```

- **Empty cell (□):** dashed plum border, faint number in the center.
- **Active cell (current step):** solid coral border, pulsing softly.
- **Completed cell (▓):** filled with the actual QR slice image, no number.

As he completes steps, the scaffold visibly fills with the QR puzzle. By step 3, he can almost see what the assembled QR looks like — which is delicious foreshadowing.

Size: ~60px per cell, 12px gap, centered, top of screen below safe area. Sticky on scroll (but very little scrolls).

---

## 7. The finale

### Animation: "The Snap"

Triggered the instant slice 3 lands in its cell. Total ~5s.

| t (s) | event |
|---|---|
| 0.0 | Slice 3 has just snapped into cell 3. Confetti is still settling. |
| 0.5 | Scaffold (3 cells with gaps) starts to *enlarge* — `layoutId` again, the whole scaffold container animates from 60px cells to ~ 100vw, moving to screen center. Gaps shrink to 0. The 3 slices visually become one QR. |
| 1.5 | Final QR is now full-size, centered, white background, big chunky rounded corners on the container. |
| 1.8 | A subtle "scan-line sweep" once, top to bottom, 800ms, low-opacity coral, like a scanner confirming. |
| 2.6 | Headline "YOU ABSOLUTE LEGEND." fades in above. |
| 3.0 | Instruction copy fades in below: `show this at the locker. [LOCKER_LOCATION_HINT]` |
| 3.4 | Secondary CTAs appear: `[ save QR to photos ]` `[ open easybox map ]` |
| 4.0 | Big confetti burst, 80 particles, full screen, 2s lifetime. Haptic. |
| 4.5 | If we can: `screen.brightness` is not a standard API, so we instead show a tiny hint `tip: max your brightness for the scanner`. |

**QR display specs:**
- ~70% of viewport width, square, centered.
- White background (`#FFFFFF`), 24px inner padding.
- 12px rounded corners on the container.
- High contrast, no decorative overlay on the QR itself (scanability first).
- A small coral "ribbon" graphic at the top-left of the QR card to keep it from looking sterile.

### Semantic ambiguity (flag for user)

EasyBox lockers display their *own* QR for users to scan — the user doesn't scan their phone *into* the locker. So the "final QR" here is most likely:

- **Option A:** A QR encoding a URL to the EasyBox tracking page (with the parcel ID), which he opens with his phone's camera to navigate to.
- **Option B:** A QR encoding a plain-text unlock code that he reads off the screen and types into the locker's keypad.
- **Option C:** Just a static image of the locker location + the parcel code, with the "QR" being decorative.

**Recommendation:** treat the QR as Option A (URL to the parcel tracking page). Config field: `finale.qrPayload: string` and `finale.instruction: string`. Resolve at config-fill time.

---

## 8. Photo-card hooks

**Slot placement:** between the reveal of step N and the location screen of step N+1. So the flow is:

```
location screen 1 → reveal 1 → [optional photo card after step 1] → location screen 2 → ...
```

Photo cards are non-blocking and skippable. If `photos` is empty, the flow is just step → reveal → next step.

**Why between steps:** the reveal is the emotional high; the photo card extends it before he has to start working again. Feels like a victory lap, not a tax.

**Config shape:**
```ts
photos: [
  {
    src: "/photos/01-throwback.jpg",
    caption: "the bachelor party. nobody talks about it.",
    afterStep: 1,
    durationMs: 8000,  // auto-advance fallback
  },
  {
    src: "/photos/02-group.jpg",
    caption: "the witnesses. they all chipped in for this.",
    afterStep: 2,
  },
]
```

**Visual treatment:**
- Full-bleed image, slight desaturation filter (CSS `filter: saturate(0.9) contrast(1.05)`).
- Polaroid-style frame: 12px white border top/sides, 60px bottom for caption.
- Caption in handwritten font (see §10).
- Gentle Ken Burns effect: 10s zoom from 1.0 → 1.05 on the image. Keeps the screen alive without being demanding.

**Final-touch slot (post-finale):** also support `afterFinale: true` for a group photo that appears after he sees the QR — the "look who came together for this" moment. Same component, no auto-dismiss.

---

## 9. Test mode UI

**Activation:** controlled by a single config flag `testMode: true` OR a query param `?test=1`. In production, both default to false and the entire debug surface is dead code (tree-shaken).

**Visual:**

```
+---------------------------------------+
| [ 1 ][ 2 ][ 3 ]              ( ⚙ )   |
|                                       |
|   ... normal screen ...               |
|                                       |
|                                       |
|                            ┌────────┐ |
|                            │  TEST  │ |   <- floating badge, bottom-right
|                            └────────┘ |       coral background, cream text,
+---------------------------------------+       12px, slight shadow, pulsing
                                                opacity 0.7↔1.0
```

**Interaction:**

- **Tap badge** → expand to a compact pill: `TEST · step 2/3`
- **Long-press badge (500ms)** OR tap pill → slide-up debug drawer:

```
+---------------------------------------+
|     ===                               |
|                                       |
|   TEST MODE                           |
|                                       |
|   current step:    2                  |
|   GPS:             simulated          |
|   distance:        12m                |
|                                       |
|   [ skip to step 1 ]                  |
|   [ skip to step 2 ]                  |
|   [ skip to step 3 ]                  |
|   [ skip to finale ]                  |
|                                       |
|   [ simulate at location ]            |
|   [ simulate far away ]               |
|   [ trigger reveal now ]              |
|                                       |
|   [ reset progress ]                  |
|   [ close ]                           |
|                                       |
+---------------------------------------+
```

**Behavior notes:**
- "Simulate at location" mocks `watchPosition` to return the current step's coords with 5m accuracy. Useful for demoing the whole flow from a desk.
- "Trigger reveal now" bypasses GPS entirely and fires the reveal animation for the current step.
- "Reset progress" clears localStorage and routes to intro.
- Badge stays visible across all screens including the finale (so a demo can be re-run instantly).

---

## 10. Color / vibe direction

Three palette options. **Recommend Option A — "Confetti Dusk."**

### Option A — Confetti Dusk (recommended, warm-festive)

| role | hex | notes |
|---|---|---|
| background | `#1F1430` | deep plum, not pure black, warmer |
| surface | `#2B1C42` | one step lighter for cards |
| primary accent | `#FF6B5B` | hot coral, used for CTAs, active states, reveal moments |
| secondary | `#FFD89C` | butter cream, used for headlines and warm highlights |
| text | `#F5EBD9` | off-white, never pure white |
| muted text | `#8B7AA0` | dusty lavender |
| success / "warmer" | `#FFB347` | apricot |
| error / "colder" | `#7CA9FF` | cool blue (intentionally inverted — "cold" is literal) |

**Fonts:**
- **Display:** Fraunces (Google Fonts, variable, optical sizes). Slightly weird serif with personality. Use for headlines and step labels.
- **Body:** Inter (Google Fonts, 400/500/700). Clean, neutral, lets Fraunces do the work.
- **Handwritten / captions:** Caveat (Google Fonts). Used sparingly for photo captions only — overuse kills it.

**Why this wins:** matches "warm roast" tone perfectly. Looks like a handmade gift, not a SaaS dashboard. The coral pops on a dark background in any lighting condition (he'll be outdoors, possibly in sun).

### Option B — Neon Arcade (cyber)

| role | hex |
|---|---|
| background | `#0A0E27` |
| accent 1 | `#00F5FF` (cyan) |
| accent 2 | `#FF00AA` (magenta) |
| text | `#E0E0FF` |

Fonts: Space Grotesk (display) + JetBrains Mono (body/UI). Pair with the "decoding glitch" reveal alternative. Picks the "video game easter egg" lane.

### Option C — Treasure Map (handcrafted)

| role | hex |
|---|---|
| background | `#F5E6CC` (parchment) |
| ink | `#3A2818` (sepia brown) |
| accent | `#C0392B` (oxblood red) |
| highlight | `#D4A949` (gold) |

Fonts: IM Fell English (display, looks like an old book) + Caveat (handwritten). Treasure-map vibe. Risk: too on-the-nose, and parchment-on-white is harsh in bright sunlight.

---

## 11. Mobile-first details

### Viewport

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
```

`viewport-fit=cover` is critical — it lets us draw under the iOS notch and home indicator areas. We then use `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` in CSS to pad content correctly.

### Safe areas

- Top: scaffold/progress bar sits *below* `env(safe-area-inset-top)`, so it's never under the notch.
- Bottom: primary CTA sits *above* `env(safe-area-inset-bottom)` + 16px, so it's reachable by thumb and never under the iOS home indicator.

### Tap targets

- Minimum 44×44px (Apple HIG). All buttons 56px tall in primary, 48px in secondary.
- Manual-code input field: 48px tall, 24px font, monospace, auto-uppercase, autocomplete off, inputmode `text`.
- "Stuck?" ghost button is full-width — easy thumb tap.

### Orientation

- **Lock to portrait** via CSS: `@media (orientation: landscape) { ... }` shows a friendly "rotate me" screen rather than trying to reflow. The Web doesn't give us a real orientation lock, but a covering screen with `please flip your phone — this hunt only works portrait` does the job.
- Rotation lock screen copy: `nope. portrait only. flip me.`

### Backgrounding / tab visibility

- `watchPosition` keeps running in modern Chrome/Safari for a while after backgrounding, but unreliable.
- Use `document.visibilityState === 'hidden'` to:
  1. Cancel the `watchPosition` to save battery.
  2. On `visible` again, re-issue `watchPosition` and re-evaluate distance.
  3. If he was close enough while away but we missed the threshold, we *don't* retroactively trigger reveal — feels weird. Instead, on resume we show a small toast: `welcome back. you were close — keep going.`

### Persistence

- `localStorage`: `{ currentStep, completedSteps[], qrSlicesUnlocked[], startedAt }`. Survives refresh, accidental tab close, and (importantly) phone running out of battery mid-hunt.
- On resume, the app routes him to his current step. No "continue?" prompt — just dump him back in, with a tiny toast: `picking up where you left off.`

### Battery / GPS politeness

- `watchPosition` options: `{ enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }`.
- Stop watching as soon as he completes a step. Restart on next step's location screen.
- One watch at a time, ever.

### Performance budget

- Initial bundle: aim < 150kb gzipped. The full hunt is 3 screens; we don't need a SPA framework's worth of code.
- All photos: lazy-loaded, max 1200px wide, WebP with JPEG fallback, < 200kb each.
- QR slices: SVG or PNG, < 10kb each. Final assembled QR is rendered client-side from a single payload string at finale time (using `qrcode` lib, ~6kb) — avoids needing pre-sliced assets at all if we generate slices by masking the full QR. Cleaner.

### Accessibility (because it's still nice)

- All animations respect `prefers-reduced-motion`: fall back to opacity-only fades, no flight, no confetti.
- Color contrast on coral-on-plum: 5.8:1, passes AA for large text.
- All buttons have aria-labels. The GPS pulse has `aria-live="polite"` on the status line so a screen reader narrates `getting warmer...`.

---

## Open questions for the user

1. **Final QR semantic:** is it a URL, an unlock code, or decorative? (See §7.) This unlocks the `finale.qrPayload` config shape.
2. **Locations:** confirm the 3 Bucharest spots and their radii. 50m default is fine for most landmarks but tight for big parks.
3. **Photos:** how many, which slots? Empty config is fine.
4. **Language:** ship in English first, translate to Romanian after content is locked? Or RO from day one?
5. **Sound:** any sound on reveal / finale? Currently designed silent (mobile is muted-by-default anyway, and a stranger's phone blasting "ta-da!" in public is rude). Confirm.
