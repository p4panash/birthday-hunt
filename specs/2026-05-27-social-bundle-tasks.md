# Tasks: Social Bundle Implementation

> **Status:** Draft 2026-05-27. Awaiting approval before Phase 4
> (Implement). References `specs/2026-05-27-social-bundle.md` (spec)
> and `specs/2026-05-27-social-bundle-plan.md` (plan).
>
> **Conventions:**
> - Tasks are ordered by dependency.
> - Each task ≤5 files touched, ≤3 h effort.
> - Acceptance = what's true when done. Verify = how to confirm.
> - TDD per Rule 4 (Worker code): write the failing vitest first,
>   then implement.
> - Per-phase code-reviewer subagent + `npm run verify` checkpoint
>   before moving to the next phase.

---

## Phase P0 — Protocol + D1 foundation

### T1. Widen `ClientMsg` and `ServerMsg` in `shared/messages.ts`
- **Acceptance:** New discriminated-union variants per spec § WS
  protocol (`chat_send`, `react_send`, `ping_send`, `chat_snapshot`,
  `chat_new`, `chat_wiped`, `react_show`, `ping_show`). `ChatMessage`
  type exported. `ReactionEmoji` Zod literal union exported.
  `error` variant gains optional `retry_after_ms`.
- **Verify:** `npm run typecheck` green. New vitest case in
  `tests/worker/messages.test.ts` (create) round-trips each new
  variant through Zod.
- **Files:** `shared/messages.ts`, `tests/worker/messages.test.ts`.

### T2. D1 migration `0002_chat.sql`
- **Acceptance:** New migration creates `chat_messages` table with
  columns + index per spec § Data model. No edits to `0001_init.sql`
  (shipped migrations are immutable per CLAUDE.md).
- **Verify:** `npm run db:migrate` (local) applies cleanly. Verify
  via `wrangler d1 execute DB --local --command "PRAGMA
  table_info(chat_messages)"`.
- **Files:** `worker/db/migrations/0002_chat.sql`.

### T3. Chat query helpers in `worker/db/queries.ts`
- **Acceptance:** Exports `insertChatMessage`, `listRecentChat`,
  `wipeChatForTeam`. Each typed with TS narrow return shapes.
  `listRecentChat` returns chronological **newest-first** (caller
  reverses for display).
- **Verify:** New `tests/worker/chat-queries.test.ts` covers each
  helper. Insert+list round-trip; wipe deletes only target team's
  rows.
- **Files:** `worker/db/queries.ts`, `tests/worker/chat-queries.
  test.ts`.

### T4. Install `leaflet` + `@types/leaflet`
- **Acceptance:** `package.json` adds `leaflet@^1.9.4` runtime dep
  and `@types/leaflet` dev dep. No other packages touched.
- **Verify:** `npm install` clean. `npm run build` succeeds. Note
  baseline `dist/` gz size before this commit (echoed in commit
  body) for P4 acceptance.
- **Files:** `package.json`, `package-lock.json`.

### T5. Centralize rate limits in `worker/lib/rate-limits.ts`
- **Acceptance:** Exports `RATE_LIMITS` const with chat/reaction/
  ping numbers per plan. No imports yet (consumers land in P1–P3).
- **Verify:** `npm run typecheck` green. Const is `as const` so
  values are literal types.
- **Files:** `worker/lib/rate-limits.ts`.

**Checkpoint CP-0:** `npm run verify` green. Commit
`feat(social): protocol + D1 foundation (P0)`. Push.

---

## Phase P1 — Chat slice

### T6. DO `chat_send` handler — body validation + rate limit
- **Acceptance:** `TeamSession.webSocketMessage` switches on new
  `chat_send` envelope. Validates `body.length ≤ 280` (else send
  `error:body_too_long`). Enforces per-player rate limit from a
  new `RateLimiter` helper in `worker/lib/rate-limits.ts` (≤1/sec,
  ≤30/min). Rejection = `error:rate_limited` with `retry_after_ms`.
