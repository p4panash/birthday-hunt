// Types inferred from the Zod schemas in ./schema. Inference is one-way so
// that the schema cannot drift from the type — there is no second source of
// truth to keep in sync.

import type { z } from 'zod';
import type {
  CheckpointSchema,
  HuntConfigSchema,
  PhotoConfigSchema,
} from './schema';

export type Checkpoint = z.infer<typeof CheckpointSchema>;
export type PhotoConfig = z.infer<typeof PhotoConfigSchema>;
export type HuntConfig = z.infer<typeof HuntConfigSchema>;
