# Development

## Stack

- React 18 + TypeScript 5
- Vite 5 (static build for GitHub Pages)
- `motion` v11 for animations
- `canvas-confetti` for the finale
- Native Geolocation API + `<audio>` for two win sounds

## Local dev

```bash
npm install
npm run dev
```

Open http://localhost:5173/birthday-hunt/

## Build

```bash
npm run build
```

Output goes to `dist/`. Preview the build locally with `npm run preview`.

## Configuration

All content lives in `src/config.ts`:

- `friendName` — recipient
- `deadlineISO` — when the EasyBox auto-returns the package (countdown target)
- `checkpoints[]` — the three hunt locations (`lat`, `lng`, `radiusMeters`, `teaser`, `realHint`, `code`, `successCopy`). These are intermediate stops, **not** the locker itself.
- `easyboxLocation` — where the actual EasyBox is. Revealed on the finale screen alongside the assembled QR, so the friend goes there to scan.
- `finale` — headline / subheadline / locker-hint label / QR instructions
- `intro`, `gpsPreface`, `warmthStatuses`, `stuckSheet`, `reveal`, `errors` — all UI copy

The QR image lives at `public/qr.png` — replace with the real EasyBox QR before launch.

## Deploy

The workflow at `.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`. No repo secrets required. If the repo name differs from `birthday-hunt`, update the `base` path in `vite.config.ts` accordingly (e.g. `base: '/my-other-name/'`).

Pages source must be set once: **repo Settings → Pages → Source: GitHub Actions**.

## Test mode

Open `https://…/birthday-hunt/?test=1` to enable a corner badge + debug drawer (skip to step, simulate at location, set deadline +30s, reset progress). The flag is sticky in localStorage — visit `?test=0` to clear it before sharing the URL with the friend.

## Content checklist

Before launch:

- [ ] Replace the three `checkpoints[]` coords + `code`s in `src/config.ts` with real Bucharest spots (these are decoys/clues, NOT the locker)
- [ ] Set `easyboxLocation` (name, hint, mapsUrl) — this is where the actual locker is
- [ ] Save the codes somewhere on your phone so you can text them if asked
- [ ] Set `deadlineISO` to ~48h after the EasyBox drop-off
- [ ] Replace `public/qr.png` with the actual EasyBox QR
- [ ] (Optional) Drop `public/sound/unlock.ogg` and `public/sound/finale.ogg` (≤2s each, ≤30KB) — if absent, the app is silent
- [ ] Translate `src/config.ts` copy to Romanian if needed
- [ ] Walk the route with `?test=1` and tune `radiusMeters` per stop
- [ ] Send the URL (without `?test=1`) to the recipient

## Planning

See [`planning/`](./planning) for the master plan and research docs that drove the build.