- **Verify:** `tests/worker/chat-flow.test.ts` (create): body=281
  chars → error; 31 messages in <60s → error on 31st. Sender's
  socket gets the error; no broadcast on the failing send.
- **Files:** `worker/do/TeamSession.ts`, `worker/lib/rate-limits.ts`,
  `tests/worker/chat-flow.test.ts`.

### T7. DO `chat_send` handler — persist + broadcast
- **Acceptance:** On valid `chat_send`, INSERT into D1 via
  `insertChatMessage`, resolve `player_name` from the WS attachment
  (NOT the inbound envelope), broadcast `chat_new` with the
  canonical row to all sockets.
- **Verify:** `tests/worker/chat-flow.test.ts` extends: two
  simulated clients on same team; client A sends → client B
  receives within 100ms. `player_name` in broadcast equals the
  attached name, regardless of what envelope said.
- **Files:** `worker/do/TeamSession.ts`, `tests/worker/chat-flow.
  test.ts`.

### T8. DO `chat_snapshot` on WS attach
- **Acceptance:** Immediately after the initial state frame in
  `handleUpgrade`, send `chat_snapshot` with last 50 messages
  chronological (oldest first). If team has no chat yet, send
  empty array.
- **Verify:** `tests/worker/chat-flow.test.ts` extends: insert 60
  messages → reconnect → client receives `chat_snapshot` with
  exactly 50, oldest-first, last id is highest.
- **Files:** `worker/do/TeamSession.ts`, `tests/worker/chat-flow.
  test.ts`.

### T9. `useTeamState` extends with chat slice
- **Acceptance:** Hook returns `chat: ChatMessage[]`, `sendChat(
  body)`, `chatWiped: boolean`. `chat_snapshot` replaces local
  list; `chat_new` appends; `chat_wiped` clears + pulses
  `chatWiped` true for ~1s.
- **Verify:** No new vitest (hook is glue). Typecheck green.
  `npm run dev` shows the hook's new fields available to
  consumers (verified by P1 components later).
- **Files:** `src/lib/useTeamState.ts`.

### T10. `ChatDrawer` component
- **Acceptance:** New `src/components/ChatDrawer.tsx`: slide-in
  right-side drawer, header with team name + close button, scrollable
  message list (own messages right-aligned with accent color, others
  left-aligned with sender name above), input + send button, empty
  state "No messages yet. Say hi 👋". Auto-scroll to bottom on new
  message *only* if the user is already at bottom (don't yank them
  up while reading). Disable send if input empty or > 280 chars.
- **Verify:** Browser-harness manual: open in two tabs, type
  message, verify alignment and styling. Reload one tab — last
  messages persist.
- **Files:** `src/components/ChatDrawer.tsx`, `src/components/
  ChatDrawer.module.css` (or inline styles).

### T11. `PresenceRibbon` integration — chat fab + unread badge
- **Acceptance:** Adds a chat icon button to the ribbon, with an
  unread count badge. Unread counter = messages received while
  drawer closed; resets on open. Clicking opens the drawer.
- **Verify:** Browser-harness: open tab A and tab B. Tab B closes
  drawer. Tab A sends 3 messages → tab B's badge shows "3". Tab B
  opens drawer → badge clears.
- **Files:** `src/components/PresenceRibbon.tsx`, `src/components/
  Icon.tsx` (if a new chat glyph needed).

### T12. E2E `tests/e2e/social.spec.ts` — chat happy path
- **Acceptance:** New Playwright file. Cases: (1) tab A sends, tab
  B receives within 2s; (2) tab A reloads, last messages still
  visible; (3) solo tab has no chat fab.
- **Verify:** `npm run e2e -- --grep "social.*chat"` green.
  Existing `solo.spec.ts` still green (regression).
- **Files:** `tests/e2e/social.spec.ts`.

