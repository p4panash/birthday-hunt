# Spec: Multiplayer Backend for Birthday Hunt

> **Status:** Approved 2026-05-27. Phase 2 (Plan) may begin.

## Objective

Add a cooperative-multiplayer backend on top of the existing single-player
React/Vite/TypeScript birthday-hunt frontend, **without rewriting the frontend
state machine or visual design**. Multiple players (friends helping the
birthday person) join the same team via an invite code; all teammates'
screens stay in sync in real-time. When any player unlocks a checkpoint
(via GPS proximity OR manual code entry), all teammates' devices advance
together. The hunt's content (deadline, checkpoints, copy) becomes
admin-configurable from a backend dashboard instead of being baked into
`src/config.ts`.

### Why this matters

The v1 design (see `planning/MASTER-PLAN.md`) was an explicit "no backend,
no secrets, no encryption" call for a single recipient. The recipient
("Mihali") was the only player. Adding cooperative multiplayer changes the
threat model and the architecture: we now need a server-authoritative state
that can be observed by 2+ devices simultaneously. The "no backend" decision
in v1 §2.2 is intentionally being reversed for this version, and the spec
documents that reversal.

### Users and roles

- **Player** — friend on a team. Joins via invite code, sees current step,
  enters codes, walks to GPS checkpoints, watches teammates' progress live.
- **Admin** — the organizer. Creates a hunt (sets deadline, checkpoints,
  copy), generates invite codes per team, watches teams' live progress.

### Success criteria

- Two devices on the same team see the same `HuntStep` within 500ms of any
  state-changing action (checkpoint unlock, reveal complete).
- Refreshing the page on either device restores the team's current step
  (no progress lost).
- Admin can edit `deadlineISO` on a running hunt and the countdown banner
  on all connected devices updates within 1s.
- A team with no connected devices for 60s+ wakes back up to the correct
  state when any teammate reconnects.
- Frontend visual design (mascot, animations, palette, copy structure) is
  unchanged. Reuse of `huntReducer` action types is preserved.
- Existing solo-play mode still works (no team_id present in URL ⇒ fall
  back to `src/config.ts` + localStorage like today).

## Tech Stack

### Kept from existing repo

- React 18, Vite 5, TypeScript 5
- `motion` v11, `canvas-confetti`
- Native Geolocation API
- `useReducer` + `huntReducer` state machine
- Existing screens: Intro, GpsPreface, LocationActive, Reveal,
  PhotoInterstitial, Finale
- Existing components: Mascot, CountdownBanner, ProgressScaffold,
  StuckSheet, WarmthPulse, PortraitLock, TestModeBadge

### Added

- **Cloudflare Workers** — API + WebSocket origin (single Worker for both)
- **Cloudflare D1** — managed SQLite for persistent data
- **Durable Objects** — one `TeamSession` DO per team for in-memory state +
  WebSocket fan-out to all team members
- **Wrangler** v3 — local dev + deploy
- **Zod** — runtime validation of API request/response shapes
- **Vitest** — unit + integration tests for the Worker (Cloudflare provides
  `@cloudflare/vitest-pool-workers`)
- **Hono** — minimal router/middleware framework for Cloudflare Workers
  (keeps the Worker code readable)

### Hosting changes

Frontend moves from **GitHub Pages → Cloudflare Pages**, deployed from the
same repo. Reasons:

- Same origin as the Worker eliminates CORS complexity.
- Single deploy pipeline (Cloudflare Pages builds Vite output + Worker
  alongside).
- GitHub Actions workflow `.github/workflows/deploy.yml` becomes a fallback
  (kept but disabled by default; can be re-enabled if Cloudflare is down).

The Vite `base` path may change from `/birthday-hunt/` (GitHub Pages
subpath) to `/` (Pages custom-domain root). Decision deferred — see Open
Questions.

## Commands

