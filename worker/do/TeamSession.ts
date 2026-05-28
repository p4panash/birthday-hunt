// Per-team Durable Object. One DO instance per team, identified by
// `idFromName(team_id)` so `this.ctx.id.name === team_id`.
//
// Responsibilities:
//   1. Hold the authoritative HuntState in memory; rehydrate from D1 lazily.
//   2. Accept WebSocket upgrades from team players (hibernation API).
//   3. On ClientMsg.action: validate → apply huntReducer → persist to D1 →
//      broadcast new state to every connected socket.
//   4. Track per-socket presence (player_id + name) for the presence frame.
//
// Persistence model: D1 is the source of truth. In-memory state is a cache.
// Every state mutation persists *before* broadcasting (durability over
// reactivity — if the DO crashes mid-flight, clients won't see a state that
// isn't in the database).

import { DurableObject } from 'cloudflare:workers';
import { huntReducer, initialState } from '../../shared/state/reducer';
import type {
  CheckpointIndex,
  HuntAction,
  HuntState,
  HuntStep,
} from '../../shared/state/types';
import type {
  ChatMessage,
  PlayerPresence,
  ServerMsg,
} from '../../shared/messages';
import { ClientMsgSchema } from '../../shared/messages';
import { HuntActionSchema } from '../../shared/state/schema';
import {
  deletePushSubscriptionByEndpoint,
  getTeamState,
  insertChatMessage,
  listPushSubsForTeamExcludingSender,
  listRecentChat,
  wipeChatForTeam,
  writeTeamState,
} from '../db/queries';
import { RateLimiter } from '../lib/rate-limits';
import { sendPush } from '../lib/push';
import type { Env } from '../index';

interface Attachment {
  playerId: string;
  name: string;
  connectedAt: number;
  // Optional GPS coords, updated via `presence_position` envelopes. Stored
  // on the WS attachment so they survive across DO hibernation cycles for
  // the lifetime of the socket.
  lat?: number;
  lng?: number;
  accuracy?: number;
  last_gps_at?: number;
}

export class TeamSession extends DurableObject<Env> {
  private state: HuntState = initialState;
  private loaded = false;
  private rateLimiter = new RateLimiter();

  private get teamId(): string {
    const name = this.ctx.id.name;
    if (!name) {
      throw new Error('TeamSession DO must be created via idFromName(teamId)');
    }
    return name;
  }

  // ── State load / persist ──────────────────────────────────────────

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const row = await getTeamState(this.env.DB, this.teamId);
    if (row) {
      this.state = {
        step: hydrateStep(row.step_kind, row.step_payload_json),
        unlocked: JSON.parse(row.unlocked_json) as HuntState['unlocked'],
        startedAt: row.started_at,
        testMode: false,
      };
    } else {
      this.state = initialState;
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    const { kind, payload } = dehydrateStep(this.state.step);
    await writeTeamState(this.env.DB, {
      team_id: this.teamId,
      step_kind: kind,
      step_payload_json: JSON.stringify(payload),
      unlocked_json: JSON.stringify(this.state.unlocked),
      started_at: this.state.startedAt,
    });
  }

  // ── Public surface (used by tests and routes) ─────────────────────

  /** Snapshot of the current HuntState (loads from D1 on first call). */
  async getState(): Promise<HuntState> {
    await this.ensureLoaded();
    return this.state;
  }

  /**
   * Apply an action via the shared reducer. Persists to D1, then broadcasts
   * the new state to all connected sockets. Returns the post-action state.
   */
  async applyAction(action: HuntAction): Promise<HuntState> {
    await this.ensureLoaded();
    this.state = huntReducer(this.state, action);
    await this.persist();
    this.broadcastState();
    return this.state;
  }

