# 03 — Hosting & Secrets Strategy

A pragmatic, layered plan for shipping a one-off birthday treasure hunt on GitHub Pages without leaking the gift to the open internet.

---

## TL;DR

- **"Credentials" here means three things**: the final EasyBox QR image (critical), the 3 fallback unlock codes (sensitive), and the 3 GPS coordinates (mildly sensitive). There are zero API keys or backend tokens in this app.
- **GitHub Pages on free tier = public bundle, public repo.** Anything in `dist/` is fetchable by URL; anything committed is visible to anyone who finds the repo. Accept this and design around it.
- **Recommended combo: Option C + Option D** — encrypt the QR slices at rest with WebCrypto (AES-GCM, PBKDF2-derived keys from the fallback codes), and deploy via a GitHub Actions workflow so the dev never does manual build steps. The fallback codes (written on physical clues at the Bucharest locations) become the decryption keys.
- **What's still exposed and that's fine**: the app structure, hint copy, the fact that there are 3 stops, and arguably the GPS landmark coords. None of these let an attacker grab the gift.
- **Runbook is 7 steps** end-to-end, all copy/pasteable. No surprises on deploy day.

---

## 1. What "credentials" actually means in this app

There is no backend. There is no Firebase, no Supabase, no third-party API key. When the user says "we don't want to expose credentials and shit," they're talking about **content secrets baked into a static bundle**:

| Asset | Sensitivity | Why |
|---|---|---|
| Final EasyBox QR image | **CRITICAL** | Whoever scans this opens the physical locker and walks off with the gift. |
| 3 fallback unlock codes | **HIGH** | Short codes (4-6 chars) shown on physical clues at each Bucharest stop. They double as the manual-entry fallback if GPS misbehaves. |
| 3 GPS coordinates | **LOW** | Public landmarks in Bucharest. Anyone can see them on a map. Mildly sensitive only because they reveal the route in advance and spoil the surprise. |
| Hint copy / UI strings | **NONE** | Funny text. Whatever. |
| App source code | **NONE** | The protocol design is not the secret. Kerckhoffs's principle applies. |

The mental model: **the QR is the only thing that, if leaked, ruins the gift**. Everything else just spoils flavor.

---

## 2. The public-by-default reality of GitHub Pages

A few hard facts to internalize before picking an option:

1. **The deployed bundle is public.** GitHub Pages serves `dist/` over HTTPS to anyone with the URL. There is no auth gate on the free tier. Anything in `dist/index.html`, `dist/assets/*`, or `dist/*.png` is `curl`-able by anyone who can guess or stumble onto the URL.
2. **On the free tier, the source repo backing a Pages site must be public.** Private repos with GitHub Pages require GitHub Pro, Team, or Enterprise. Confirmed as of 2026-05. So if you stay on free, the repo source is public too.
3. **"Hidden by URL" is not security.** GitHub's URL is `https://<user>.github.io/<repo>/` — predictable from the username and the repo name. If the repo is public on the user's profile, the URL is one click away.
4. **Browser DevTools sees everything.** Anything loaded by the SPA — every fetch, every asset, every decoded blob — is visible in the Network and Application tabs. Obfuscation buys nothing against a curious dev.

The implication: **anything you ship unencrypted in `dist/` is functionally public**. The only real protection is cryptography or not-shipping-it.

---

## 3. Option A — Private repo + GitHub Pages on free tier

**Status: OUT.**

GitHub Pages on private repos requires GitHub Pro ($4/month) or higher. For a one-off birthday gift, that's silly. Skip unless the user already has Pro.

If they did upgrade, this would only protect the **source** (anyone finding the live URL still sees the deployed bundle). So even with Pro, you'd still want Option C on top.

---

## 4. Option B — Public repo, just don't link it

**The lazy option.** Ship the repo public, don't link it from the live site, don't share the repo URL with anyone. The friend gets only the `https://<user>.github.io/<repo>/` link.

**Pros:**
- Zero extra engineering.
- The friend's nosy cousin would need to (a) know the dev's GitHub username, (b) guess this specific repo, and (c) read the source. Vanishingly unlikely.