```bash
# Frontend (existing)
npm install
npm run dev          # vite dev server, localhost:5173
npm run build        # tsc + vite build → dist/
npm run preview      # preview built site
npm run typecheck    # tsc --noEmit

# Backend (new)
npm run worker:dev   # wrangler dev — local Worker + D1 + DO
npm run worker:test  # vitest with workers pool
npm run db:migrate   # wrangler d1 migrations apply
npm run db:seed      # wrangler d1 execute --file=migrations/seed.sql
npm run deploy       # wrangler deploy (pushes Worker + Pages)
```

## Project Structure

```
birthday-hunt/
├── src/                      → frontend (existing — minimal touches)
│   ├── App.tsx               → routing: solo mode vs team mode
│   ├── screens/
│   │   ├── Join.tsx          → NEW: invite code + player name entry
│   │   └── (existing screens unchanged)
│   ├── state/
│   │   └── huntReducer.ts    → existing actions kept; team mode wraps dispatch
│   ├── lib/
│   │   ├── useTeamState.ts   → NEW: WebSocket sync hook
│   │   ├── useLocalStorageSync.ts  → existing, used only in solo mode
│   │   └── api.ts            → NEW: typed fetch helpers for /api/*
│   ├── admin/                → NEW: /admin route (separate entrypoint)
│   │   ├── AdminApp.tsx
│   │   ├── CreateHunt.tsx
│   │   ├── ManageTeams.tsx
│   │   └── LiveProgress.tsx
│   └── config.ts             → existing; still default for solo mode
│
├── worker/                   → NEW: backend code
│   ├── index.ts              → Hono app, route table, exports DO classes
│   ├── routes/
│   │   ├── admin.ts          → /api/admin/*
│   │   ├── teams.ts          → /api/teams/* (join, get, ws)
│   │   └── hunts.ts          → /api/hunts/:id/config
│   ├── do/
│   │   └── TeamSession.ts    → Durable Object for per-team state + WS
│   ├── db/
│   │   ├── schema.ts         → TypeScript types matching D1 tables
│   │   ├── queries.ts        → prepared statement helpers
│   │   └── migrations/
│   │       ├── 0001_init.sql
│   │       └── seed.sql
│   ├── lib/
│   │   ├── auth.ts           → admin token check
│   │   ├── invite.ts         → invite code generation (8-char base32)
│   │   └── validators.ts     → Zod schemas shared with frontend
│   └── wrangler.toml         → Worker + D1 + DO config
│
├── shared/                   → NEW: types shared frontend ↔ worker
│   ├── actions.ts            → HuntAction union (currently in src/state/)
│   ├── messages.ts           → WebSocket message envelopes
│   └── config.ts             → HuntConfig shape (extracted from src/config.ts)
│
├── tests/                    → existing + new
│   ├── worker/               → vitest tests for Worker + DO
│   └── frontend/             → existing solo-play tests stay
│
├── planning/                 → existing v1 research (frozen)
├── specs/
│   └── multiplayer-backend.md  → THIS FILE
└── docs/                     → existing screenshots
```

### Boundary rules for structure

- **`shared/` is the contract.** Types here import from neither `src/` nor
  `worker/`. Both sides import from `shared/`. Changing a shared type is
  a breaking change to the wire protocol — bump the protocol version.
- **`worker/` never imports from `src/`.** The Worker has no DOM.
- **`src/` never imports from `worker/`.** The frontend talks to the worker
  only over HTTP/WebSocket.

## Code Style

Match the existing repo's conventions. Real example from `src/state/huntReducer.ts`:

```ts
export type CheckpointIndex = 0 | 1 | 2;

export type HuntStep =
  | { kind: 'intro' }
  | { kind: 'location'; n: CheckpointIndex }
  | { kind: 'reveal'; n: CheckpointIndex }
  | { kind: 'finale' };

export type HuntAction =
  | { type: 'START_HUNT' }
  | { type: 'UNLOCK_CHECKPOINT'; n: CheckpointIndex }
  | { type: 'REVEAL_COMPLETE'; n: CheckpointIndex; hasPhotoAfter: boolean };
```

### Conventions

- **Discriminated unions for state and actions.** Single `kind` or `type`
  field. No mixed booleans-for-state.
