# Birthday Hunt

> A mobile-first treasure hunt for one friend's birthday. Three Bucharest stops, three QR slices, one EasyBox locker, a 48-hour countdown, and a wobbly coral mascot who takes the whole thing way too seriously.

**[Live →](https://p4panash.github.io/birthday-hunt/)**

<!-- Drop a hero shot here when ready (finale screen works well). -->
![hero](./docs/screenshots/hero.png)

## How it plays

1. Open the link on your phone. Countdown starts ticking, mascot starts wobbling.
2. Walk to the first stop. GPS auto-unlocks at <50m. Stuck? Tap "stuck?" for the real hint — or text me for the manual code.
3. Mascot spits out 1/3 of a QR. Repeat for stops 2 and 3.
4. After the third reveal, the locker location shows up alongside the assembled QR.
5. Go there. Scan. Open. Receive gift.

## A look around

### Intro
<!-- screenshot: intro screen — headline + dotted path + CTA -->
![intro](./docs/screenshots/intro.png)

### On the hunt
<!-- screenshot: location-active screen — teaser hint + warmth pulse + stuck button -->
![location](./docs/screenshots/location.png)

### Stuck? sheet
<!-- screenshot: the slide-up sheet showing real hint, maps link, and code input -->
![stuck-sheet](./docs/screenshots/stuck-sheet.png)

### Reveal
<!-- screenshot: mascot mid-spit / slice flying into the scaffold cell -->
![reveal](./docs/screenshots/reveal.png)

### Finale
<!-- screenshot: locker hint card + assembled QR + celebrating mascot -->
![finale](./docs/screenshots/finale.png)

## Built with

React · Vite · TypeScript · `motion` · `canvas-confetti` · GitHub Pages

## Setup, configuration, deploy

See [`DEVELOPMENT.md`](./DEVELOPMENT.md) for the technical stuff and [`planning/`](./planning) for the master plan + design research.
