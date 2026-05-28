/**
 * The ONE file the user edits before launch (solo mode).
 *
 * Everything that varies between hunts (recipient name, locations, codes, copy,
 * deadlines) lives here. Replace placeholder values before launch; the rest of
 * the app reads from this object.
 *
 * Copy supports [VAR] template substitution — see `src/lib/tpl.ts`. The only
 * substituted var is FRIEND_NAME.
 *
 * The type and Zod schema live in shared/config so the worker can validate
 * hunts.config_json against the same shape. The literal below is parsed at
 * module load so any divergence from the schema fails fast in dev.
 */

import { HuntConfigSchema } from 'shared/config/schema';
import type { HuntConfig } from 'shared/config/types';

export type { Checkpoint, PhotoConfig, HuntConfig } from 'shared/config/types';

const rawConfig = {
  friendName: "Mihali",

  intro: {
    eyebrow: "happy birthday!",
    headline: "hey [FRIEND_NAME]. we hid your gift. good luck.",
    body: "3 stops. 3 clues. 1 locker. hop on the bike or walk it — your call. just don't Uber. we'll know.",
    cta: "let's go →",
    finePrint: "",
  },

  gpsPreface: {
    headline: "we need to know where you are.",
    body: "otherwise this hunt is just us typing words at you. pinky promise: we're not tracking you, your phone is. we just listen.",
    allowCta: "allow location",
  },

  // Joi, 28 Mai, ora 1:10.
  deadlineISO: "2026-05-28T01:10:00+03:00",
  countdown: {
    eyebrow: "tick tock. the locker repossesses your gift in:",
  },

  checkpoints: [
    {
      id: 1,
      name: "OZN Tineretului",
      teaser:
        "somewhere in bucharest, a ufo landed in a park and nobody batted an eye.",
      realHint:
        "go where bucharest keeps its youth. something there never quite fit in.",
      lat: 44.409062219291364,
      lng: 26.10696297620568,
      radiusMeters: 25,
      code: "OZN",
      successCopy: "good. now follow the music.",
    },
    {
      id: 2,
      name: "Kpop.ro",
      teaser:
        "a universe of obsession packed into a tiny shop. bias wreckers welcome.",
      realHint:
        "find the street named after the bow. look for the shop that brought seoul to bucharest.",
      lat: 44.42028875884773,
      lng: 26.12079480429222,
      radiusMeters: 25,
      code: "KPOP",
      successCopy: "almost there. find the place where the riff never ends.",
    },
    {
      id: 3,
      name: "iSleep",
      teaser: "the end is near. and it promises a good night's sleep.",
      realHint:
        "find the boulevard of the last dacian king. the shop there invites you to do what you've been avoiding all day.",
      lat: 44.42757830878356,
      lng: 26.13161744685325,
      radiusMeters: 25,
      code: "SLEEP",
      successCopy:
        "THREE FOR THREE. now scan the QR. find the easybox. open it. don't cry in public.",
    },
  ],

  warmthStatuses: {
    veryFar: "somewhere out there.",
    far: "getting warmer...",
    close: "much warmer.",
    onTop: "you're basically on top of it. look around.",
  },

  stuckSheet: {
    title: "stuck?",
    realHintIntro: "ugh, fine. one more clue:",
    codeLabel: "got a code? type it.",
    codePlaceholder: "----",
    unlockCta: "unlock",
    closeCta: "close and pretend i didn't",
  },

  reveal: {
    headline: "GOTCHA.",
    nextCta: "on to the next stop →",
    finaleCta: "open the final screen →",
  },

  finale: {
    headline: "YOU ABSOLUTE LEGEND.",
    subheadline: "one more thing — you're not at the locker yet.",
    lockerHintLabel: "go here:",
    // The displayed QR is the image at public/qr.png — replace that file with
    // the real EasyBox QR before launch.
    instruction:
      "scan the QR when you get there. try to keep it together in front of strangers.",
    qrBrightnessTip: "tip: max your brightness so the scanner sees it.",
    openLockerMapLabel: "open in maps",
  },

  easyboxLocation: {
    name: "Muse Clinique by Speed Gym",
    hint: "grigore gănescu, nr. 1A. told you to bring the bike. last push, go get it.",
    mapsUrl: "https://maps.app.goo.gl/vSq7vAci9LvxxXdcA",
  },

  errors: {
    wrongCode: "nope. that's not it. count the letters again, champ.",
    gpsDenied:
      "your phone won't share your location. cool. cool cool cool. type the codes instead.",
    gpsFlaky: "your phone's a bit lost. waving at satellites...",
  },

  photos: [],

  sound: {
    unlockSrc: "sound/unlock.ogg",
    finaleSrc: "sound/finale.ogg",
  },
};

/**
 * Validates the literal above at module load. Throws a Zod error with field
 * paths if the shape drifts from shared/config/schema.ts. The parsed result is
 * the canonical config for solo mode.
 */
export const config: HuntConfig = HuntConfigSchema.parse(rawConfig);

/** Lookup helper — `photoAfter(0)` returns the photo card to show after reveal 0, or null. */
export function photoAfter(n: 0 | 1 | 2) {
  return config.photos.find((p) => p.afterStep === n) ?? null;
}