- **Branded number types for indexes** (`CheckpointIndex = 0|1|2`) instead
  of `number`. Compiler catches off-by-ones.
- **Pure reducers.** All side-effects (WebSocket, GPS, sound) live in
  custom hooks or effect handlers.
- **`as const` over enums.** TypeScript enums are out of fashion in this
  codebase.
- **One file = one concern.** Components are ≤200 lines. Split when
  approaching.
- **JSDoc comments only where intent is non-obvious.** No "this function
  does X" narration; example: the schema-version comment on `STORAGE_KEY`
  in `huntReducer.ts`.
- **Lowercase copy is intentional and stays lowercase.** Don't sentence-case
  user-facing strings; the Michael-Reeves aesthetic depends on it.
- **No new dependencies without `Ask first`** (see Boundaries).

## Data Model (D1 schema, v0)

```sql
-- 0001_init.sql

CREATE TABLE hunts (
  id           TEXT PRIMARY KEY,        -- nanoid
  name         TEXT NOT NULL,           -- 'mihali-bday-2026'
  friend_name  TEXT NOT NULL,
  deadline_iso TEXT NOT NULL,           -- ISO 8601
  config_json  TEXT NOT NULL,           -- full HuntConfig as JSON
  created_at   INTEGER NOT NULL         -- unix ms
);

CREATE TABLE teams (
  id           TEXT PRIMARY KEY,        -- nanoid
  hunt_id      TEXT NOT NULL REFERENCES hunts(id),
  invite_code  TEXT NOT NULL UNIQUE,    -- 8-char base32, human-typable
  name         TEXT NOT NULL,           -- 'team-coral'
  created_at   INTEGER NOT NULL
);

CREATE INDEX idx_teams_invite_code ON teams(invite_code);

CREATE TABLE players (
  id           TEXT PRIMARY KEY,        -- nanoid
  team_id      TEXT NOT NULL REFERENCES teams(id),
  name         TEXT NOT NULL,
  client_id    TEXT NOT NULL,           -- browser-generated, for reconnect
  joined_at    INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE INDEX idx_players_team ON players(team_id);

CREATE TABLE team_state (
  team_id           TEXT PRIMARY KEY REFERENCES teams(id),
  step_kind         TEXT NOT NULL,      -- 'intro' | 'location' | ... matches HuntStep['kind']
  step_payload_json TEXT NOT NULL,      -- '{}' or '{"n": 0}' etc.
  unlocked_json     TEXT NOT NULL,      -- '[false, false, false]'
  started_at        INTEGER,
  updated_at        INTEGER NOT NULL
);

-- No admin_tokens table — Cloudflare Access handles identity at the edge.
-- Admin email (from Cf-Access JWT 'email' claim) is logged on every mutating
-- request via an audit_log table:

CREATE TABLE audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_email  TEXT NOT NULL,
  action       TEXT NOT NULL,            -- 'create_hunt' | 'patch_hunt' | ...
  target       TEXT NOT NULL,            -- hunt_id or team_id
  payload_json TEXT,
  created_at   INTEGER NOT NULL
);

CREATE INDEX idx_audit_created ON audit_log(created_at DESC);
```

Future migrations live in `worker/db/migrations/000N_*.sql`. Never edit a
shipped migration; add a new one.

## API Contract (v0)

All JSON. Errors use `{ error: { code: string, message: string } }` shape.

| Method | Path                                  | Auth   | Purpose                                  |
|--------|---------------------------------------|--------|------------------------------------------|
| POST   | `/api/admin/hunts`                    | admin  | create hunt                              |
| GET    | `/api/admin/hunts`                    | admin  | list hunts                               |
| GET    | `/api/admin/hunts/:id`                | admin  | hunt detail (with teams + progress)      |
| PATCH  | `/api/admin/hunts/:id`                | admin  | edit config / deadline                   |
| POST   | `/api/admin/hunts/:id/teams`          | admin  | create team for hunt → invite_code       |
| POST   | `/api/teams/join`                     | none   | `{ invite_code, player_name }` → session |
| GET    | `/api/teams/:id`                      | player | current team state (initial load)        |
| GET    | `/api/teams/:id/ws?player_id=...`     | player | upgrade to WebSocket                     |
| GET    | `/api/hunts/:id/config`               | player | hunt config (resolved via team)          |

