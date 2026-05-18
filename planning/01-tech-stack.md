# 01 — Tech Stack

Birthday treasure hunt single-page app, hosted on GitHub Pages, used by one friend on his phone in Bucharest. Three geolocated checkpoints, each unlocks one slice of a QR that opens a Sameday EasyBox locker.

---

## TL;DR — Final Stack

- **Vite 5 + React 18 + TypeScript** — fast, zero-config, deploys to GH Pages cleanly (mind the `base` flag).
- **`motion` (formerly Framer Motion) v11** for animations; tiny enough, declarative, runs circles around CSS for slice-reveal and confetti finale.
- **Native `navigator.geolocation.watchPosition`** + inlined Haversine; no wrapper lib needed.
- **`qrcode` npm package** at build time to generate the final QR PNG; **ship one PNG and slice it client-side on `<canvas>`** to keep config single-source.
- **localStorage** for progress + **simple `useReducer` state machine** (no router, no Zustand). **WebCrypto AES-GCM** decrypts each slice using the fallback code as the key — so the repo leaks ciphertext, not the QR.

---

## 1. Bundler / Framework — **Vite 5 + React 18**

**Pick: Vite.** CRA is dead (deprecated by React team in 2025). Next.js static export works but drags in routing/SSR concepts this app doesn't need. Vite is one `npm create vite@latest` command, has the smallest production bundle for a 3-screen SPA, and HMR is instant.

**GH Pages gotcha — the `base` path.** For a *project page* served at `https://<user>.github.io/birthday-hunt/`, all asset URLs must be prefixed. Set in `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/birthday-hunt/', // MUST match repo name, trailing slash required
});
```

Skip this and you get a blank page with 404s on every JS/CSS asset. Also add a `404.html` that's a copy of `index.html` if you ever use client routing — but we're not (see §7), so this isn't needed.

**Versions to install:**
- `vite@^5.4`
- `react@^18.3`, `react-dom@^18.3`
- `@vitejs/plugin-react@^4.3`
- `typescript@^5.5`

---

## 2. Language — **TypeScript**

**Pick: TypeScript.** The config object has nested coordinates, optional fields, and a state machine with discriminated unions — TS catches typos in fallback codes and prevents `undefined.latitude` crashes mid-hunt. Build cost is zero (Vite handles it), and a few-hundred-line app stays well inside what TS helps with rather than hinders.

---

## 3. Animation — **`motion` (Framer Motion v11+)**

**Pick: `motion`** (`npm i motion` — note the package was renamed from `framer-motion` in late 2024; both names still publish but use `motion` going forward). Tree-shakes to ~30 KB gzipped if you only import `motion` + `AnimatePresence`. CSS-only is tempting but you'll fight it for the slice-reveal sequence (stagger, spring on the QR assembling itself, exit animations between screens). GSAP is overkill and 2x the bundle.

Use cases that justify it here:
- Intro screen letters cascading in.
- Each slice "snapping" into place when unlocked (spring physics).
- Page transitions between checkpoint screens via `AnimatePresence`.
- Confetti / shake / pulse on the final reveal — pair with `canvas-confetti` (~5 KB) for the finale.

---

## 4. Geolocation — **Native `watchPosition` + inline Haversine**

**Pick: native API, no wrapper.** Wrapper libs (`react-geolocated`, etc.) add weight for a hook you can write in 20 lines. HTTPS is required by browsers for geolocation — GH Pages serves HTTPS by default, so we're fine.

**Permission-denied UX:** if `error.code === 1` (PERMISSION_DENIED), surface a friendly screen with the manual fallback code input prominently displayed. Don't nag-retry — one polite "Allow location or type the secret code" message.

**Haversine distance (meters), inline:**

```ts
// Returns great-circle distance in meters between two lat/lng points.
export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
```

**Watch hook sketch:**

```ts
function useGeoWatch(onPos: (p: GeolocationPosition) => void) {
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      onPos,
      (err) => console.warn('geo error', err),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 10_000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [onPos]);
}
```

Phone GPS accuracy is typically 10–30m outdoors in Bucharest, so a **50m radius is the right floor**. Go tighter (e.g., 20m) and you'll fail false-negative under tree cover.

---

## 5. QR Handling — **`qrcode` lib + ship-one-PNG + canvas slicing**

**QR generation (build time): `qrcode`** (`npm i qrcode` + `npm i -D @types/qrcode`). Mature, ~10 KB, can write PNG to disk via a Node script.

