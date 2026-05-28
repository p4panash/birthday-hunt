// Zod schemas mirror the discriminated unions in ./types. Used by the worker
// to validate inbound WebSocket messages and by both sides to validate state
// snapshots persisted to D1. Types in ./types are inferred from these via
// z.infer so there is exactly one source of truth for shape.

import { z } from 'zod';

export const CheckpointIndexSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
]);

export const HuntStepSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('intro') }),
  z.object({ kind: z.literal('gps-preface') }),
  z.object({ kind: z.literal('location'), n: CheckpointIndexSchema }),
  z.object({ kind: z.literal('reveal'), n: CheckpointIndexSchema }),
  z.object({ kind: z.literal('photo'), afterN: CheckpointIndexSchema }),
  z.object({ kind: z.literal('finale') }),
]);

export const HuntStateSchema = z.object({
  step: HuntStepSchema,
  unlocked: z.tuple([z.boolean(), z.boolean(), z.boolean()]),
  startedAt: z.number().nullable(),
  testMode: z.boolean(),
});

export const HuntActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('START_HUNT') }),
  z.object({ type: z.literal('GRANT_GPS') }),
  z.object({ type: z.literal('UNLOCK_CHECKPOINT'), n: CheckpointIndexSchema }),
  z.object({
    type: z.literal('REVEAL_COMPLETE'),
    n: CheckpointIndexSchema,
    hasPhotoAfter: z.boolean(),
  }),
  z.object({ type: z.literal('PHOTO_DONE'), afterN: CheckpointIndexSchema }),
  z.object({ type: z.literal('RESET') }),
  z.object({ type: z.literal('JUMP_TO_STEP'), step: HuntStepSchema }),
]);
