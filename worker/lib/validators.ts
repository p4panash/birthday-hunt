// Zod schemas for every Worker HTTP boundary. Re-exports the shared schemas
// (HuntConfig, HuntAction, WS envelopes) so routes can import everything from
// one place, and adds request-body schemas that exist only on the wire.

import { z } from 'zod';
import { HuntConfigSchema } from '../../shared/config/schema';
import { isValidInviteCode } from './invite';

// Re-export shared schemas under a single import path. Relative imports because
// wrangler's bundler doesn't honor the TS path alias for `shared/*` (vite does
// in the frontend; the worker's tsconfig path alias is for typecheck only).
export {
  CheckpointIndexSchema,
  HuntStepSchema,
  HuntStateSchema,
  HuntActionSchema,
} from '../../shared/state/schema';
export {
  CheckpointSchema,
  PhotoConfigSchema,
  HuntConfigSchema,
} from '../../shared/config/schema';
export {
  ClientMsgSchema,
  ServerMsgSchema,
  PlayerPresenceSchema,
} from '../../shared/messages';

// ─── Worker-only request schemas ─────────────────────────────────────

export const CreateHuntRequestSchema = z.object({
  name: z.string().min(1).max(100),
  friend_name: z.string().min(1).max(100),
  deadline_iso: z.string().min(1),
  config: HuntConfigSchema,
});

export const PatchHuntRequestSchema = z
  .object({
    name: z.string().min(1).max(100),
    friend_name: z.string().min(1).max(100),
    deadline_iso: z.string().min(1),
    config: HuntConfigSchema,
  })
  .partial();

export const CreateTeamRequestSchema = z.object({
  name: z.string().min(1).max(100),
});

export const JoinTeamRequestSchema = z.object({
  invite_code: z.string().refine(isValidInviteCode, {
    message: 'invite_code must be 8 Crockford base32 chars',
  }),
  player_name: z.string().min(1).max(50),
  client_id: z.string().min(8).max(128),
});

export type CreateHuntRequest = z.infer<typeof CreateHuntRequestSchema>;
export type PatchHuntRequest = z.infer<typeof PatchHuntRequestSchema>;
export type CreateTeamRequest = z.infer<typeof CreateTeamRequestSchema>;
export type JoinTeamRequest = z.infer<typeof JoinTeamRequestSchema>;
