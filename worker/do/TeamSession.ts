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
import type { PlayerPresence, ServerMsg } from '../../shared/messages';
import { ClientMsgSchema } from '../../shared/messages';
import { getTeamState, writeTeamState } from '../db/queries';
import type { Env } from '../index';

interface Attachment {
  playerId: string;
  name: string;
  connectedAt: number;
}

export class TeamSession extends DurableObject<Env> {
  private state: HuntState = initialState;
  private loaded = false;

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
