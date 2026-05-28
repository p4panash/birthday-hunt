// Cross-environment hunt state shape, inferred from the Zod schemas in
// ./schema. Inference is one-way so that types cannot drift from validation.
//
// These types are consumed by both the frontend reducer (src/state/) and the
// backend Durable Object (worker/do/). They must stay DOM-free, React-free,
// and Node-free.
//
// The schema is versioned via src/state/huntReducer's STORAGE_KEY (solo mode)
// and the wire-protocol `v` field in shared/messages.ts (team mode). When the
// shape changes in a breaking way, bump both.

import type { z } from 'zod';
import type {
  CheckpointIndexSchema,
  HuntActionSchema,
  HuntStateSchema,
  HuntStepSchema,
} from './schema';

export type CheckpointIndex = z.infer<typeof CheckpointIndexSchema>;
export type HuntStep = z.infer<typeof HuntStepSchema>;
export type HuntState = z.infer<typeof HuntStateSchema>;
export type HuntAction = z.infer<typeof HuntActionSchema>;