**Cons:**
- The deployed `dist/qr.png` is still a direct URL. If anyone guesses the asset path, game over.
- GitHub's `<user>.github.io` profile lists pinned/public repos. A casual visitor to the dev's profile can see "birthday-hunt" or whatever it's named.
- Naming the repo something innocuous (`b-h-2026`, `weekend-project`) helps a little but is taping a sign over a window.

**Verdict:** Not enough. Combine with C at minimum.

---

## 5. Option C — Encrypt secrets at rest in the bundle (RECOMMENDED CORE)

The strongest pragmatic move: **the QR image is sliced into 3 parts, each encrypted with the corresponding fallback code as the key**. The repo and the deployed bundle contain only ciphertext. Decryption happens client-side in WebCrypto when the player either (a) types the correct fallback code, or (b) passes the GPS check (which programmatically supplies the code).

Why this works against the threat model:
- A repo cloner sees `encrypted-slice-1.bin`, `encrypted-slice-2.bin`, `encrypted-slice-3.bin`. No key material.
- The keys (fallback codes) live on **physical clues at Bucharest landmarks**, not in the repo.
- Even if someone reads all the source code, they can't reconstruct the QR without visiting the locations or guessing 3 short codes — and PBKDF2 with a high iteration count makes guessing painful enough that a casual attacker walks away.
- The friend, doing the hunt legitimately, gets the codes at each location and the app decrypts seamlessly.

### Crypto choices

- **Algorithm:** AES-GCM, 256-bit key, 12-byte IV, 16-byte auth tag (default).
- **KDF:** PBKDF2-HMAC-SHA256, 200,000 iterations, 16-byte random salt per slice.
- **Encoding:** binary `.bin` files, each = `salt (16) || iv (12) || ciphertext || tag (16)`.
- **Codes:** keep them short and memorable (e.g., `LIPA42`, `CARTE7`, `ROZE19`) — PBKDF2 iterations compensate for low entropy.

### Encrypt step — offline dev script (`scripts/encrypt-assets.mjs`)

```js
// Run once locally: node scripts/encrypt-assets.mjs
// Reads secrets/qr.png + secrets/codes.json, writes public/encrypted-slice-{1,2,3}.bin
import { webcrypto as crypto } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const ITERATIONS = 200_000;

async function deriveKey(code, salt) {
  const baseKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt']
  );
}

async function encryptSlice(plaintext, code) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(code, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
  const out = new Uint8Array(salt.length + iv.length + ct.length);
  out.set(salt, 0); out.set(iv, salt.length); out.set(ct, salt.length + iv.length);
  return out;
}

const qrBytes = await readFile('secrets/qr.png');
const { codes } = JSON.parse(await readFile('secrets/codes.json', 'utf8')); // ["LIPA42","CARTE7","ROZE19"]

// Simple slicing: thirds of the file. The app reassembles by concatenation.
const third = Math.ceil(qrBytes.length / 3);
const slices = [qrBytes.slice(0, third), qrBytes.slice(third, 2 * third), qrBytes.slice(2 * third)];

for (let i = 0; i < 3; i++) {
  const blob = await encryptSlice(slices[i], codes[i]);
  await writeFile(`public/encrypted-slice-${i + 1}.bin`, blob);
  console.log(`Wrote public/encrypted-slice-${i + 1}.bin (${blob.length} bytes)`);
}
```

### Decrypt step — in the React app (`src/lib/decrypt.ts`)

```ts
// Called when player provides code (manually or via GPS-derived code).
const ITERATIONS = 200_000;

async function deriveKey(code: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, ['decrypt']
  );
}

export async function decryptSlice(sliceUrl: string, code: string): Promise<Uint8Array> {
  const buf = new Uint8Array(await (await fetch(sliceUrl)).arrayBuffer());
  const salt = buf.slice(0, 16);
  const iv = buf.slice(16, 28);
  const ct = buf.slice(28);
  const key = await deriveKey(code, salt);
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new Uint8Array(pt);
  } catch {
    throw new Error('Wrong code'); // AES-GCM auth failure
  }
}

// Reassemble QR after all 3 slices decrypted:
export function reassembleQr(slices: Uint8Array[]): string {
  const total = slices.reduce((n, s) => n + s.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const s of slices) { out.set(s, off); off += s.length; }
  return URL.createObjectURL(new Blob([out], { type: 'image/png' }));
}
```