**Build script** (`scripts/gen-qr.mjs`, run via `"prebuild": "node scripts/gen-qr.mjs"`):

```js
import QRCode from 'qrcode';
await QRCode.toFile('src/assets/final-qr.png', process.env.QR_PAYLOAD, {
  width: 900, margin: 2, errorCorrectionLevel: 'H',
});
```

Use **error correction level H** (~30% recovery) so the slice boundaries / any rendering artifacts still scan reliably. `QR_PAYLOAD` comes from a GitHub Actions secret (see §10).

**Slicing strategy — ship ONE PNG, slice on `<canvas>` client-side.**

Trade-offs:

| Approach | Pros | Cons |
|---|---|---|
| Pre-slice 3 PNGs at build time | No client math; trivial to reveal | 3 separate files = 3 separate things to encrypt; harder to swap QR |
| **Ship 1 PNG, canvas-slice client-side** | Single source of truth; single ciphertext to manage; trivially adjust slice geometry | Tiny bit of canvas code |

The canvas approach wins because in §10 we encrypt the PNG once and decrypt slices progressively from the *same* decrypted bitmap as codes arrive. With 3 separate files you'd manage 3 keys or duplicate the same key 3x, which is silly.

**Slicing sketch** (vertical thirds):

```ts
function sliceThird(img: HTMLImageElement, index: 0 | 1 | 2): string {
  const c = document.createElement('canvas');
  const w = img.width, h = img.height;
  c.width = Math.ceil(w / 3); c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, -index * (w / 3), 0);
  return c.toDataURL('image/png');
}
```

Diagonal/jigsaw slices look cooler — easy upgrade later by clipping a path before `drawImage`.

---

## 6. State / Persistence — **`useReducer` + localStorage**

**Pick: native `useReducer` + a tiny `useLocalStorageSync` hook.** Zustand/Redux are absurd here. The state is 4 fields:

```ts
type HuntState = {
  unlocked: [boolean, boolean, boolean]; // which checkpoints done
  currentStep: 0 | 1 | 2 | 3 | 4;        // 0=intro, 1–3=checkpoints, 4=finale
  testMode: boolean;
};
```

Persist to `localStorage` on every dispatch so a phone reload / accidental tab close doesn't reset him mid-hunt. Hydrate on mount; if hydration fails (corrupt JSON), fall back to fresh state and log silently.

```ts
const STORAGE_KEY = 'bday-hunt-v1';
const load = (): HuntState | null => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
  catch { return null; }
};
```

Bump the `-v1` suffix if the schema ever changes so old state gets discarded.

---

## 7. Routing — **No router. State machine in one component.**

**Pick: no router.** With 5 "screens" (intro → 3 checkpoints → finale) and a strict linear flow, `react-router` adds 15 KB and zero value — there's no back button semantic, no deep links to share (we *don't want* deep links; he shouldn't be able to URL-jump to the finale). A single `<App>` that renders one of five components based on `state.currentStep` is cleaner and disables URL skipping for free.

Exception: in test mode, render small dev-only buttons that dispatch `JUMP_TO_STEP` actions.

---

## 8. Config File — `src/config.ts`

Single TypeScript file, typed, edited by hand. No JSON — TS gives autocomplete and catches missing fields.

