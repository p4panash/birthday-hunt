/**
 * The ONE file the user edits before launch.
 *
 * Everything that varies between hunts (recipient name, locations, codes, copy,
 * deadlines) lives here. Replace placeholder values before launch; the rest of
 * the app reads from this object.
 *
 * Copy supports [VAR] template substitution — see `src/lib/tpl.ts`. The only
 * substituted var is FRIEND_NAME.
 */

export type Checkpoint = {
  id: 1 | 2 | 3;
  name: string;
  /** Cryptic, always-visible teaser shown on the location screen. */
  teaser: string;
  /** Additional landmark clue revealed inside the stuck sheet — more explicit than the teaser, but a nudge, not the answer. */
  realHint: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  /** Manual-entry fallback, case-insensitive, whitespace-trimmed. */
  code: string;
  /** Banner shown immediately after the reveal animation. */
  successCopy: string;
};

export type PhotoConfig = {
  src: string;
  caption: string;
  /** Insert this card *after* reveal of step N (0/1/2). */
  afterStep: 0 | 1 | 2;
  durationMs?: number;
};

export type HuntConfig = {
  friendName: string;

  intro: {
    eyebrow: string;
    headline: string;
    body: string;
    cta: string;
    finePrint: string;
  };

  gpsPreface: {
    headline: string;
    body: string;
    allowCta: string;
  };

  /** ISO 8601 timestamp — when the EasyBox returns the package. Drives the countdown. */
  deadlineISO: string;
  countdown: {
    eyebrow: string;
  };

  checkpoints: [Checkpoint, Checkpoint, Checkpoint];

  /** Status copy mapped to four distance buckets (see WarmthPulse in Phase 3). */
  warmthStatuses: {
    veryFar: string; // >500m
    far: string; // 200–500m
    close: string; // 50–200m
    onTop: string; // <50m
  };

  stuckSheet: {
    title: string;
    realHintIntro: string;
    codeLabel: string;
    codePlaceholder: string;
    unlockCta: string;
    closeCta: string;
  };

  reveal: {
    /** Shown above the slice animation, e.g. "GOTCHA." */
    headline: string;
    /** Continue CTA when n < 2. */
    nextCta: string;
    /** Continue CTA when n === 2. */
    finaleCta: string;
  };

  finale: {
    headline: string;
    /** Bridge line between the headline and the locker hint. */
    subheadline: string;
    /** Label above the locker hint card. */
    lockerHintLabel: string;
    /** Caption under the QR. */
    instruction: string;
    qrBrightnessTip: string;
    openLockerMapLabel: string;
  };

  /**
   * Where the EasyBox actually is. NOT a checkpoint — the friend goes here
   * after the hunt completes, scans the assembled QR there.
   */
  easyboxLocation: {
    /** Short name shown prominently on the finale, e.g. "Easybox @ Mega Image …" */
    name: string;
    /** Short hint / address description. */
    hint: string;
    mapsUrl: string;
  };

  errors: {
    wrongCode: string;
    gpsDenied: string;
    gpsFlaky: string;
  };

  photos: PhotoConfig[];
  sound: {
    /** If a file fails to load, `.play()` rejects silently — see Phase 7. */
    unlockSrc: string;
    finaleSrc: string;
  };
};

export const config: HuntConfig = {
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

/** Lookup helper — `photoAfter(0)` returns the photo card to show after reveal 0, or null. */
export function photoAfter(n: 0 | 1 | 2): PhotoConfig | null {
  return config.photos.find((p) => p.afterStep === n) ?? null;
}