### GPS path → code

**Critical design note from the brief:** the GPS-only path must yield the same code as manual entry. Don't fork the logic. Treat the GPS check as an *automatic code-entry event*:

```ts
// src/lib/unlock.ts
const STOP_CODES = ['LIPA42', 'CARTE7', 'ROZE19']; // NOT shipped in the bundle —
// these are derived at runtime from a check, see below.

// WRONG: shipping STOP_CODES in source defeats the encryption.
// RIGHT: GPS check returns a boolean; if true, we still ask the player to
//        type the code (it's printed on the physical clue), OR we accept that
//        the GPS check itself is enough proof and ship a *second* layer:
//        a code-table encrypted with a hash of the GPS coords (rounded).
```

The cleanest version: **don't auto-derive the code from GPS**. The physical clue at each stop displays the code; the GPS check just unlocks the "enter code" UI (or shows a "you're here, code is on the clue" prompt). This keeps the code material out of the bundle entirely and avoids GPS-spoofing bypass.

If GPS auto-unlock is required (player too lazy to type), use a coarse-rounded GPS string (e.g., `44.4321,26.0967` rounded to 4 decimal places ≈ 11m) as the PBKDF2 input to decrypt a small lookup blob containing the code. Trades some security for UX. Document the tradeoff and ask the user.

---

## 6. Option D — Build-time injection via GitHub Actions secrets

Store the QR / codes as **repository secrets** in GitHub Settings → Secrets and variables → Actions. The deploy workflow writes them to disk at build time, then builds.

**Important:** the final `dist/` is still public. Build-time injection only keeps the secrets out of the **source repo**, not out of the **deployed site**. So this is a complement to C (encrypt before deploy), not a replacement.

Use case: the dev wants to push commits without ever having `secrets/qr.png` on disk in the repo working tree. The Action grabs the secrets, runs `npm run encrypt-assets`, then `npm run build`, then deploys. The cleartext QR never lives in the repo at any point.

### `.github/workflows/deploy.yml`

```yaml
name: Deploy to Pages
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
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci

      - name: Reconstruct secrets from GH secrets
        env:
          QR_PNG_BASE64: ${{ secrets.QR_PNG_BASE64 }}
          CODES_JSON: ${{ secrets.CODES_JSON }}
        run: |
          mkdir -p secrets
          printf '%s' "$QR_PNG_BASE64" | base64 -d > secrets/qr.png
          printf '%s' "$CODES_JSON" > secrets/codes.json

      - run: npm run encrypt-assets
      - run: npm run build

      - name: Clean secrets before upload
        run: rm -rf secrets

      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

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

Set these repo secrets:
- `QR_PNG_BASE64` — `base64 -i secrets/qr.png | pbcopy` (macOS), paste into GitHub.
- `CODES_JSON` — paste `{"codes":["LIPA42","CARTE7","ROZE19"]}` literally.

---

## 7. Option E — Don't commit the QR at all, manual local deploy

A `.gitignore`'d `secrets/` folder holds the QR. The dev builds locally and pushes only the built `dist/` to a `gh-pages` branch using the `gh-pages` npm package.

**Pros:** clean separation, no GH Actions complexity, the cleartext QR genuinely never touches the repo.

**Cons:** every redeploy is a manual `npm run deploy` from the dev's laptop. If the laptop is lost or the dev forgets, the gift is stuck.

### `package.json` snippet

```json
{
  "scripts": {
    "encrypt-assets": "node scripts/encrypt-assets.mjs",
    "build": "vite build",
    "predeploy": "npm run encrypt-assets && npm run build",
    "deploy": "gh-pages -d dist -b gh-pages"
  },
  "devDependencies": {
    "gh-pages": "^6.1.0"
  }
}
```

Then in repo settings: Pages → Source: Deploy from a branch → Branch: `gh-pages` / `(root)`.

**Verdict:** Fine fallback if GH Actions feels heavy. For this project, D is cleaner.

---

## 8. Recommended combo for THIS project: C + D

**Pick: Option C (WebCrypto encrypt-at-rest) + Option D (GitHub Actions deploy).**

Reasoning:
- **C is non-negotiable.** Without it, the QR is one fetch away from the world. Even a public repo with no link suffers from `<user>.github.io/<repo>/qr.png` being trivially discoverable by anyone who finds the live URL.
- **D over E** because the dev shouldn't need their laptop to redeploy. If a hint text typo is found on Day 0 of the hunt at 9am, a one-line commit + push fixes it; the Action rebuilds and redeploys in ~90 seconds. Without D, the dev would need to be at a machine with `secrets/qr.png` on it.
- **B (don't link the repo) is free and we get it anyway.** Don't pin the repo on the dev's GitHub profile; give it a boring name. Costs nothing.
- **A is out** (would require Pro and still wouldn't protect the live bundle).

Defense in depth: **C protects the bundle, D protects the source, B reduces casual discovery**. Three cheap layers, no upgrade required.

---

## 9. `.gitignore` essentials

```gitignore
# Build output (never commit — Action builds fresh)
dist/
build/

