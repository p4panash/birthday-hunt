# Spec: Social Bundle (Phase 1 of goodLoot multi-phase roadmap)

> **Status:** Draft 2026-05-27. Pending user approval before Phase 2 (Plan).
> **Predecessor:** `specs/multiplayer-backend.md` (shipped on `feat/goodloot`).
> **Successors planned:** Platform Polish (PWA + multi-tenant cleanup),
> Native Wrap & Store Launch (Capacitor + App Store/Play Store).

## Objective

Add three co-op-amplifying features on top of the shipped multiplayer
backend, **without modifying the hunt state machine**:

1. **Team chat** — lightweight, in-team, persisted-during-hunt text
   messaging accessible from the existing `PresenceRibbon`.
2. **Floating reactions** — fixed-set emoji broadcast to all teammates'
   screens, ephemeral (2s float).
3. **Map with pings** — mini Leaflet map under `WarmthPulse` in
   `LocationActive`, showing self + teammates with live distance,
   tap-to-ping markers, and an orange "🎯 check this spot" marker
   when GPS warmth status reaches `onTop` (≤25 m).

### Why this matters

The shipped multiplayer makes state shared. The Social bundle makes the
*experience* shared: teammates can talk during the hunt, celebrate
together when one cracks a checkpoint, and coordinate physical movement
("I'm over here, come this way"). Without these, two browsers in sync
is technically multiplayer but emotionally still solo.

### Users and roles

Unchanged from `multiplayer-backend.md`:

- **Player** — sends/receives chat, reactions, pings. Sees teammates'
  positions on the mini-map when on the `LocationActive` screen.
- **Admin** — gains one new affordance: `Wipe chat` button on the team
  detail view, audit-logged.

### Success criteria

- **Chat latency**: a message typed on device A appears on device B in
  the same team within 500 ms under normal network conditions.
- **Chat persistence**: refreshing the page restores the last 50
  messages from D1, in chronological order.
- **Reactions**: tapping an emoji on device A produces a 2-second
  floating animation on every connected teammate's screen, labelled
  with the sender's name. Reactions sent while a teammate is offline
  are *lost* (by design).
- **Map**: device A's position appears as a blue marker on its own
  map; teammates appear as green markers with their first name and
  distance in metres. The map updates within 1 s of any teammate's
  GPS tick. At GPS status `onTop`, an orange checkpoint marker
  appears at the checkpoint's `(lat, lng)`.
- **Pings**: tapping anywhere on the map sends a yellow pulse marker
  that appears on all teammates' maps for 5 seconds, then fades. The
  sender's name floats above the marker.
- **Admin wipe**: clicking `Wipe chat` deletes every row in
  `chat_messages` for that team, writes a row to `audit_log` with
  the admin's email and target team, and broadcasts a `chat/wiped`
  event so connected clients clear their UI without a refresh.
- **Solo mode regression**: solo mode shows none of these features
  (no chat drawer, no map, no reaction tray, no ping target) — solo
  is single-player by definition. Existing Playwright `solo.spec.ts`
  must still pass.
- **Reducer untouched**: `shared/state/reducer.ts` and
  `shared/state/types.ts` are not modified. The Social bundle is a
  *parallel* WS channel; the state machine is unaware of it.

### Non-goals (explicit)

- No reactions attached to specific chat messages (no Slack-style
  message reacts). Reactions are screen-floating only.
- No voice chat, no video, no GIFs, no attachments, no edit/delete
  on individual messages.
