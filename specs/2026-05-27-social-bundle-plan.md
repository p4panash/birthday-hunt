# Plan: Social Bundle (Phase 1 implementation plan)

> **Spec:** `specs/2026-05-27-social-bundle.md`
> **Status:** Draft 2026-05-27. Pending approval before Phase 3 (Tasks).

## Dependency graph

The three social features and the admin wipe slice cleanly into four
vertical phases. Each phase is end-to-end testable on its own and
unblocks the next.

```
                ┌─────────────────────────────────────────────────┐
                │ P0. Protocol + D1 foundation                    │
                │  • shared/messages.ts adds 5 envelopes + 1 type │
                │  • 0002_chat.sql migration                       │
                │  • queries.ts: insert/list/wipe chat helpers    │
                │  • leaflet dep installed (frontend only)        │
                └─────────────────────┬───────────────────────────┘
                                      ▼
        ┌─────────────────────────────┴──────────────────────────┐
        │                                                         │
        ▼                                                         ▼
┌──────────────────┐                                    ┌──────────────────┐
│ P1. Chat slice   │                                    │ P2. Floating     │
│                  │                                    │     reactions    │
│ DO handler +     │                                    │     slice        │
│ snapshot on attach                                    │                  │
│ ChatDrawer +     │                                    │ DO handler +     │
│ PresenceRibbon   │                                    │ ReactionTray +   │
│ button           │                                    │ FloatingReaction │
│                  │                                    │ Layer            │
└──────┬───────────┘                                    └──────┬───────────┘
       │                                                       │
       ▼                                                       │
┌──────────────────┐                                           │
│ P1.5 Admin wipe  │                                           │
│ POST endpoint +  │                                           │
│ DO RPC +          │                                           │
│ admin SPA button │                                           │
└──────┬───────────┘                                           │
       │                                                       │
       └───────────────────────┬───────────────────────────────┘
                               ▼
                ┌──────────────────────────────────┐
                │ P3. Map + pings slice            │
                │  TeamMap (Leaflet)               │
                │  Self / teammate markers          │
                │  Live distance compute            │
                │  onTop checkpoint marker          │
                │  DO ping handler + UI ping        │
                │  fade animation                   │
                └──────────────┬───────────────────┘
                               ▼
                ┌──────────────────────────────────┐
                │ P4. Verify + ship                │
                │  npm run verify                  │
                │  Real-device smoke               │
                │  Code-reviewer subagent on diff  │
                │  Security-auditor on admin route │
                │  Deploy via /ship                │
                └──────────────────────────────────┘
```

## Why this slicing

Three principles drive the order:

1. **P0 must land first.** Protocol additions in `shared/messages.ts`
   and the D1 migration are foundational — they unblock both backend
   and frontend work simultaneously. Until P0 is shipped (even just
   the schema changes), everything else has compile errors.
2. **P1 and P2 are independent siblings.** Chat and reactions touch
   different DO message kinds, different UI surfaces, and store
   data differently. They can be built and tested in any order
   relative to each other after P0. The plan presents them
   sequentially (P1 → P1.5 → P2) only because that maps cleanly to
   commits; a developer can swap P1 and P2 without rework.
3. **P3 depends on the WS hook extension that P1 introduces.**
   `useTeamState` gets a chat field in P1 and gains pings in P3,
   reusing the same plumbing. Doing P3 first would require touching
   the hook twice.

P1.5 (admin wipe) sits inside P1 because it shares the same chat
domain model and same audit_log plumbing — wiring them together
keeps the diff small and reviewable.

## Phase contracts (entry / exit criteria)

### P0 — Protocol + D1 foundation

**Goal:** every type, table, helper, and dep the rest of the plan
needs is present and exported, with no behavior wired up yet.

**Entry conditions:** working tree clean on `feat/goodloot`.
PR #1 spec docs committed.

