// Zod schemas are the source of truth for hunt configuration shape. Both
// frontend (src/config.ts default for solo mode) and backend (hunts.config_json
// in D1) validate against these. Types are inferred via z.infer in types.ts.

import { z } from 'zod';

export const CheckpointSchema = z.object({
  id: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  name: z.string(),
  teaser: z.string(),
  realHint: z.string(),
  lat: z.number(),
  lng: z.number(),
  radiusMeters: z.number().positive(),
  code: z.string().min(1),
  successCopy: z.string(),
});

export const PhotoConfigSchema = z.object({
  src: z.string(),
  caption: z.string(),
  afterStep: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  durationMs: z.number().positive().optional(),
});

export const HuntConfigSchema = z.object({
  friendName: z.string().min(1),

  intro: z.object({
    eyebrow: z.string(),
    headline: z.string(),
    body: z.string(),
    cta: z.string(),
    finePrint: z.string(),
  }),

  gpsPreface: z.object({
    headline: z.string(),
    body: z.string(),
    allowCta: z.string(),
  }),

  deadlineISO: z.string(),

  countdown: z.object({
    eyebrow: z.string(),
  }),

  checkpoints: z.tuple([CheckpointSchema, CheckpointSchema, CheckpointSchema]),

  warmthStatuses: z.object({
    veryFar: z.string(),
    far: z.string(),
    close: z.string(),
    onTop: z.string(),
  }),

  stuckSheet: z.object({
    title: z.string(),
    realHintIntro: z.string(),
    codeLabel: z.string(),
    codePlaceholder: z.string(),
    unlockCta: z.string(),
    closeCta: z.string(),
  }),

  reveal: z.object({
    headline: z.string(),
    nextCta: z.string(),
    finaleCta: z.string(),
  }),

  finale: z.object({
    headline: z.string(),
    subheadline: z.string(),
    lockerHintLabel: z.string(),
    instruction: z.string(),
    qrBrightnessTip: z.string(),
    openLockerMapLabel: z.string(),
  }),

  easyboxLocation: z.object({
    name: z.string(),
    hint: z.string(),
    mapsUrl: z.string().url(),
  }),

  errors: z.object({
    wrongCode: z.string(),
    gpsDenied: z.string(),
    gpsFlaky: z.string(),
  }),

  photos: z.array(PhotoConfigSchema),

  sound: z.object({
    unlockSrc: z.string(),
    finaleSrc: z.string(),
  }),
});