# Dependencies
node_modules/

# The actual secrets — these must NEVER reach the repo
secrets/
secrets/qr.png
secrets/codes.json

# Anything labeled local
*.local
*.local.*
.env
.env.*
!.env.example

# Editor / OS noise
.DS_Store
.idea/
.vscode/
*.swp
*.log

# Vite cache
.vite/

# Optional: if you keep encrypted output under public/ and want CI to regenerate
# (leave the .bin files committed so the site works without a fresh encrypt run)
# public/encrypted-slice-*.bin     # <-- DO NOT add this; keep them committed
```

Commit a `secrets/.gitkeep` if you want the folder to exist for new clones, plus a `secrets/README.md` explaining how to obtain the real files (out of band).

---

## 10. The end-to-end runbook

What the human actually does, copy-paste-able:

1. **Generate the final QR.** Whatever EasyBox app/URL is needed, render the final QR as a PNG. Save it as `secrets/qr.png` in the repo working tree (the folder is gitignored).

2. **Pick 3 fallback codes.** Short, memorable, distinct. Avoid ambiguity: no `O`/`0`, no `I`/`1`. Examples: `LIPA42`, `CARTE7`, `ROZE19`. Write them to `secrets/codes.json`:
   ```json
   { "codes": ["LIPA42", "CARTE7", "ROZE19"] }
   ```
   Also write each code clearly on the **physical clue** at the corresponding Bucharest stop. The physical clue is the source of truth for the player.

3. **Run the encrypt script locally (once, to verify).**
   ```bash
   npm install
   npm run encrypt-assets
   ```
   Confirm `public/encrypted-slice-1.bin`, `…-2.bin`, `…-3.bin` were written. Confirm `secrets/qr.png` did **not** get accidentally copied into `public/`.

4. **Store the same secrets in GitHub.**
   ```bash
   base64 -i secrets/qr.png | pbcopy   # macOS — paste into GH secret QR_PNG_BASE64
   cat secrets/codes.json | pbcopy     # paste into GH secret CODES_JSON
   ```
   Go to repo → Settings → Secrets and variables → Actions → New repository secret. Add both.

5. **Commit only the encrypted output + code.**
   ```bash
   git add public/encrypted-slice-*.bin src/ scripts/ package.json package-lock.json .github/ .gitignore
   git status   # SANITY CHECK: secrets/ MUST NOT appear
   git commit -m "Initial hunt build"
   git push origin main
   ```

6. **Enable Pages.** Repo → Settings → Pages → Source: **GitHub Actions**. The deploy workflow runs on push to `main`.

7. **Smoke test.** Open `https://<user>.github.io/<repo>/` in an incognito window. Try entering one fallback code; confirm the corresponding QR slice decrypts. Try a wrong code; confirm graceful failure. Send the live URL to the friend.

**Re-deploy after edits:** just `git push`. The Action rebuilds and redeploys. The dev never needs the cleartext QR on disk again after step 1.

---

## 11. What's still exposed (and that's fine)

Be honest with yourself about residual leakage. None of these compromise the gift:

- **The app structure** — anyone viewing source can see "this app has 3 stops with GPS gates and code fallbacks." Fine; the design isn't the secret.
- **Hint copy** — the funny text shown to the friend at each stop is in the JS bundle. If a stranger reads it, worst case they're mildly amused.
- **GPS coordinates** — if you ship them in cleartext (for the GPS check), anyone reading the source sees three Bucharest landmarks. These are public places; this just slightly spoils the route. Acceptable. If you want to hide them, you can hash them and only check against the hash (`SHA-256(lat,lon rounded)`), which is a small extra step.
- **Encrypted slice file sizes** — reveal roughly that the final asset is a small PNG. Useless to an attacker.
- **The `<user>.github.io/<repo>/` URL** — anyone you give it to can share it. Trust the friend not to broadcast it. If paranoid, change the repo name post-hunt.
- **Network requests in DevTools** — a player using DevTools mid-hunt can see slice fetches and decoded blobs. The friend won't do this. Cousin won't do this. Move on.

**What's NOT exposed:** the QR image, the unlock codes, anything that would let a stranger grab the gift before the friend.

---

## 12. Custom domain — optional

**Recommendation: don't bother.**

Pros:
- Slightly nicer URL to text to the friend (`hunt.example.com` vs `papanash.github.io/birthday-hunt`).
- Hides the GitHub username from the URL.

Cons:
- Requires owning a domain or buying one (~$10/yr).
- DNS setup: A/AAAA records to GitHub's Pages IPs + a `CNAME` file in the repo.
- HTTPS cert provisioning takes a few minutes on first setup; can occasionally hiccup.
- For a one-day gift used by one person, totally unnecessary.

If the dev already has a domain they're using: 15 minutes of DNS + a `public/CNAME` file containing the domain. Otherwise skip.

---

## 13. Public README guidance

The README is on the public repo. Assume strangers read it.

**Do:**
- Keep it generic. Title like "Weekend treasure hunt app" or "Geo-gated SPA experiment."
- Briefly describe the tech (React, Vite, WebCrypto, GH Pages) — this is fine and even useful as a portfolio reference later.
- Mention that secrets are encrypted at rest with AES-GCM keyed by codes held out-of-band. Kerckhoffs's principle: the design is not the secret.
- Include a "How to run locally" section with a note that `secrets/qr.png` and `secrets/codes.json` must be provided by the operator.

**Don't:**
- Mention the friend's name.
- Mention "birthday."
- Mention Bucharest, EasyBox, or any landmark name that could narrow the search.
- Include screenshots showing real hint copy.
- Link to the live site from the README.

Suggested skeleton:

```markdown
# Geo-gated WebCrypto SPA

Small experiment: a React/Vite SPA that progressively unlocks an asset by
combining geolocation checks with user-supplied PBKDF2 codes. Final asset is
sliced and each slice is AES-GCM encrypted at rest; the bundle ships ciphertext
only.

## Stack
- React + Vite
- Web Crypto API (AES-GCM, PBKDF2-HMAC-SHA256, 200k iterations)
- GitHub Pages via Actions

## Local dev
1. Place an asset at `secrets/qr.png` and a code list at `secrets/codes.json`
2. `npm install`
3. `npm run encrypt-assets`
4. `npm run dev`

The `secrets/` folder is gitignored; the deployed bundle never contains
plaintext key material.
```

That's it. No drama, no spoilers, no name.

---

## Appendix — quick sanity checklist before sending the URL to the friend

- [ ] `git ls-files | grep -E '(qr\.png|codes\.json)'` returns **nothing**.
- [ ] `curl https://<user>.github.io/<repo>/qr.png` returns **404**.
- [ ] `curl https://<user>.github.io/<repo>/encrypted-slice-1.bin` returns binary (the encrypted blob — that's expected).
- [ ] Incognito window: entering a wrong code shows a clean error, not a crash.
- [ ] Incognito window: entering the right code for stop 1 reveals slice 1.
- [ ] All 3 correct codes → full QR renders → scanning it opens the EasyBox URL.
- [ ] The 3 physical clues at the Bucharest stops show their codes legibly.
- [ ] The friend has the live URL; nobody else does.

Ship it. Happy birthday.