**Exit conditions:**
- `shared/messages.ts` exports the widened `ClientMsg` and
  `ServerMsg` unions per spec § "WS protocol additions". Existing
  vitest tests still pass (no behavioral change yet — the DO
  doesn't handle new kinds yet, so the parser will accept them
  but the handler ignores them; the tests assert *existing*
  behavior, which is unchanged).
- `worker/db/migrations/0002_chat.sql` exists; `npm run db:migrate`
  applies it locally and `tests/setup.ts` picks it up.
- `worker/db/queries.ts` exports `insertChatMessage`,
  `listRecentChat`, `wipeChatForTeam`. New `tests/worker/chat-
  queries.test.ts` proves each helper's contract (insert returns
  id; list returns chronological newest-N; wipe deletes only the
  team's rows).
- `leaflet@^1.9.4` and `@types/leaflet` installed; `package.json`
  diff shows nothing else.
- `npm run verify` is green.

**Estimated effort:** ~3h.

**Verification:**
```bash
npm run worker:test                      # chat-queries.test.ts green, all existing tests still green
npm run typecheck                        # widened envelopes don't break call sites
npm run build                            # leaflet treeshake check; bundle size logged
```

### P1 — Chat slice

**Goal:** two browsers on the same team can chat live; refresh
restores history.

**Entry conditions:** P0 exits green.

**Exit conditions:**
- `TeamSession.webSocketMessage` handles `chat_send`:
  - Validates body length (≤280 chars; on overflow, send
    `error` with code `body_too_long`, no broadcast).
  - Enforces rate limit (≤1/sec, ≤30/min; on overflow, send
    `error` with code `rate_limited` + `retry_after_ms`).
  - Resolves `player_name` from the WS attachment (NOT from the
    inbound envelope — see spec "Never").
  - INSERTs into D1, broadcasts `chat_new` with the canonical row.
- `TeamSession.handleUpgrade` sends a `chat_snapshot` (last 50,
  chronological oldest-first) immediately after the initial
  state frame.