- No cross-team chat. Every chat thread is scoped to one team's
  Durable Object. (If two teams play the same hunt, they cannot see
  each other's chat.)
- No private DMs between teammates. Team-wide only.
- No live cursor positions on the map — only GPS positions. (A cursor
  on a map you can pan independently of the world is a separate
  feature requiring shared map viewport, which is out of scope.)
- No moderation beyond rate limits and admin wipe (no word filter,
  no reports — the team is invite-only and ≤10 players, so trust is
  assumed).
- No notifications when chat arrives in a different tab. (Web Push
  belongs to Phase 2, not Phase 1.)

---

## Architecture

The shipped multiplayer Worker already has one Durable Object instance
per team, with WebSocket hibernation, accepting `ClientMsg` envelopes
of kind `state/action`. Phase 1 extends the same DO with three new
client message kinds (`chat/send`, `react/send`, `ping/send`) and four
new server message kinds (`chat/snapshot`, `chat/new`, `chat/wiped`,
`react/show`, `ping/show`). The hunt reducer is not modified.

```
              TeamSession Durable Object (per team)
              ┌──────────────────────────────────────────────────┐
              │ WS hibernate handler                             │
              │  webSocketMessage(ws, msg)                       │
              │   ↓ parse envelope (Zod ClientMsg discriminated  │
              │     union, v=1)                                  │
 ws ──── ▶    │   ├── kind=state/action  → existing reducer path │
              │   ├── kind=chat/send                              │
              │   │     → rate-limit check (in-DO memory)        │
              │   │     → INSERT chat_messages(team_id, …)        │
              │   │     → broadcast {kind:chat/new, message}     │
              │   ├── kind=react/send                              │
              │   │     → rate-limit check                       │
              │   │     → broadcast {kind:react/show, emoji,…}   │
              │   │       (no storage)                            │
              │   └── kind=ping/send                              │
              │         → rate-limit check                       │
              │         → broadcast {kind:ping/show, lat, lng,…} │
              │           (no storage)                            │
              │                                                  │
              │ On new WS attach:                                │
              │   SELECT last 50 chat_messages → ws.send(        │
              │     {kind:chat/snapshot, messages})              │
              │                                                  │
              │ RPC endpoint /internal/chat/wipe:                │
              │   admin route calls this after audit_log write.  │
              │   DELETE FROM chat_messages WHERE team_id=?      │
              │   broadcast {kind:chat/wiped}                    │
              └──────────────────────────────────────────────────┘
```

**Storage cost.** Chat is the only persisted channel. At 280 chars per
message, 50-message cap practical history per team, and ≤10 teams per
hunt, the worst case is ~140 KB per hunt. D1's free tier covers this
trivially. Reactions and pings hit nothing but in-memory broadcast.

**Rate limiting.** A `Map<playerId, number[]>` per DO instance tracks
timestamps of the last N events per player. On each `*/send`, we
prune entries older than 60s and check the count. Caps:

- chat: ≤ 1 / sec, ≤ 30 / minute per player; ≤ 280 chars body
- reactions: ≤ 2 / sec, ≤ 60 / minute per player
- pings: ≤ 1 / sec, ≤ 20 / minute per player

A rejection sends `{kind:error, code:'rate_limited', retry_after_ms}`
to only the offending socket; no broadcast, no D1 write.

**Hibernation behavior.** The DO can hibernate between events. The
rate-limit map is rebuilt on wake from a fresh empty Map — losing
limit history on hibernation is acceptable (limits exist to stop
buggy clients, not to enforce a hard quota). Chat persistence is
in D1, so it survives.

---

## Data model (D1)

One new migration: `worker/db/migrations/0002_chat.sql`.

```sql
CREATE TABLE chat_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id    TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id  TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL  -- Date.now() ms
);
CREATE INDEX idx_chat_team_created
  ON chat_messages(team_id, created_at DESC);
```

No schema modifications to existing tables. The cascade on `team_id`
means a future "delete team" admin action naturally wipes chat too.

Query helpers added to `worker/db/queries.ts`:

- `insertChatMessage(db, { team_id, player_id, body, created_at })` →
  returns the inserted `{ id, … }` row.
- `listRecentChat(db, team_id, limit=50)` → newest N, ordered DESC,
  reversed in JS for client (oldest first).
- `wipeChatForTeam(db, team_id)` → DELETE, returns affected count.

---

## WS protocol additions

Extension of `shared/messages.ts`. All envelopes carry `v: 1`. The
existing union is widened with these new variants:

```ts
// Client → server
type ClientMsg =
  | { v: 1; kind: 'state/action'; action: HuntAction }   // existing
  | { v: 1; kind: 'chat/send';    body: string }
  | { v: 1; kind: 'react/send';   emoji: ReactionEmoji }
  | { v: 1; kind: 'ping/send';    lat: number; lng: number };

type ReactionEmoji = '🎉' | '❤️' | '🔥' | '😭' | '🙄' | '👀';

// Server → client
type ServerMsg =
  | { v: 1; kind: 'state/snapshot'; state: HuntState }       // existing
  | { v: 1; kind: 'state/update';   state: HuntState }       // existing
  | { v: 1; kind: 'presence';       players: PlayerPresence[] } // existing
  | { v: 1; kind: 'chat/snapshot';  messages: ChatMessage[] }
  | { v: 1; kind: 'chat/new';       message: ChatMessage }
  | { v: 1; kind: 'chat/wiped' }
  | { v: 1; kind: 'react/show';     emoji: ReactionEmoji;
                                     sender_id: string; sender_name: string;
                                     id: string }
  | { v: 1; kind: 'ping/show';      lat: number; lng: number;
                                     sender_id: string; sender_name: string;
                                     id: string; expires_at: number }
  | { v: 1; kind: 'error';          code: ErrorCode;
                                     retry_after_ms?: number };

interface ChatMessage {
  id: number;          // monotonic from D1 autoinc
  player_id: string;
  player_name: string; // denormalized at insert from players.name
  body: string;
  created_at: number;  // ms
}
```

All new envelopes are validated via Zod schemas in
`shared/messages.ts` and re-exported. The DO discards any envelope
that fails parsing (with an `error` response on the same socket).

---

## HTTP API additions

One new admin endpoint:

```
POST /api/admin/hunts/:huntId/teams/:teamId/chat/wipe
  → 200 { ok: true, wiped: number }
  → 401 if no Access JWT
  → 404 if team not found
```

Behavior:
1. Resolve admin email from CF Access JWT (existing `worker/lib/access.ts`).
2. Verify the team exists and belongs to the hunt.
3. Write `audit_log` row: `{ admin_email, action:'chat.wipe',
   target:<teamId>, payload_json:'{}' }`.
4. `DELETE FROM chat_messages WHERE team_id = ?`.
5. Fetch the DO stub and POST to its `/internal/chat/wipe` endpoint
   so connected clients receive a `chat/wiped` broadcast and clear
   their UI.

No new player-facing HTTP endpoints. Chat send/list happens entirely
over the existing WebSocket.

---

## Frontend changes

### `useTeamState` hook extension

Today `useTeamState` returns `{ state, dispatch, presence, ... }`.
Extended return shape:

```ts
{
  state, dispatch, presence,
  chat: ChatMessage[],          // chronological, append-on-arrival
  sendChat: (body: string) => void,
  reactions: FloatingReaction[], // active for 2s each, then GC'd
  sendReaction: (emoji: ReactionEmoji) => void,
  pings: ActivePing[],           // active for 5s each, then GC'd
  sendPing: (lat: number, lng: number) => void,
  chatWiped: boolean,           // pulses true for 1s after wipe (toast trigger)
}
```

Implementation notes:
- `chat`: starts empty, populated by `chat/snapshot` on connect,
  appended by `chat/new`, cleared by `chat/wiped`.
- `reactions`, `pings`: arrays with `expires_at`. A single
  `setInterval(prune, 500)` removes expired entries.
- All `send*` functions: throttle client-side too (best-effort UX —
  the server is the authority) to suppress accidental double-taps.

### New components

- `src/components/ChatDrawer.tsx` — slide-in panel from the right.
  Header (team name + close), scrollable message list (own messages
  right-aligned + accent, others left-aligned), input + send button.
  Empty state: "No messages yet. Say hi 👋".
- `src/components/ReactionTray.tsx` — horizontal pill with 6 emojis,
  pinned bottom-right above the chat fab. Tap = `sendReaction`.
- `src/components/FloatingReactionLayer.tsx` — full-screen pointer-
  events:none layer, renders each active reaction as an absolutely-
  positioned emoji that floats up and fades (CSS `@keyframes`, no
  motion lib needed for this).
- `src/components/TeamMap.tsx` — Leaflet map, 200px tall, OSM tiles,
  zoom-locked between 14 and 18. Markers:
  - Self: blue circle, no label.
  - Teammates: green circle with name + distance label.
  - Pings: yellow pulse (CSS animation) with sender label, 5s
    lifespan.
  - Checkpoint indicator: orange 🎯 marker, *only* when local GPS
    status === `onTop` (≤25 m). Coordinates pulled from the active
    checkpoint config.
  Tap handler: emit `ping/send` with `(lat, lng)` from the click.

### Modified components

- `src/components/PresenceRibbon.tsx` — adds a chat button (count
  badge for unread). Click → opens `ChatDrawer`.
- `src/screens/LocationActive.tsx` — inserts `<TeamMap />` between
  `<WarmthPulse />` and `<StuckSheet />` access button. Inserts
  `<ReactionTray />` and `<FloatingReactionLayer />` as siblings.
- `src/admin/AdminApp.tsx` (HuntDetail view) — adds `Wipe chat`
  button per team row, with confirm dialog. POSTs to the new admin
  endpoint, shows toast on success.

### Solo mode

`SoloMode.tsx` does *not* use `useTeamState`. It already runs
client-side reducer only. None of the chat/reaction/ping/map
components mount in solo mode — they're inside `TeamMode.tsx` only.
This is verified by an addition to `solo.spec.ts`: `expect(page.
locator('[data-testid="chat-fab"]')).toHaveCount(0)`.

---

## Dependencies

One new runtime dependency:

```
leaflet@^1.9.4         // mini-map, MIT
@types/leaflet         // dev
```

Leaflet was chosen over Mapbox GL JS / MapLibre because:
- Smaller bundle (~38 KB gz vs ~200 KB gz for MapLibre).
- No tile-server bill or token. OSM tiles are free (with attribution).
- Vector tiles unnecessary for a 200 px mini-map.
- Familiar React patterns via `react-leaflet`, but we use vanilla
  Leaflet to avoid the wrapper's churn.

OSM attribution ("© OpenStreetMap contributors") is rendered in the
bottom-right of the map as required by ODbL.

---

## Testing strategy

### Unit / integration (vitest + Miniflare D1)

- `tests/worker/chat-flow.test.ts`:
  - Two simulated clients on same team see each other's chat.
  - Chat persists across reconnect (snapshot on attach).
  - Body >280 chars → `error:body_too_long`.
  - >30 messages in 60 s → `error:rate_limited`.
- `tests/worker/reaction-ping.test.ts`:
  - React broadcast reaches all sockets, includes sender_name.
  - Ping broadcast includes coords + expires_at.
  - Rate limits enforced for both.
- `tests/worker/admin-chat-wipe.test.ts`:
  - Admin endpoint deletes rows, writes audit_log, triggers
    `chat/wiped` broadcast.
  - Unauthenticated call → 401.
  - Wrong team for hunt → 404.

### E2E (Playwright)

New file `tests/e2e/social.spec.ts`:
- Two tabs, same team. Tab A sends chat; tab B sees it within 1 s.
- Tab A sends reaction; tab B shows floating emoji within 1 s.
- Tab A taps the map; tab B sees ping marker, marker fades after 5 s.
- Admin wipes chat from admin UI; both tabs show empty chat
  immediately.
- Solo tab opens; no chat/reaction/map controls render.

`gameplay.spec.ts` and `cooperative.spec.ts` are unchanged and must
still pass (regression gate).

---

## Acceptance checklist (Phase 4 "Implement" exit gate)

- [ ] All new vitest cases pass under `npm run worker:test`.
- [ ] New e2e cases pass and existing e2e remain green under
      `npm run e2e`.
- [ ] `npm run verify` is green.
- [ ] Leaflet bundle does not regress total gz size by more than
      50 KB (tracked via `dist/` size check in `npm run build`).
- [ ] Chat works on a real phone (manual: `hunt.use-adonis.com` on
      iOS Safari + Android Chrome).
- [ ] No regression in solo-mode Playwright suite.
- [ ] `audit_log` shows `chat.wipe` row after an admin wipe.
- [ ] Code-reviewer subagent run on the diff returns no high-severity
      findings.

---

## Boundaries

**Always:**
- Use the shared `useTeamState` extension; do not introduce a second
  WS connection.
- Validate every inbound envelope through Zod in
  `shared/messages.ts`. The DO is hostile to unknown shapes.
- Persist chat only. Reactions and pings stay ephemeral.

**Ask first:**
- Before raising any rate-limit cap.
- Before adding a new emoji to the fixed reaction set (UI affordance
  + i18n implications).
- Before persisting reactions or pings (would change Phase 1 to
  Phase 1.5 of a different shape).

**Never:**
- Modify `shared/state/reducer.ts` or `shared/state/types.ts` for
  Phase 1.
- Add chat as a feature of solo mode.
- Allow chat across teams in the same hunt.
- Trust client-supplied `player_name` — denormalize at insert from
  `players.name`.
- Render or accept `<img>`, `<script>`, or any HTML in chat bodies —
  treat as plain text, render via text node only (no
  `dangerouslySetInnerHTML`).