```ts
// src/config.ts
export type Checkpoint = {
  id: 1 | 2 | 3;
  name: string;          // shown in UI
  hint: string;          // shown before he arrives
  lat: number;
  lng: number;
  radiusMeters: number;  // success threshold
  fallbackCode: string;  // typed manually if GPS fails; ALSO the AES key (§10)
  successCopy: string;   // shown after unlock
};

export type HuntConfig = {
  friendName: string;
  introCopy: string;
  checkpoints: [Checkpoint, Checkpoint, Checkpoint];
  finalQrImagePath: string;   // bundled asset, encrypted (§10)
  finalQrPayload?: string;    // optional: if set, build script regenerates the QR
  finaleCopy: string;
  finaleSubcopy: string;
};

export const config: HuntConfig = {
  friendName: 'Andrei',
  introCopy: "La mulți ani, frate! 🎂 Cadoul tău e ascuns într-un EasyBox prin oraș. Trei opriri. Trei piese de puzzle. O singură șansă să nu te rătăcești prin Cișmigiu. Hai!",

  checkpoints: [
    {
      id: 1,
      name: 'Piața Universității',
      hint: 'Acolo unde studenții pretind că învață și porumbeii chiar conduc orașul. Lângă statuia lui Mihai Viteazul.',
      lat: 44.4353,
      lng: 26.1015,
      radiusMeters: 50,
      fallbackCode: 'MIHAI-1600',
      successCopy: 'Bravo! O treime din comoară e a ta. Următoarea oprire: un parc unde rațele au mai multă demnitate decât unii politicieni.',
    },
    {
      id: 2,
      name: 'Parcul Cișmigiu',
      hint: 'Intrarea principală dinspre Bulevardul Regina Elisabeta. Caută banca de lângă lac unde te-am văzut odată dormind.',
      lat: 44.4360,
      lng: 26.0925,
      radiusMeters: 50,
      fallbackCode: 'RATA-LEBADA',
      successCopy: 'Două din trei. Aproape ești demn de cadou. Ultima oprire: ceva clasic, ceva impozant, ceva unde George Enescu și-a făcut treaba.',
    },
    {
      id: 3,
      name: 'Ateneul Român',
      hint: 'Clădirea rotundă cu coloane care arată ca o nuntă grecească. Stai în fața intrării principale.',
      lat: 44.4414,
      lng: 26.0973,
      radiusMeters: 50,
      fallbackCode: 'ENESCU-FOREVER',
      successCopy: 'GATA! Toate piesele sunt ale tale. QR-ul de mai jos deschide EasyBox-ul. Scanează-l. Mergi. Nu plânge în public.',
    },
  ],

  finalQrImagePath: '/assets/final-qr.enc', // ciphertext blob, not a plain PNG
  finalQrPayload: 'https://easybox.sameday.ro/locker/XXXXXX?code=YYYYYY', // placeholder
  finaleCopy: 'CADOUL TĂU TE AȘTEAPTĂ',
  finaleSubcopy: 'Scanează QR-ul, găsește EasyBox-ul, deschide-l. Apoi sună-mă să-mi spui ce e înăuntru, că am uitat.',
};
```

**Coordinates** are public-knowledge approximations from OpenStreetMap; verify on site before the actual hunt and tighten/loosen `radiusMeters` after a walk-test.

---

## 9. Test Mode — **URL flag `?test=1` + localStorage sticky**

**Pick: `?test=1` query param**, which then sets `localStorage['bday-hunt-test'] = '1'` so it survives the next reload without needing the URL again. The friend will never type `?test=1`; the dev opens `https://<user>.github.io/birthday-hunt/?test=1` once on his laptop and stays in test mode for the whole dev session.

**Why not env var:** can't toggle on a production build from the deployed phone.
**Why not hidden long-press:** cute but the friend might accidentally hit it, and you can't share "long-press 5s on the title" with future-you when debugging.

```ts
function detectTestMode(): boolean {
  const url = new URLSearchParams(window.location.search);
  if (url.get('test') === '1') {
    localStorage.setItem('bday-hunt-test', '1');
    return true;
  }
  if (url.get('test') === '0') {
    localStorage.removeItem('bday-hunt-test');
    return false;
  }
  return localStorage.getItem('bday-hunt-test') === '1';
}
```

**What test mode does:**
- Bypasses the GPS check (always returns "within radius").
- Renders a dev panel with: "Skip to checkpoint 1/2/3/finale", "Reset progress", "Show coords overlay".
- Shows the decrypted QR slices even without entering codes.
- Does NOT auto-unlock — you still trigger unlocks manually, so you can rehearse the animations.

Clear the flag with `?test=0` before sending the link to the friend. Better: have your prod deploy URL be the bare one and only share `?test=1` with yourself.

---

## 10. Anti-Cheat / Obscurity — **WebCrypto AES-GCM, codes-as-keys**

This is the only category where being lazy costs you the gift. GH Pages is fully public; anyone who finds the repo (or just inspects the deployed `/assets/`) can grab whatever's bundled. Options compared:

| Option | Security | Effort | Verdict |
|---|---|---|---|
| Trust obscurity (random filenames, private-ish repo) | Zero — `view-source` and a `<img>` tag find it instantly | Lowest | **No.** Fails the "don't expose credentials" bar. |
| External host (Gist, Imgur) | Still public URL — once leaked, leaked | Low | Marginal improvement; just moves the problem |
| GitHub Actions secret + build-time injection | Bundled output still public after build | Low | Doesn't help — the artifact is what's served |
| **WebCrypto AES-GCM, fallback codes as keys** | Real — slice ciphertext is useless without the code | Medium (~50 LOC) | **Pick this.** |

### How it works

