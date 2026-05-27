// WebSocket wire protocol between the frontend (useTeamState hook) and the
// backend (TeamSession Durable Object). Every frame carries a version tag so
// that breaking changes can be detected and rejected before they hit the
// reducer.
//
// Bump PROTOCOL_VERSION when any field shape below changes in a breaking way.

import { z } from 'zod';
import { HuntActionSchema, HuntStateSchema } from './state/schema';

export const PROTOCOL_VERSION = 1;

const V = z.literal(PROTOCOL_VERSION);

export const PlayerPresenceSchema = z.object({
  playerId: z.string(),
  name: z.string(),
  connectedAt: z.number(),
});

export const ClientMsgSchema = z.discriminatedUnion('type', [
  z.object({ v: V, type: z.literal('action'), action: HuntActionSchema }),
  z.object({ v: V, type: z.literal('ping') }),
]);

export const ServerMsgSchema = z.discriminatedUnion('type', [
  z.object({ v: V, type: z.literal('state'), state: HuntStateSchema }),
  z.object({
    v: V,
    type: z.literal('presence'),
    players: z.array(PlayerPresenceSchema),
  }),
  z.object({
    v: V,
    type: z.literal('error'),
    code: z.string(),
    message: z.string(),
  }),
  z.object({ v: V, type: z.literal('pong') }),
]);

export type PlayerPresence = z.infer<typeof PlayerPresenceSchema>;
export type ClientMsg = z.infer<typeof ClientMsgSchema>;
export type ServerMsg = z.infer<typeof ServerMsgSchema>;
