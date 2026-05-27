// Maps the wizard's free-form HuntDraft into the strict HuntConfig schema
// (shared/config/schema.ts) expected by the createHunt API.
//
// Schema constraint: HuntConfig.checkpoints is `tuple([Checkpoint, Checkpoint,
// Checkpoint])` — exactly three. Wizards with more than three stops are
// truncated for v1; the remaining stops are documented in the audit trail
// (a future schema bump will lift this).

import type { Checkpoint, HuntConfig } from 'shared/config/types';
import type { HuntDraft } from './data';

export interface CreateHuntResult {
  hunt: { id: string };
}

function clueText(draft: HuntDraft, stopId: string): string {
  return draft.clues[stopId]?.text ?? '';
}

function stopToCheckpoint(
  stop: HuntDraft['stops'][number],
  draft: HuntDraft,
  idx: 1 | 2 | 3,
): Checkpoint {
  // Stops always carry real lat/lng now — either from the AI patch
  // (Kickoff path) or from the curated SUGGESTED_STOPS defaults
  // (Skip path).
  const { lat, lng } = stop;
  return {
    id: idx,
    name: stop.name,
    teaser: stop.hint ?? stop.blurb.slice(0, 60),
    realHint: stop.blurb,
    lat,
    lng,
    radiusMeters: 25,
    // Use a short uppercase token derived from the stop id as the manual
    // code — the user can edit these in /admin/hunts/<id> later.
    code: stop.id.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || `STOP${idx}`,
    successCopy: clueText(draft, stop.id) || stop.blurb,
  };
}

export interface CreateHuntInput {
  name: string;
  friend_name: string;
  deadline_iso: string;
  config: HuntConfig;
}

export function draftToHuntConfig(draft: HuntDraft): { input: CreateHuntInput } {
  // The HuntConfig schema's `checkpoints` is a 3-tuple — exactly three
  // stops. The wizard supports more, but for v1 we truncate. Refuse rather
  // than silently pad: a hunt with placeholder stops would have broken GPS
  // checkpoints and there's no way for a player to recover.
  if (draft.stops.length < 3) {
    throw new Error(
      `Need at least 3 stops to publish (you have ${draft.stops.length}). ` +
        'Add more in Step 05 — Pick the stops.',
    );
  }
  const trio = draft.stops.slice(0, 3);
  for (const s of trio) {
    if (typeof s.lat !== 'number' || typeof s.lng !== 'number') {
      throw new Error(
        `Stop "${s.name}" is missing GPS coordinates. ` +
          'Try re-running the wizard or drop a pin on Step 05.',
      );
    }
  }
  const checkpoints: [Checkpoint, Checkpoint, Checkpoint] = [
    stopToCheckpoint(trio[0], draft, 1),
    stopToCheckpoint(trio[1], draft, 2),
    stopToCheckpoint(trio[2], draft, 3),
  ];

  // Construct a deadline ISO from the wizard date + the end of the time window.
  const deadlineISO = `${draft.date}T${draft.timeEnd}:00+03:00`;

  const config: HuntConfig = {
    friendName: draft.recipient,
    intro: {
      eyebrow: 'happy birthday!',
      headline: `hey ${draft.recipient}. we hid your gift.`,
      body: `${draft.stops.length} stops. ${draft.stops.length} clues. 1 ${draft.reward.kind}.`,
      cta: "let's go →",
      finePrint: '',
    },
    gpsPreface: {
      headline: 'we need to know where you are.',
      body: 'gps please.',
      allowCta: 'allow location',
    },
    deadlineISO,
    countdown: { eyebrow: 'tick tock.' },
    checkpoints,
    warmthStatuses: {
      veryFar: 'cold',
      far: 'warmer',
      close: 'hot',
      onTop: 'right here!',
    },
    stuckSheet: {
      title: 'stuck?',
      realHintIntro: 'here\'s the real hint:',
      codeLabel: 'code',
      codePlaceholder: 'enter the code',
      unlockCta: 'unlock',
      closeCta: 'close',
    },
    reveal: {
      headline: 'GOTCHA.',
      nextCta: 'next →',
      finaleCta: 'finale →',
    },
    finale: {
      headline: 'YOU ABSOLUTE LEGEND.',
      subheadline: draft.reward.message,
      lockerHintLabel: 'locker code',
      instruction: `unlock with ${draft.reward.code}`,
      qrBrightnessTip: '',
      openLockerMapLabel: 'open in maps',
    },
    easyboxLocation: {
      name: draft.stops[draft.stops.length - 1]?.name ?? 'Final stop',
      hint: draft.stops[draft.stops.length - 1]?.blurb ?? '',
      mapsUrl: 'https://maps.example.com/x',
    },
    errors: {
      wrongCode: 'wrong code — try again',
      gpsDenied: 'we need gps to play',
      gpsFlaky: 'gps signal is weak',
    },
    photos: [],
    sound: { unlockSrc: '', finaleSrc: '' },
  };

  return {
    input: {
      name: draft.title || 'untitled-hunt',
      friend_name: draft.recipient || 'friend',
      deadline_iso: deadlineISO,
      config,
    },
  };
}