  // ── WebSocket lifecycle (hibernation API) ─────────────────────────

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('upgrade') === 'websocket') {
      return this.handleUpgrade(request);
    }
    const url = new URL(request.url);
    // Internal admin RPC: wipe this team's chat. We perform the DELETE here
    // (rather than in the admin route) so the operation runs through the
    // DO's input gate, serialised with any concurrent chat_send. Without
    // this, a player flooding chat_send during the admin's wipe could plant
    // a message that survives the DELETE (race window is small but exists).
    if (url.pathname === '/internal/chat/wipe' && request.method === 'POST') {
      const wiped = await wipeChatForTeam(this.env.DB, this.teamId);
      this.broadcast({ v: 1, type: 'chat_wiped' });
      return Response.json({ ok: true, wiped });
    }

    // Internal admin RPC: apply an action directly without going through the
    // WebSocket. The admin SPA POSTs here via stub.fetch when an operator
    // jumps a team to a specific step.
    if (url.pathname === '/internal/action' && request.method === 'POST') {
      let body: { action?: unknown };
      try {
        body = (await request.json()) as { action?: unknown };
      } catch {
        return new Response('bad json', { status: 400 });
      }
      const parsed = HuntActionSchema.safeParse(body.action);
      if (!parsed.success) {
        return new Response(
          JSON.stringify({ error: 'invalid action', issues: parsed.error.issues }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        );
      }
      const next = await this.applyAction(parsed.data);
      return Response.json({ state: next });
    }
    return new Response('not found', { status: 404 });
  }

  private async handleUpgrade(request: Request): Promise<Response> {
    await this.ensureLoaded();

    const url = new URL(request.url);
    const playerId = url.searchParams.get('player_id');
    const name = url.searchParams.get('player_name') ?? '';
    if (!playerId) {
      return new Response('player_id query param required', { status: 400 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);
    const attachment: Attachment = {
      playerId,
      name,
      connectedAt: Date.now(),
    };
    server.serializeAttachment(attachment);

    // Initial state frame — client doesn't render until this lands.
    server.send(stringify({ v: 1, type: 'state', state: this.state }));

    // Chat snapshot (last 50, chronological oldest-first). Sent right after
    // state so the drawer can hydrate from the very first frame.
    const recent = await listRecentChat(this.env.DB, this.teamId, 50);
    const messages: ChatMessage[] = recent
      .map((r) => ({
        id: r.id,
        player_id: r.player_id,
        player_name: '', // resolved below from attachments if possible
        body: r.body,
        created_at: r.created_at,
      }))
      .reverse(); // listRecentChat returns newest-first
    // Resolve player_name for each row from the players table (one round-trip
    // for the distinct player_ids).
    const ids = [...new Set(messages.map((m) => m.player_id))];
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      // Defense-in-depth: constrain to this team. player_ids should already
      // be team-scoped via the join flow, but a stale or mis-assigned row
      // could otherwise surface another team's name.
      const rows = await this.env.DB
        .prepare(
          `SELECT id, name FROM players
           WHERE id IN (${placeholders}) AND team_id = ?`,
        )
        .bind(...ids, this.teamId)
        .all<{ id: string; name: string }>();
      const nameById = new Map(
        (rows.results ?? []).map((r) => [r.id, r.name] as const),
      );
      for (const m of messages) {
        m.player_name = nameById.get(m.player_id) ?? '(removed)';
      }
    }
    server.send(stringify({ v: 1, type: 'chat_snapshot', messages }));

    this.broadcastPresence();

    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    if (typeof message !== 'string') return;
    let parsed;
    try {
      parsed = ClientMsgSchema.parse(JSON.parse(message));
    } catch (err) {
      ws.send(
        stringify({
          v: 1,
          type: 'error',
          code: 'invalid_message',
          message: (err as Error).message,
        }),
      );
      return;
    }

    if (parsed.type === 'ping') {
      ws.send(stringify({ v: 1, type: 'pong' }));
      return;
    }

    if (parsed.type === 'action') {
      try {
        await this.applyAction(parsed.action);
      } catch (err) {
        ws.send(
          stringify({
            v: 1,
            type: 'error',
            code: 'action_failed',
            message: (err as Error).message,
          }),
        );
      }
      return;
    }

    if (parsed.type === 'chat_send') {
      await this.handleChatSend(ws, parsed.body);
      return;
    }

    if (parsed.type === 'react_send') {
      this.handleReactSend(ws, parsed.emoji);
      return;
    }

    if (parsed.type === 'ping_send') {
      this.handlePingSend(ws, parsed.lat, parsed.lng);
      return;
    }

    if (parsed.type === 'presence_position') {
      this.handlePresencePosition(ws, parsed.lat, parsed.lng, parsed.accuracy);
      return;
    }
  }

  // ── Chat handler ──────────────────────────────────────────────────

  private async handleChatSend(ws: WebSocket, rawBody: unknown): Promise<void> {
    const body = typeof rawBody === 'string' ? rawBody.trim() : '';
    if (body.length === 0) {
      ws.send(
        stringify({
          v: 1,
          type: 'error',
          code: 'body_empty',
          message: 'chat body cannot be empty',
        }),
      );
      return;
    }
    if (body.length > 280) {
      ws.send(
        stringify({
          v: 1,
          type: 'error',
          code: 'body_too_long',
          message: 'chat body exceeds 280 characters',
        }),
      );
      return;
    }

    // Resolve sender identity from the attachment — never trust the envelope.
    const att = this.attachmentFor(ws);
    if (!att) {
      ws.send(
        stringify({
          v: 1,
          type: 'error',
          code: 'not_attached',
          message: 'socket has no player attachment',
        }),
      );
      return;
    }

    const limit = this.rateLimiter.check('chat', att.playerId);
    if (!limit.ok) {
      ws.send(
        stringify({
          v: 1,
          type: 'error',
          code: 'rate_limited',
          message: 'too many messages, slow down',
          retry_after_ms: limit.retry_after_ms,
        }),
      );
      return;
    }

    const row = await insertChatMessage(this.env.DB, {
      team_id: this.teamId,
      player_id: att.playerId,
      body,
    });

    const message: ChatMessage = {
      id: row.id,
      player_id: row.player_id,
      player_name: att.name,
      body: row.body,
      created_at: row.created_at,
    };
    this.broadcast({ v: 1, type: 'chat_new', message });

    // Fire-and-forget push to teammates' devices. Failure here must not
    // block the WS path (chat already broadcast, message persisted).
    this.fanOutChatPush(message).catch((err) => {
      console.warn('[push] fanout failed', err);
    });
  }

  // ── Push fan-out ──────────────────────────────────────────────────

  private async fanOutChatPush(message: ChatMessage): Promise<void> {
    const env = this.env;
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_CONTACT) {
      // Push isn't configured (e.g. local dev). Skip silently.
      return;
    }
    const subs = await listPushSubsForTeamExcludingSender(
      env.DB,
      this.teamId,
      message.player_id,
    );
    if (subs.length === 0) return;

    const payload = {
      title: message.player_name || 'New message',
      // Truncate body to 100 chars; payload total stays under 4 KB easily.
      body:
        message.body.length > 100
          ? message.body.slice(0, 99) + '…'
          : message.body,
      tag: `chat-${this.teamId}`,
      url: '/',
    };

    // Push deliveries concurrently. allSettled so a single 410-Gone doesn't
    // sink the others. Reap dead subscriptions on 404/410.
    const results = await Promise.allSettled(
      subs.map((s) =>
        sendPush(
          { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
          payload,
          {
            VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY!,
            VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY!,
            VAPID_CONTACT: env.VAPID_CONTACT!,
          },
        ),
      ),
    );
    const deadEndpoints: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value.gone) {
        deadEndpoints.push(subs[i].endpoint);
      }
    });
    for (const endpoint of deadEndpoints) {
      await deletePushSubscriptionByEndpoint(env.DB, endpoint).catch(() => {});
    }
  }

  // ── Reaction handler (ephemeral, no D1) ───────────────────────────

  private reactSeq = 0;

  private handleReactSend(
    ws: WebSocket,
    emoji: import('../../shared/messages').ReactionEmoji,
  ): void {
    const att = this.attachmentFor(ws);
    if (!att) {
      ws.send(
        stringify({
          v: 1,
          type: 'error',
          code: 'not_attached',
          message: 'socket has no player attachment',
        }),
      );
      return;
    }
    const limit = this.rateLimiter.check('reaction', att.playerId);
    if (!limit.ok) {
      ws.send(
        stringify({
          v: 1,
          type: 'error',
          code: 'rate_limited',
          message: 'too many reactions, slow down',
          retry_after_ms: limit.retry_after_ms,
        }),
      );
      return;
    }
    const id = `r${Date.now().toString(36)}${(++this.reactSeq).toString(36)}`;
    this.broadcast({
      v: 1,
      type: 'react_show',
      emoji,
      sender_id: att.playerId,
      sender_name: att.name,
      id,
    });
  }

  // ── Ping handler (ephemeral, no D1) ───────────────────────────────

  private pingSeq = 0;
  private static readonly PING_TTL_MS = 5_000;

  private handlePingSend(ws: WebSocket, lat: number, lng: number): void {
    const att = this.attachmentFor(ws);
    if (!att) {
      ws.send(stringify({
        v: 1, type: 'error', code: 'not_attached',
        message: 'socket has no player attachment',
      }));
      return;
    }
    const limit = this.rateLimiter.check('ping', att.playerId);
    if (!limit.ok) {
      ws.send(stringify({
        v: 1, type: 'error', code: 'rate_limited',
        message: 'too many pings, slow down',
        retry_after_ms: limit.retry_after_ms,
      }));
      return;
    }
    const now = Date.now();
    const id = `pg${now.toString(36)}${(++this.pingSeq).toString(36)}`;
    this.broadcast({
      v: 1,
      type: 'ping_show',
      lat, lng,
      sender_id: att.playerId,
      sender_name: att.name,
      id,
      expires_at: now + TeamSession.PING_TTL_MS,
    });
  }

  // ── Presence position update ──────────────────────────────────────

  private handlePresencePosition(
    ws: WebSocket,
    lat: number,
    lng: number,
    accuracy?: number,
  ): void {
    const att = this.attachmentFor(ws);
    if (!att) return; // silent — position updates are best-effort
    const next: Attachment = {
      ...att,
      lat, lng, accuracy,
      last_gps_at: Date.now(),
    };
    ws.serializeAttachment(next);
    this.broadcastPresence();
  }

  private attachmentFor(ws: WebSocket): Attachment | null {
    try {
      return (ws.deserializeAttachment() as Attachment | null) ?? null;
    } catch {
      return null;
    }
  }

  override async webSocketClose(
    _ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    this.broadcastPresence();
  }

  override async webSocketError(_ws: WebSocket, _err: unknown): Promise<void> {
    this.broadcastPresence();
  }

  // ── Broadcast helpers ─────────────────────────────────────────────

  private broadcastState(): void {
    this.broadcast({ v: 1, type: 'state', state: this.state });
  }

  private broadcastPresence(): void {
    const players: PlayerPresence[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const att = ws.deserializeAttachment() as Attachment | null;
        if (att) {
          players.push({
            playerId: att.playerId,
            name: att.name,
            connectedAt: att.connectedAt,
            lat: att.lat,
            lng: att.lng,
            accuracy: att.accuracy,
            last_gps_at: att.last_gps_at,
          });
        }
      } catch {
        /* socket might be closing — skip */
      }
    }
    this.broadcast({ v: 1, type: 'presence', players });
  }

  private broadcast(msg: ServerMsg): void {
    const text = stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(text);
      } catch {
        /* swallow — closed sockets are cleaned up by the runtime */
      }
    }
  }
}