- `useTeamState` returns `chat`, `sendChat`, `chatWiped`.
- `src/components/ChatDrawer.tsx` renders a slide-in drawer with
  the message list (own messages right-aligned + accent, others
  left-aligned + sender name), input, send button. Empty state
  message. Auto-scroll to bottom on new message *only if* user
  is already at bottom (don't yank them up when reading history).
- `src/components/PresenceRibbon.tsx` gains a chat fab with an
  unread-count badge (count = messages received while drawer
  closed; reset on open).
- `tests/worker/chat-flow.test.ts` covers: two-client send/receive,
  reconnect restores history, body-too-long, rate-limit.
- Solo regression: `solo.spec.ts` still passes, asserts chat fab
  not present (`getByTestId('chat-fab')` count == 0).

**Verification:**
```bash
npm run worker:test -- chat-flow         # new vitest cases
npm run e2e -- --grep "chat"             # cooperative chat e2e
npm run verify                            # full gate
```

### P1.5 — Admin wipe

**Goal:** admin can purge a team's chat with one click; UI clears
without a refresh; audit_log records it.

**Entry conditions:** P1 exits green.

**Exit conditions:**
- New route `POST /api/admin/hunts/:huntId/teams/:teamId/chat/wipe`
  in `worker/routes/admin.ts`:
  - CF Access-protected (existing middleware).
  - Verifies team belongs to hunt → 404 otherwise.
  - Writes `audit_log` row with `action='chat.wipe'`.
  - Calls D1 `wipeChatForTeam`.
  - Calls DO via `stub.fetch('http://internal/internal/chat/
    wipe', { method: 'POST' })`.
  - Returns `{ ok: true, wiped: <count> }`.
- `TeamSession.fetch` handles `/internal/chat/wipe`: broadcasts
  `chat_wiped` to all connected sockets.
- `useTeamState` clears `chat` and pulses `chatWiped` for ~1s on
  receiving `chat_wiped` (allows UI toast).
- `src/admin/AdminApp.tsx` HuntDetail view adds a `Wipe chat`
  button per team, confirm dialog, POSTs to the new endpoint,
  toast on success.
- `tests/worker/admin-chat-wipe.test.ts`: success path, missing
  team 404, unauthenticated 401, audit_log row written.

**Verification:** `npm run verify` green + audit_log row visible in
`/admin/history` after a real wipe.

### P2 — Floating reactions

**Goal:** tap an emoji on device A → floating animation on every
teammate's screen within 1s.

**Entry conditions:** P1 exits green (uses the same `useTeamState`
extension pattern).

**Exit conditions:**
- `TeamSession.webSocketMessage` handles `react_send`:
  - Validates emoji is in fixed set (Zod literal union).
  - Enforces rate limit (≤2/sec, ≤60/min).
  - Resolves sender_id + sender_name from attachment.
  - Generates a server-side `id` (DO-incrementing counter is
    fine — no D1).
  - Broadcasts `react_show`. No persistence.
- `useTeamState` returns `reactions: FloatingReaction[]`,
  `sendReaction(emoji)`. Internal GC interval prunes entries
  after their 2-second TTL.
- `src/components/ReactionTray.tsx`: fixed-position pill with 6
  emojis, pinned bottom-right above the chat fab. Tap = local
  echo + `sendReaction`. (Local echo avoids the round-trip lag
  for the sender's own emoji.)
- `src/components/FloatingReactionLayer.tsx`: full-screen
  `pointer-events:none` layer; each entry renders as an
  absolutely-positioned emoji + sender-name caption that floats
  up via CSS `@keyframes` and fades. Randomized horizontal jitter
  so 3 simultaneous 🎉 don't overlap.
- `tests/worker/reaction-flow.test.ts`: two-client broadcast,
  rate-limit, invalid emoji → error.
- Solo regression still green.

**Verification:** `npm run verify` + browser-harness manual check:
two tabs side-by-side, 🎉 tap visibly floats on the other within
1s.

### P3 — Map + pings

**Goal:** mini Leaflet map shows self + teammates with live
distance; tap to ping; checkpoint indicator at `onTop`.

**Entry conditions:** P2 exits green.

**Exit conditions:**
- `src/components/TeamMap.tsx`:
  - Lazy-loaded (`React.lazy` + `Suspense`) so Leaflet's 38KB
    doesn't enter the main bundle.
  - Initializes Leaflet on a 200px-tall div under WarmthPulse.
  - OSM tiles, zoom locked 14–18, recenter on self position
    (with debounced auto-pan).
  - Self marker: blue circle, no label.
  - Teammate markers: green circle + tooltip with name + distance
    (uses existing `geo/haversine.ts`).
  - When `WarmthStatus === 'onTop'`: orange `🎯` marker at the
    active checkpoint's `(lat, lng)`.
  - Ping markers: yellow CSS-animated pulse + sender label, 5s
    lifetime via the `expires_at` field.
  - On map click: emit `ping_send` with click `(lat, lng)`. Local
    echo, just like reactions.
- `TeamSession.webSocketMessage` handles `ping_send`:
  - Rate-limit (≤1/sec, ≤20/min).
  - Broadcasts `ping_show` with sender info + DO-side
    `expires_at = Date.now() + 5000`.
- `useTeamState`: `pings: ActivePing[]`, `sendPing(lat, lng)`,
  GC on expiry.
- Teammate GPS positions: piggyback on existing presence ticks
  (no new envelope). Extend `PlayerPresence` with optional
  `lat?`, `lng?`, `accuracy?`, `last_gps_at?`. Hook sends a
  position update on every `useGeoWatch` tick (≤1 / 2 s).
- OSM attribution rendered.
- `src/screens/LocationActive.tsx` mounts `<TeamMap>` between
  WarmthPulse and StuckSheet access button.
- `tests/worker/ping-flow.test.ts`: ping broadcast + rate-limit.
- E2E in `tests/e2e/social.spec.ts`:
  - Tab A taps map at coords → Tab B sees marker.
  - Marker fades after 5s.

**Verification:** `npm run verify` + real-device check (zoom, pan,
double-tap don't reset the map).

### P4 — Verify + ship

**Goal:** the whole bundle is green, reviewed, and deployed.

**Entry conditions:** P3 exits green.

**Exit conditions:**
- `npm run verify` is green from cold (no caches, no skips).
- `feature-dev:code-reviewer` subagent run on the full P0–P3 diff
  reports no high-severity findings.
- `agent-skills:security-auditor` subagent run on the admin wipe
  route + the chat insert path reports no high-severity findings.
- `agent-skills:ship` walked through; D1 remote migration applied
  with `npm run db:migrate:remote`; Worker deployed; Pages built.
- Manual smoke on two real devices on production
  `hunt.use-adonis.com`: chat + 🎉 reaction + ping all work.

## Rate limit numbers (one place, not scattered)

Single source of truth, lives in `worker/lib/rate-limits.ts`
(new file):

```ts
export const RATE_LIMITS = {
  chat:     { perSecond: 1, perMinute: 30, bodyMaxChars: 280 },
  reaction: { perSecond: 2, perMinute: 60 },
  ping:     { perSecond: 1, perMinute: 20 },
} as const;
```

If a future change wants tighter or looser limits, this is the one
file to edit. Tests import this constant rather than hard-coding
numbers.

## Checkpoints (mandatory pauses between phases)

After every phase exit:

1. Run `npm run verify`. Green = phase exits. Red = stay in phase.
2. Spawn `feature-dev:code-reviewer` subagent on the phase diff
   with a one-line context (per CLAUDE.md Rule 5). Resolve any
   high-severity findings before continuing.
3. Commit with a conventional message (`feat(social): ...`,
   `test(social): ...`).
4. Push to `origin/feat/goodloot`. PR #1 picks up the commits
   automatically.

Phase boundaries are also good points to run `agent-skills:doubt-
driven-development` if a non-obvious decision came up mid-phase
(per Rule 2).

## Estimated total effort

| Phase | Effort | Cumulative |
|------:|-------:|-----------:|
| P0    |   3h   |  3h        |
| P1    |   5h   |  8h        |
| P1.5  |   2h   | 10h        |
| P2    |   3h   | 13h        |
| P3    |   6h   | 19h        |
| P4    |   2h   | 21h        |

About **2-3 working days** end-to-end at a sustainable pace,
including the test-write-first discipline mandated by Rule 4 (TDD
on backend logic) and the per-phase code review.

## Known risks and mitigations

1. **Leaflet bundle size regression** — mitigated by lazy-load +
   `dist/` size check in acceptance criteria. If gz delta > 50 KB
   investigation triggers before P4.
2. **DO rate-limit map memory growth** — bounded by `[playerId,
   timestamp[]]` pruning to last 60s; per player worst case ~60
   numbers in memory. Across 10 players ≈ 600 numbers. Trivial.
3. **OSM tile rate limits** — public OSM has soft 70 req/s per IP.
   Mitigated by client-side: zoom-locked, debounced pan. If we hit
   limits in prod, switch to a free tile CDN (Carto Light, MapTiler
   free tier) — addressed in Phase 2 (Platform Polish), not here.
4. **`PlayerPresence` shape change is a wire-format change** —
   considered breaking? The fields are optional, and old clients
   simply ignore the unknown `lat/lng` keys (Zod with `.optional()`).
   Bump `PROTOCOL_VERSION`? No — optional fields are
   forward-compatible. New DO sends extra; old clients drop them.
   Worker rejects only on *failed* parse, and optional fields
   never fail parse. Documented here so future devs don't
   re-debate.
5. **Cross-DO chat scope question** — out of scope per spec.
   Documented here to short-circuit re-litigation.

## Open decisions (NONE)

Everything required by the spec is decided. Implementation can
start once this plan is approved.
