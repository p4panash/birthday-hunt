/**
 * The ONE file the user edits before launch.
 *
 * Everything that varies between hunts (recipient name, locations, codes, copy,
 * deadlines, QR payload semantics) lives here. Replace placeholder values in
 * Phase 9; the rest of the app reads from this object.
 *
 * Copy supports [VAR] template substitution — see `src/lib/tpl.ts`. Available
 * vars: FRIEND_NAME, LOCATION_NAME, LANDMARK_DETAIL, AGE.
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
    denyCta: string;
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
    /** Encoded into the displayed QR. Replace before launch. */
    qrPayload: string;
    /** Caption under the QR. */
    instruction: string;
    qrBrightnessTip: string;
    saveQrLabel: string;
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
    offline: string;
  };

  photos: PhotoConfig[];
  sound: {
    /** If a file fails to load, `.play()` rejects silently — see Phase 7. */
    unlockSrc: string;
    finaleSrc: string;
  };
};

export const config: HuntConfig = {
  friendName: "birthday boy",

  intro: {
    eyebrow: "happy birthday, you menace",
    headline: "hey [FRIEND_NAME]. i hid your gift. good luck.",
    body: "3 stops. 3 clues. 1 locker. walk. don't Uber. i'll know.",
    cta: "let's go →",
    finePrint: "tap = i agree to walk around bucharest like a tourist",
  },

  gpsPreface: {
    headline: "i need to know where you are.",
    body: "otherwise this hunt is just me typing words at you. pinky promise: i'm not tracking you, your phone is. i just listen.",
    allowCta: "allow location",
    denyCta: "i'll type codes instead",
  },

  // Placeholder: drop-off + 48h. Replace before launch.
  deadlineISO: "2026-05-20T18:00:00+03:00",
  countdown: {
    eyebrow: "time until the locker spits it back:",
  },

  checkpoints: [
    {
      id: 1,
      name: "OZN Tineretului",
      teaser:
        "somewhere in bucharest, a ufo landed in a park and nobody batted an eye.",
      realHint:
        "the park named after youth. the ferris wheel knows where to look.",
      lat: 44.40901126215023,
      lng: 26.106899327158118,
      radiusMeters: 25,
      code: "OZN",
      successCopy:
        "nice. the aliens approved. now find the place where someone's waiting with something for you.",
    },
    {
      id: 2,
      name: "Parcul Cișmigiu",
      teaser: "the bench where you made That Phone Call in 2022.",
      realHint:
        "head for the big park with the lake and the rowboats. our bench faces the water, near where the swans act like they own the place.",
      lat: 44.436,
      lng: 26.0925,
      radiusMeters: 50,
      code: "LEBADA",
      successCopy:
        "two down. you're almost worthy of a present. last stop: something classy.",
    },
    {
      id: 3,
      name: "Ateneul Român",
      teaser:
        "the round building with columns that looks like a greek wedding.",
      realHint:
        "look for the domed concert hall with the seated poet statue out front and the fancy old hotel across the way. stand by the steps.",
      lat: 44.4414,
      lng: 26.0973,
      radiusMeters: 50,
      code: "ENESCU",
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
    // Placeholder — drop the real EasyBox QR PNG into public/qr.png too.
    qrPayload: "https://easybox.sameday.ro/locker/REPLACE_ME",
    instruction: "scan the QR when you get there. don't shake the package.",
    qrBrightnessTip: "tip: max your brightness so the scanner sees it.",
    saveQrLabel: "save QR to photos",
    openLockerMapLabel: "open in maps",
  },

  easyboxLocation: {
    // Placeholder — replace with the real EasyBox name + a directional hint + maps URL.
    name: "Easybox @ [LOCATION_TBD]",
    hint: "somewhere central. swap this for the real address before you send the link.",
    mapsUrl: "https://www.google.com/maps/?q=44.4268,26.1025",
  },

  errors: {
    wrongCode: "nope. that's not it. count the letters again, champ.",
    gpsDenied:
      "your phone won't share your location. cool. cool cool cool. type the codes instead.",
    gpsFlaky: "your phone's a bit lost. waving at satellites...",
    offline: "you're offline. that's fine, we cached everything. keep going.",
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
