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
  /** Explicit hint revealed inside the stuck sheet. */
  realHint: string;
  /** geo: URI (mobile-friendly) or maps URL. */
  mapsUrl: string;
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
    far: string;     // 200–500m
    close: string;   // 50–200m
    onTop: string;   // <50m
  };

  stuckSheet: {
    title: string;
    realHintIntro: string;
    openInMapsCta: string;
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
    /** Encoded into the displayed QR. Replace before launch. */
    qrPayload: string;
    /** Caption under the QR. */
    instruction: string;
    qrBrightnessTip: string;
    saveQrLabel: string;
    openLockerMapLabel: string;
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
  friendName: 'birthday boy',

  intro: {
    eyebrow: 'happy birthday, you menace',
    headline: 'hey [FRIEND_NAME]. i hid your gift. good luck.',
    body: '3 stops. 3 clues. 1 locker. walk. don\'t Uber. i\'ll know.',
    cta: "let's go →",
    finePrint: 'tap = i agree to walk around bucharest like a tourist',
  },

  gpsPreface: {
    headline: 'i need to know where you are.',
    body:
      "otherwise this hunt is just me typing words at you. pinky promise: i'm not tracking you, your phone is. i just listen.",
    allowCta: 'allow location',
    denyCta: "i'll type codes instead",
  },

  // Placeholder: drop-off + 48h. Replace before launch.
  deadlineISO: '2026-05-20T18:00:00+03:00',
  countdown: {
    eyebrow: 'time until the locker spits it back:',
  },

  checkpoints: [
    {
      id: 1,
      name: 'Piața Universității',
      teaser: 'where the students pretend to study and the pigeons run the show.',
      realHint:
        'piața universității, near the statue of mihai viteazul. that\'s it. that\'s the hint.',
      mapsUrl: 'https://www.google.com/maps/?q=44.4353,26.1015',
      lat: 44.4353,
      lng: 26.1015,
      radiusMeters: 50,
      code: 'MIHAI',
      successCopy:
        'one down. two to go. next: a park where the ducks have more dignity than some politicians.',
    },
    {
      id: 2,
      name: 'Parcul Cișmigiu',
      teaser: 'the bench where you made That Phone Call in 2022.',
      realHint:
        'main entrance of cișmigiu, off bulevardul regina elisabeta. the bench by the lake.',
      mapsUrl: 'https://www.google.com/maps/?q=44.4360,26.0925',
      lat: 44.436,
      lng: 26.0925,
      radiusMeters: 50,
      code: 'LEBADA',
      successCopy:
        'two down. you\'re almost worthy of a present. last stop: something classy.',
    },
    {
      id: 3,
      name: 'Ateneul Român',
      teaser: 'the round building with columns that looks like a greek wedding.',
      realHint: 'in front of the main entrance of the romanian athenaeum.',
      mapsUrl: 'https://www.google.com/maps/?q=44.4414,26.0973',
      lat: 44.4414,
      lng: 26.0973,
      radiusMeters: 50,
      code: 'ENESCU',
      successCopy:
        'THREE FOR THREE. now scan the QR. find the easybox. open it. don\'t cry in public.',
    },
  ],

  warmthStatuses: {
    veryFar: 'somewhere out there.',
    far: 'getting warmer...',
    close: 'much warmer.',
    onTop: 'you\'re basically on top of it. look around.',
  },

  stuckSheet: {
    title: 'stuck?',
    realHintIntro: 'fine. here it is.',
    openInMapsCta: 'open in maps',
    codeLabel: 'got a code? type it.',
    codePlaceholder: '----',
    unlockCta: 'unlock',
    closeCta: 'close and pretend i didn\'t',
  },

  reveal: {
    headline: 'GOTCHA.',
    nextCta: 'on to the next stop →',
    finaleCta: 'open the final screen →',
  },

  finale: {
    headline: 'YOU ABSOLUTE LEGEND.',
    // Placeholder — drop the real EasyBox QR PNG into public/qr.png too.
    qrPayload: 'https://easybox.sameday.ro/locker/REPLACE_ME',
    instruction: 'show this at the locker. don\'t shake it.',
    qrBrightnessTip: 'tip: max your brightness so the scanner sees it.',
    saveQrLabel: 'save QR to photos',
    openLockerMapLabel: 'open easybox map',
  },

  errors: {
    wrongCode: 'nope. that\'s not it. count the letters again, champ.',
    gpsDenied:
      "your phone won't share your location. cool. cool cool cool. type the codes instead.",
    gpsFlaky: 'your phone\'s a bit lost. waving at satellites...',
    offline: 'you\'re offline. that\'s fine, we cached everything. keep going.',
  },

  photos: [],

  sound: {
    unlockSrc: 'sound/unlock.ogg',
    finaleSrc: 'sound/finale.ogg',
  },
};

/** Lookup helper — `photoAfter(0)` returns the photo card to show after reveal 0, or null. */
export function photoAfter(n: 0 | 1 | 2): PhotoConfig | null {
  return config.photos.find((p) => p.afterStep === n) ?? null;
}