// ── Step (de)hydration helpers (kept module-local) ────────────────

function hydrateStep(kind: string, payloadJson: string): HuntStep {
  const payload = JSON.parse(payloadJson) as Record<string, unknown>;
  switch (kind) {
    case 'intro': return { kind: 'intro' };
    case 'gps-preface': return { kind: 'gps-preface' };
    case 'location':
      return { kind: 'location', n: payload.n as CheckpointIndex };
    case 'reveal':
      return { kind: 'reveal', n: payload.n as CheckpointIndex };
    case 'photo':
      return { kind: 'photo', afterN: payload.afterN as CheckpointIndex };
    case 'finale': return { kind: 'finale' };
    default:
      throw new Error(`unknown step kind: ${kind}`);
  }
}

function dehydrateStep(step: HuntStep): {
  kind: string;
  payload: Record<string, unknown>;
} {
  switch (step.kind) {
    case 'intro':
    case 'gps-preface':
    case 'finale':
      return { kind: step.kind, payload: {} };
    case 'location':
    case 'reveal':
      return { kind: step.kind, payload: { n: step.n } };
    case 'photo':
      return { kind: 'photo', payload: { afterN: step.afterN } };
  }
}

// Stringify a ServerMsg for the wire. Centralised so we can swap to a leaner
// codec later without touching every call site.
function stringify(msg: ServerMsg | { v: 1; type: 'pong' }): string {
  return JSON.stringify(msg);
}