**Checkpoint CP-1:** `npm run verify` green. Spawn `feature-dev:
code-reviewer` subagent on diff (P1 only). Commit
`feat(social): team chat with D1 persistence (P1)`. Push.

---

## Phase P1.5 — Admin wipe

### T13. DO `/internal/chat/wipe` endpoint
- **Acceptance:** `TeamSession.fetch` handles `POST /internal/chat/
  wipe`: broadcasts `chat_wiped` to all connected sockets. Returns
  `{ ok: true }`. Does NOT itself touch D1 — the admin route owns
  the delete + audit_log writes (single source of mutation).
- **Verify:** `tests/worker/admin-chat-wipe.test.ts` (create): two
  clients connected; POST to internal endpoint; both receive
  `chat_wiped` envelope.
- **Files:** `worker/do/TeamSession.ts`, `tests/worker/admin-chat-
  wipe.test.ts`.

### T14. Admin route `POST /api/admin/hunts/:huntId/teams/:teamId/chat/wipe`
- **Acceptance:** New route in `worker/routes/admin.ts`. CF Access
  middleware applies (existing). Resolves admin email from JWT.
  Verifies team belongs to hunt → 404 otherwise. Writes
  `audit_log` row `{ admin_email, action:'chat.wipe',
  target:<teamId>, payload_json:'{}' }`. Calls
  `wipeChatForTeam(db, teamId)`. POSTs to DO `/internal/chat/wipe`.
  Returns `{ ok: true, wiped: <count> }`.
- **Verify:** Extends `admin-chat-wipe.test.ts`: success path
  deletes rows + writes audit_log row; unauth → 401; wrong hunt
  → 404.
- **Files:** `worker/routes/admin.ts`, `tests/worker/admin-chat-
  wipe.test.ts`.