1. **Build-time encryption** (run once locally, OR in GH Actions with the payload as a secret):
   - Generate the final QR PNG from `QR_PAYLOAD`.
   - Slice the PNG into 3 vertical thirds (or just keep whole and slice client-side after decrypt — see below).
   - For each slice `i`, derive a key from `checkpoints[i].fallbackCode` via PBKDF2 → AES-GCM-256, encrypt the slice bytes, write `slice-i.enc` to `public/assets/`.
   - Commit only the `.enc` files. The raw PNG never enters the repo.

2. **Runtime decryption:** when the user unlocks checkpoint `i` (via GPS or by typing `fallbackCode`), the app already has the code in memory → derive the same key → fetch `slice-i.enc` → decrypt → render to `<img>`.

3. **GPS-unlock path:** the GPS check effectively *also* "knows" the code, because the checkpoint config maps `id → fallbackCode` and the app holds the config. This is fine: an attacker reading the bundle gets the config (so they know what codes exist), but the codes are only useful at the right location OR if typed manually — and the QR slice they decrypt is rate-limited by needing all 3 codes anyway.

**Wait — if the code is in the JS bundle, isn't it already exposed?**

Yes, technically. But:
- The bundle is minified; the code constants aren't labeled `FALLBACK_CODE_1`.
- An attacker has to (a) find the repo, (b) read your minified JS, (c) extract three codes, (d) decrypt three blobs, (e) reassemble the QR, (f) realize what locker it opens, (g) drive to it. That's a level of effort no one is putting in for a friend's birthday gift.
- The realistic threat is "friend's curious cousin finds the link and pokes around" — encryption defeats that completely (the assets folder shows `slice-*.enc`, opaque binary). Encryption raises the bar from "right-click → save image" to "reverse-engineer the app", which is the right bar for this project.

**Even better (optional hardening):** put the `fallbackCode` strings in the bundle as their PBKDF2 *hashes* only. The app compares typed input's hash to the stored hash to validate the code, then uses the typed input itself (not the hash) as the key material. Now the bundle never contains the cleartext code at all. This is the "pretty good" tier — pick it up if you have an extra hour.

### Code sketch

```ts
// crypto.ts
const SALT = new TextEncoder().encode('bday-hunt-v1'); // fine to be static for this project

async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase),
    'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt', 'decrypt']
  );
}

export async function decryptSlice(
  encryptedBlob: ArrayBuffer, code: string
): Promise<Blob> {
  const iv = new Uint8Array(encryptedBlob.slice(0, 12));
  const ciphertext = encryptedBlob.slice(12);
  const key = await deriveKey(code);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new Blob([plain], { type: 'image/png' });
}
```

Encryption is the inverse (generate random 12-byte IV, prepend to ciphertext).

---

## 11. Deployment — **GitHub Actions workflow**

**Pick: GitHub Actions (`actions/deploy-pages@v4`)**, not the `gh-pages` npm package.

Why:
- `gh-pages` requires committing built artifacts to a branch — messy, bloats git history.
- Actions can hold the `QR_PAYLOAD` and any other secrets and inject at build time.
- Native "Deployments" tab in GitHub shows status, rollback is one click.

**Workflow** (`.github/workflows/deploy.yml`):

```yaml
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run build
        env:
          QR_PAYLOAD: ${{ secrets.QR_PAYLOAD }}
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

**Repo settings:** Settings → Pages → Source = "GitHub Actions". Add `QR_PAYLOAD` under Settings → Secrets and variables → Actions.

The build step does: generate QR PNG from `QR_PAYLOAD` → slice → encrypt with fallback codes (read from `src/config.ts` — yes, those *are* in the repo, but the encrypted slices in `dist/` are what matters) → bundle.

---

## Open Decisions / Stuff to Decide Later

- **Slice geometry** — vertical thirds is easiest; jigsaw shapes via SVG clip-path looks cooler. Defer to UI phase.
- **Sound effects** — a little unlock chime per checkpoint would slap. Bundle two 5 KB OGGs. Optional.
- **Photos of the friend group** — the user said "future-touch". Reserve `checkpoint.photoPath` field in config; not adding yet.
- **i18n** — copy is in Romanian. No need for i18next; just write copy in Romanian and forget it.
- **Analytics** — none. Don't add a tracker for one user.

---

## Install Command (Reference)

```bash
npm create vite@latest birthday-hunt -- --template react-ts
cd birthday-hunt
npm i motion qrcode canvas-confetti
npm i -D @types/qrcode @types/canvas-confetti
```

That's the whole dependency tree. Six runtime/build packages. Done.