### WebSocket protocol

Client → Server messages:

```ts
type ClientMsg =
  | { v: 1; type: 'action'; action: HuntAction }   // forward to reducer
  | { v: 1; type: 'ping' };
```

Server → Client messages:

```ts
type ServerMsg =
  | { v: 1; type: 'state'; state: HuntState }      // full state, sent on connect + after every applied action
  | { v: 1; type: 'presence'; players: PlayerPresence[] }
  | { v: 1; type: 'error'; code: string; message: string }
  | { v: 1; type: 'pong' };
```

**Reducer reuse.** The Durable Object imports `huntReducer` from `shared/`
and applies actions identically to the frontend. The server is authoritative;
the client UI re-applies the action optimistically and reconciles when the
server's `state` message arrives.

## Frontend Integration

### Mode selection (src/App.tsx)

```ts
// Pseudocode — actual implementation in Phase 4.
const teamSession = useTeamSessionFromStorage();   // { team_id, player_id } or null
const route = window.location.pathname;

if (route.startsWith('/admin')) return <AdminApp />;
if (route.startsWith('/join')) return <JoinScreen />;
if (teamSession) return <TeamModeApp session={teamSession} />;
return <SoloModeApp />;                            // ← today's behaviour, unchanged
```

### Team mode hook

`src/lib/useTeamState.ts` exposes `{ state, dispatch, presence, connected }`
with the same `dispatch` signature as the existing reducer. The whole
existing `<Router>` switch in `App.tsx` works unchanged; only the source
of `state` + `dispatch` swaps.

### Solo mode untouched

If no team session exists in localStorage, the app behaves exactly like today:
`useReducer(huntReducer, ...)` + `useLocalStorageSync` + `src/config.ts`. No
backend calls. This preserves the v1 launch path and gives us a clean rollback.

## Testing Strategy

| Layer            | Framework                              | Coverage target |
|------------------|----------------------------------------|-----------------|
| `huntReducer`    | Vitest unit (already trivially testable) | 100%          |
| Worker routes    | Vitest + `@cloudflare/vitest-pool-workers` | happy + error paths per route |
| Durable Object   | Vitest with miniflare DO sim           | state transitions + WS broadcast |
| WebSocket E2E    | Playwright (2-tab cooperative scenario) | join → unlock → both screens advance |
| Frontend e2e     | existing patterns                      | solo mode unchanged             |

### TDD rule

Per `agent-skills:test-driven-development`: backend tests are written
before the code under test. Reducer logic shared between frontend + worker
must pass identical test vectors on both sides.

## Boundaries

### Always do

- Run `npm run typecheck && npm run worker:test` before every commit.
- Use Conventional Commits (`feat:`, `fix:`, `chore:`).
- Validate every WebSocket and HTTP input with Zod schemas from `shared/`.
- Persist state changes to D1 before broadcasting to WebSockets (durability
  before reactivity).
- Keep solo mode working — every PR must include manual verification that
  `?team=...`-less load still works.
- Update this spec when a decision documented here changes.

### Ask first

- Adding a new npm dependency.
- Schema changes to D1 (new migration).
- Breaking changes to the wire protocol (bump `v` field).
- Removing solo mode entirely.
- Changing the Vite `base` path.
- Adding paid Cloudflare features (R2, Queues, etc.).
- Moving the frontend off GitHub Pages (this spec proposes Cloudflare Pages
  — confirm before executing).

### Never do

- Commit secrets (admin token, etc.) — use Wrangler secrets / .dev.vars.
- Skip tests on a "small" backend change. Concurrency bugs hide in small
  changes.