### T15. Admin SPA — Wipe chat button
- **Acceptance:** `src/admin/AdminApp.tsx` HuntDetail view adds a
  "Wipe chat" button per team row. Click → confirm dialog ("This
  will delete all chat for team X. Continue?"). On confirm, POST
  to new endpoint via `adminApi.ts` helper. Toast on success +
  refresh team data. Audit log auto-refreshes if `/admin/history`
  is open.
- **Verify:** Browser-harness: create team, send some chat from
  a player tab, click Wipe chat in admin → confirm → player tab
  chat clears within 1s; `/admin/history` shows row.
- **Files:** `src/admin/AdminApp.tsx`, `src/admin/adminApi.ts`.

### T16. E2E — admin wipe
- **Acceptance:** Extends `social.spec.ts`: player tabs A and B
  exchange messages; admin tab clicks Wipe chat + confirms; A
  and B see empty chat within 2s.
- **Verify:** `npm run e2e -- --grep "social.*wipe"` green.
- **Files:** `tests/e2e/social.spec.ts`.

**Checkpoint CP-1.5:** `npm run verify` green. Spawn
`agent-skills:security-auditor` subagent on `worker/routes/admin.ts`
diff (per Rule 9). Spawn `feature-dev:code-reviewer` on full
P1.5 diff. Commit `feat(social): admin chat wipe with audit log
(P1.5)`. Push.

---

## Phase P2 — Floating reactions

### T17. DO `react_send` handler
- **Acceptance:** Validates `emoji ∈ ReactionEmoji` via Zod (already
  in shared/messages.ts from T1). Rate limit (≤2/sec, ≤60/min) via
  shared RateLimiter. Generates server-side `id` (DO-incrementing
  counter). Broadcasts `react_show` with `sender_id`, `sender_name`
  (from attachment), `emoji`, `id`. No persistence.
- **Verify:** `tests/worker/reaction-flow.test.ts` (create): valid
  emoji broadcasts; invalid emoji → error; rate-limit error.
- **Files:** `worker/do/TeamSession.ts`, `tests/worker/reaction-
  flow.test.ts`.

### T18. `useTeamState` extends with reactions slice
- **Acceptance:** Hook returns `reactions: FloatingReaction[]` and
  `sendReaction(emoji)`. Local echo on send (don't wait for server
  round-trip). Single `setInterval(prune, 500)` removes entries
  past their 2-second TTL.
- **Verify:** Typecheck green; manual two-tab in P2/T20.
- **Files:** `src/lib/useTeamState.ts`.

### T19. `ReactionTray` and `FloatingReactionLayer` components
- **Acceptance:**
  - `ReactionTray.tsx`: horizontal pill, 6 emojis (🎉 ❤️ 🔥 😭 🙄
    👀), fixed bottom-right above chat fab, tap = local echo +
    `sendReaction`.
  - `FloatingReactionLayer.tsx`: full-screen `pointer-events:none`
    overlay, renders each active reaction as absolutely-positioned
    emoji + small sender-name caption, CSS `@keyframes` float-up
    + fade animation (2s total), randomized horizontal jitter
    ±60px so simultaneous 🎉 don't overlap.
- **Verify:** Browser-harness manual: tap emoji on tab A, tab B
  shows floating emoji with sender label.
- **Files:** `src/components/ReactionTray.tsx`, `src/components/
  FloatingReactionLayer.tsx`, optional CSS module.

### T20. Mount reactions in `TeamMode` shell
- **Acceptance:** `src/TeamMode.tsx` (or the team shell) mounts
  `<ReactionTray />` and `<FloatingReactionLayer />` as siblings of
  the existing screen content, so they appear on every team screen
  (Intro, GpsPreface, LocationActive, Reveal, Finale). Not mounted
  in `SoloMode.tsx`.
- **Verify:** Browser-harness: navigate through all team screens;
  tray visible on each. Solo mode: no tray.
- **Files:** `src/TeamMode.tsx` (or equivalent shell), `src/
  GameShell.tsx` if it owns the layout.

### T21. E2E — reactions
- **Acceptance:** Extends `social.spec.ts`: tab A taps 🎉, tab B
  sees the floating emoji within 1s. Solo tab: no tray.
- **Verify:** `npm run e2e -- --grep "social.*react"` green.
- **Files:** `tests/e2e/social.spec.ts`.

**Checkpoint CP-2:** `npm run verify` green. `feature-dev:code-
reviewer` on P2 diff. Commit `feat(social): floating reactions
(P2)`. Push.

---

## Phase P3 — Map + pings

### T22. Presence enrichment with optional GPS coords
- **Acceptance:** `PlayerPresence` (shared/messages.ts) gains
  optional `lat?: number`, `lng?: number`, `accuracy?: number`,
  `last_gps_at?: number`. DO's `broadcastPresence` includes these
  if the attachment has them. Frontend writes them to the
  attachment via a new `presence_position` ClientMsg envelope
  (or piggybacks on existing presence updates — pick one path,
  document in commit message). Update rate ≤1/2s (throttled in
  the hook).
- **Verify:** `tests/worker/presence-position.test.ts` (create):
  two clients; A sends position update; B sees A's lat/lng in
  next presence frame.
- **Files:** `shared/messages.ts`, `worker/do/TeamSession.ts`,
  `src/lib/useTeamState.ts`, `tests/worker/presence-position.
  test.ts`.

### T23. DO `ping_send` handler
- **Acceptance:** Rate limit (≤1/sec, ≤20/min). Server-side `id`.
  Computes `expires_at = Date.now() + 5000`. Broadcasts
  `ping_show` with `lat`, `lng`, `sender_id`, `sender_name`, `id`,
  `expires_at`. No persistence.
- **Verify:** `tests/worker/ping-flow.test.ts` (create): broadcast
  reaches all clients with valid expires_at; rate-limit case.
- **Files:** `worker/do/TeamSession.ts`, `tests/worker/ping-flow.
  test.ts`.

### T24. `useTeamState` extends with pings slice
- **Acceptance:** Hook returns `pings: ActivePing[]` and
  `sendPing(lat, lng)`. Local echo on send. Shared prune
  `setInterval` from T18 removes entries past `expires_at`.
- **Verify:** Typecheck green; manual in T26.
- **Files:** `src/lib/useTeamState.ts`.

### T25. `TeamMap` component (lazy Leaflet)
- **Acceptance:** New `src/components/TeamMap.tsx`, lazy-loaded
  via `React.lazy` + `<Suspense fallback="...">`. Initializes
  Leaflet on a 200px-tall div. OSM tile layer with attribution.
  Zoom locked 14–18. Markers:
  - Self: blue `divIcon` circle, recenters with debounced auto-pan
    (no label).
  - Teammates: green `divIcon` circle with name + distance label
    via `geo/haversine.ts`. Updates on every presence frame.
  - Checkpoint indicator: orange 🎯 `divIcon`, mounted *only* when
    the current step is `location` AND warmth status === `onTop`.
    Coords from active checkpoint config.
  - Pings: yellow CSS-pulse `divIcon` with sender label; lifecycle
    driven by `pings` from the hook.
  - Map click: emit `sendPing(lat, lng)` using
    `LeafletMouseEvent.latlng`.
- **Verify:** Browser-harness manual: map renders, tiles load, pan
  + zoom feel right. Tap on map → ping shows on self and (in
  second tab) teammate.
- **Files:** `src/components/TeamMap.tsx`, `src/components/TeamMap.
  css` (Leaflet CSS imports + custom marker styles).

### T26. Mount `TeamMap` in `LocationActive`
- **Acceptance:** `src/screens/LocationActive.tsx` inserts
  `<TeamMap />` between `<WarmthPulse />` and the StuckSheet
  access button. Map is conditionally mounted only in team mode
  (skipped in solo).
- **Verify:** Browser-harness: solo tab still shows old flow with
  no map. Team tab: WarmthPulse + Map + StuckSheet button stack
  vertically.
- **Files:** `src/screens/LocationActive.tsx`.

### T27. E2E — pings + map presence
- **Acceptance:** Extends `social.spec.ts`: two team tabs with
  mocked GPS; tab A taps map at known coords → tab B sees yellow
  marker with A's name within 2s; marker disappears after 6s.
  Tab A sees tab B's position marker. Solo tab: no map.
- **Verify:** `npm run e2e -- --grep "social.*map"` green.
- **Files:** `tests/e2e/social.spec.ts`.

**Checkpoint CP-3:** `npm run verify` green. `feature-dev:code-
reviewer` on P3 diff. Commit `feat(social): mini-map + pings via
Leaflet (P3)`. Push.

---

## Phase P4 — Verify + ship

### T28. Full cold verify
- **Acceptance:** From a fresh `npm ci` + clean Playwright cache,
  `npm run verify` is green end-to-end. Bundle gz delta vs T4
  baseline ≤ 50 KB.
- **Verify:** Read the Vite build output, compare gz sizes,
  document in commit message.
- **Files:** none (verification only).

### T29. Code-reviewer subagent on full P0–P3 diff
- **Acceptance:** Spawn `feature-dev:code-reviewer` with the
  cumulative diff vs CP-0 ancestor. Resolve every
  high-confidence finding. Medium findings: triage in a
  follow-up commit if relevant, document in the PR description
  otherwise.
- **Verify:** Subagent returns under 200 words per Rule 5; no
  high-severity open at the end.
- **Files:** none (review only); follow-up commits as needed.

### T30. Security-auditor on admin route + chat insert path
- **Acceptance:** Spawn `agent-skills:security-auditor` with the
  diff for `worker/routes/admin.ts`, `worker/do/TeamSession.ts`
  (chat handler), `worker/db/queries.ts` (chat helpers). Resolve
  high findings.
- **Verify:** Report attached to PR description. No high-severity
  open.
- **Files:** none (review only); follow-up commits as needed.

### T31. Ship to prod
- **Acceptance:** Invoke `agent-skills:ship` and walk the
  checklist:
  - `npm run db:migrate:remote` applies `0002_chat.sql` to D1.
  - `npm run worker:deploy` succeeds.
  - `npx wrangler pages deploy dist --project-name birthday-hunt
    --branch main` succeeds.
  - Manual smoke on two real devices via
    `https://hunt.use-adonis.com`: chat + 🎉 reaction + ping work.
- **Verify:** Production URL serves the new UI; admin URL shows
  Wipe chat button; live test passes.
- **Files:** none.

**Checkpoint CP-4 (final):** PR #1 updated with Phase 1 deliverables.
Tag `v0.2.0-social-bundle` on the merge commit.

---

## Task inventory

| Task | Phase | Effort | Blocked by |
|-----:|------:|-------:|-----------:|
| T1   | P0    | 0.5h   | —          |
| T2   | P0    | 0.3h   | —          |
| T3   | P0    | 1.0h   | T2         |
| T4   | P0    | 0.2h   | —          |
| T5   | P0    | 0.2h   | —          |
| T6   | P1    | 1.0h   | T1, T5     |
| T7   | P1    | 1.0h   | T6, T3     |
| T8   | P1    | 0.7h   | T7, T3     |
| T9   | P1    | 0.5h   | T1         |
| T10  | P1    | 1.0h   | T9         |
| T11  | P1    | 0.3h   | T10        |
| T12  | P1    | 0.5h   | T7, T8, T11 |
| T13  | P1.5  | 0.3h   | T8         |
| T14  | P1.5  | 0.7h   | T3, T13    |
| T15  | P1.5  | 0.7h   | T14        |
| T16  | P1.5  | 0.3h   | T15        |
| T17  | P2    | 1.0h   | T1, T5     |
| T18  | P2    | 0.5h   | T17        |
| T19  | P2    | 1.0h   | T18        |
| T20  | P2    | 0.3h   | T19        |
| T21  | P2    | 0.3h   | T20        |
| T22  | P3    | 1.0h   | T1         |
| T23  | P3    | 0.7h   | T1, T5     |
| T24  | P3    | 0.5h   | T23        |
| T25  | P3    | 1.5h   | T22, T24, T4 |
| T26  | P3    | 0.3h   | T25        |
| T27  | P3    | 0.5h   | T26        |
| T28  | P4    | 0.5h   | T27        |
| T29  | P4    | 0.5h   | T28        |
| T30  | P4    | 0.5h   | T28        |
| T31  | P4    | 0.5h   | T29, T30   |
| **Total** | | **~17h** | |

Estimated total slightly under the plan's 21h budget; the buffer
absorbs the inevitable test-rewrite churn during TDD.

## Suggested execution windows

- **Window 1 (P0):** T1–T5 in parallel where allowed (T1, T2, T4,
  T5 fully independent; T3 follows T2). One commit at CP-0.
- **Window 2 (P1):** T6 → T7 → T8 sequential (DO); T9–T11
  sequential on UI; T12 last. One commit at CP-1.
- **Window 3 (P1.5):** T13–T16. One commit at CP-1.5.
- **Window 4 (P2):** T17 → T18 → T19 → T20 → T21. One commit at
  CP-2.
- **Window 5 (P3):** T22 → T23 → T24 → T25 → T26 → T27. One commit
  at CP-3.
- **Window 6 (P4):** T28 → T29/T30 (parallel subagent spawns) →
  T31.

## Approval gate

- [ ] Task granularity is right (no task feels too big or too
      small).
- [ ] Ordering respects dependencies in the plan.
- [ ] No critical task missing.
- [ ] Suggested execution windows match available time blocks.

Once approved, Phase 4 (Implement) begins with T1.
