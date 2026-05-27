// WebSocket wire protocol between the frontend (useTeamState hook) and the
// backend (TeamSession Durable Object). Every frame carries a version tag so
// that breaking changes can be detected and rejected before they hit the
// reducer.
//
// Bump PROTOCOL_VERSION when any field shape below changes in a breaking way.
// Adding new optional fields or new discriminated-union variants is NOT a
// breaking change — old clients ignore unknown variants gracefully.

import { z } from 'zod';
import { HuntActionSchema, HuntStateSchema } from './state/schema';

export const PROTOCOL_VERSION = 1;

const V = z.literal(PROTOCOL_VERSION);

// Fixed allowlist. Adding a new emoji is a UI + i18n decision and goes
// through the spec process (per spec § Boundaries).
export const REACTION_EMOJIS = ['🎉', '❤️', '🔥', '😭', '🙄', '👀'] as const;
export const ReactionEmojiSchema = z.enum(REACTION_EMOJIS);
export type ReactionEmoji = z.infer<typeof ReactionEmojiSchema>;

export const ChatMessageSchema = z.object({
  id: z.number(),
  player_id: z.string(),
  player_name: z.string(),
  body: z.string(),
  created_at: z.number(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const PlayerPresenceSchema = z.object({
  playerId: z.string(),
  name: z.string(),
  connectedAt: z.number(),
  // Optional GPS coords. Sent by the client via `presence_position`; the DO
  // copies them into the WS attachment and includes them in every presence
  // frame. Old clients that don't send positions simply omit these fields.
  lat: z.number().optional(),
  lng: z.number().optional(),
  accuracy: z.number().optional(),
  last_gps_at: z.number().optional(),
});

export const ClientMsgSchema = z.discriminatedUnion('type', [
  z.object({ v: V, type: z.literal('action'), action: HuntActionSchema }),
  z.object({ v: V, type: z.literal('ping') }),
  z.object({
    v: V,
    type: z.literal('chat_send'),
    // Zod-level cap matches the runtime cap in TeamSession.handleChatSend.
    // Fails fast on the way in so malformed/oversized frames never reach
    // the handler (DoS amplifier: a 900 KB body would otherwise force
    // Zod to fully materialise the string before the runtime check rejects).
    body: z.string().max(280),
  }),
  z.object({
    v: V,
    type: z.literal('react_send'),
    emoji: ReactionEmojiSchema,
  }),
  z.object({
    v: V,
    type: z.literal('ping_send'),
    lat: z.number(),
    lng: z.number(),
  }),
  z.object({
    v: V,
    type: z.literal('presence_position'),
    lat: z.number(),
    lng: z.number(),
    accuracy: z.number().optional(),
  }),
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
    retry_after_ms: z.number().optional(),
  }),
  z.object({ v: V, type: z.literal('pong') }),
  z.object({
    v: V,
    type: z.literal('chat_snapshot'),
    messages: z.array(ChatMessageSchema),
  }),
  z.object({
    v: V,
    type: z.literal('chat_new'),
    message: ChatMessageSchema,
  }),
  z.object({ v: V, type: z.literal('chat_wiped') }),
  z.object({
    v: V,
    type: z.literal('react_show'),
    emoji: ReactionEmojiSchema,
    sender_id: z.string(),
    sender_name: z.string(),
    id: z.string(),
  }),
  z.object({
    v: V,
    type: z.literal('ping_show'),
    lat: z.number(),
    lng: z.number(),
    sender_id: z.string(),
    sender_name: z.string(),
    id: z.string(),
    expires_at: z.number(),
  }),
]);

export type PlayerPresence = z.infer<typeof PlayerPresenceSchema>;
export type ClientMsg = z.infer<typeof ClientMsgSchema>;
export type ServerMsg = z.infer<typeof ServerMsgSchema>;