- Send raw `eval`-able JS over the WebSocket. Actions are typed unions only.
- Trust the client for anything authoritative (current step, unlocked list).
  The Durable Object is the source of truth.
- Mutate shipped D1 migrations.
- Disable the existing GitHub Pages workflow before Cloudflare Pages is
  proven to deploy correctly.

## Success Criteria (testable)

- [ ] Two browsers join the same team via the same invite code → both see
      identical `HuntStep` after each action.
- [ ] Network blip on player A → player B's actions still apply → player A
      reconnects and receives full current state in the first WS frame.
- [ ] Admin PATCHes `deadlineISO` → all connected clients receive a `state`
      message with the new deadline within 1s.
- [ ] `npm run worker:test` is green.
- [ ] `npm run typecheck` is green across frontend + worker.
- [ ] Solo mode (no team session) still runs the v1 flow end-to-end.
- [ ] Worker bundle ≤ 1 MB (Cloudflare free tier limit).
- [ ] D1 query p95 < 50ms for state read + write.
- [ ] WebSocket round-trip from action to broadcast < 200ms (local LAN
      between two devices).

## Resolved Decisions

All open questions resolved on 2026-05-27.

1. **Frontend hosting:** Cloudflare Pages. Same origin as the Worker
   eliminates CORS. GitHub Pages workflow stays in the repo as a fallback
   but is disabled by default once Pages deploy is verified.
2. **Admin auth:** Cloudflare Access (Zero Trust). The Worker verifies
   the `Cf-Access-Jwt-Assertion` header on every `/api/admin/*` request
   against Cloudflare's public keys. No bespoke admin login route.
   `POST /api/admin/login` from the original draft is dropped; CF Access
   handles the identity layer at the edge.
3. **GPS validation:** trust the client. The Worker accepts
   `UNLOCK_CHECKPOINT { n }` without verifying coordinates. Birthday hunt
   with friends — non-adversarial threat model.
4. **Photo interstitials:** synchronized team-wide. The `photo` step
   lives in the shared `HuntState`, so all teammates see it together.
5. **Reconnect:** re-bind to existing `player_id` when `client_id` matches
   a row in `players`; otherwise create a new player. `last_seen_at` is
   updated on every reconnect.
6. **Test mode:** local only. `?test=1` toggles the badge + debug drawer
   on the device that has it; teammates' screens are unaffected. Admin
   has a separate `JUMP_TO_STEP` action available from the admin panel
   that applies team-wide.
7. **Hunt config storage:** `src/config.ts` is the canonical TypeScript
   shape and the default for solo mode. `hunts.config_json` stores a
   serialized `HuntConfig` validated against the same Zod schema on
   read and write.
8. **Max concurrent players per team:** 10. Drives Durable Object memory
   sizing (10 WebSocket connections per DO — well within the 32 KB
   storage limit and the free-tier 50 ms CPU budget per request).

### Cloudflare Access setup notes

- Create a Zero Trust "self-hosted application" covering the admin route
  (e.g. `admin.birthday-hunt.example.com/*` or `/admin/*` on a subpath).
- Identity provider: email OTP (simplest for a single admin) or Google
  SSO if available.
- The Worker reads `Cf-Access-Jwt-Assertion`, fetches the team's
  `/cdn-cgi/access/certs` JWKS once (cached in DO storage), and verifies
  the JWT signature + `aud` claim. Library: `jose` (works in Workers).
- Admin's email address is the audit log identity for any mutating
  request. No shared secrets.

## Verification Checklist (before approving this spec)

- [ ] Objective is clear and matches user intent.
- [ ] Spec covers all six core areas (Objective, Tech Stack, Commands,
      Structure, Style, Testing) plus Boundaries and Success Criteria.
- [ ] Success criteria are specific and testable.
- [ ] Boundaries (Always / Ask first / Never) are concrete.
- [ ] Open questions are listed, not silently assumed.
- [ ] Spec is committed to the repo at `specs/multiplayer-backend.md`.

---

**Next phase (Plan)** begins only when the human signs off on this spec
and resolves the Open Questions section. Until then, no code changes.
