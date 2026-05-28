# Birthday Hunt — Architecture Handoff Prompt

> Drop this entire document into a new chat session to resume work without
> re-deriving context. The repo is at `git@github.com:p4panash/birthday-hunt.git`,
> local clone expected at `C:\Users\Bambi\goodLoot\birthday-hunt`. Authoritative
> design docs live in `specs/multiplayer-backend.md` (spec),
> `specs/multiplayer-plan.md` (plan), and `specs/multiplayer-tasks.md` (28-task
> breakdown). Original v1 design — frozen — lives in `planning/`.

---

## 1. Project in one paragraph

`birthday-hunt` is a mobile-first React/Vite/TypeScript birthday treasure-hunt
web app. The v1 design (already shipping on GitHub Pages) is a **single-player**
GPS+QR hunt: the recipient walks to 3 Bucharest checkpoints, each unlock reveals
a slice of a final QR, which opens an EasyBox locker holding the gift. v1 has
no backend, no auth, no DB — state lives in localStorage; content lives in
`src/config.ts`. We are now adding **cooperative multiplayer** on top: teams
join via invite code, all teammates see the same hunt state in real-time, an
admin configures hunts via a dashboard. Solo mode remains as the load-bearing
rollback.

## 2. Decision contract (locked-in choices)

| Decision                | Value                                                                 |
|-------------------------|-----------------------------------------------------------------------|
| Hunt type               | Hybrid: cryptic teasers + GPS proximity + QR slices                   |
| Mode                    | Multi-player **cooperative** (all teammates share one state machine)  |
| Solo mode               | Preserved as fallback; rollback target                                 |
| Frontend                | React 18 + Vite 5 + TypeScript 5 + `motion` v11 + `canvas-confetti`   |
| Backend                 | Cloudflare Workers + D1 (SQLite) + Durable Objects (per-team)         |
| Worker framework        | Hono (HTTP router) + Zod (validation) + jose (CF Access JWT verify)   |
| Frontend hosting        | **Cloudflare Pages** (moving off GitHub Pages — same-origin = no CORS)|
| GH Pages workflow       | Kept as fallback, set to `workflow_dispatch` only                     |
| Admin auth              | **Cloudflare Access** (Zero Trust). Admin identity = `Cf-Access-Jwt`  |
| GPS validation          | Trust client. Non-adversarial threat model.                           |
| Photo interstitials     | Synchronized team-wide.                                                |
| Reconnect semantics     | Re-bind to existing `player_id` if `client_id` matches.               |
| Test mode (`?test=1`)   | Local only. Admin has separate team-wide `JUMP_TO_STEP`.              |
| Hunt config storage     | `src/config.ts` = solo default + canonical shape; `hunts.config_json` |
|                         | stores serialized HuntConfig in D1. Both validated by same Zod schema.|
| Max players per team    | 10. Drives DO memory + WS connection limits.                          |
| Deadline                | Admin-set on backend at runtime (not hardcoded in `src/config.ts`)    |

## 3. Architecture

```
                      ┌──────────────────────────┐
                      │  shared/ (types, Zod)    │ ← cross-environment contract
                      │  • HuntAction            │
                      │  • HuntState             │
                      │  • HuntConfig            │
                      │  • WS message envelopes  │
                      │  • huntReducer (pure)    │
                      └────────────┬─────────────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            ▼                                             ▼
   ┌────────────────┐                            ┌──────────────────┐
   │  worker/       │                            │  src/            │
   │                │                            │                  │
   │  Hono router   │                            │  Solo mode       │
   │   ↓            │                            │  (unchanged)     │
   │  /api/admin/*  │◄─── Cf-Access JWT ────┐    │   ↓              │
   │  /api/teams/*  │                       │    │  Team mode:      │
   │   ↓            │                       │    │   • Join screen  │
   │  TeamSession   │◄═══ WebSocket ════════╪═══►│   • useTeamState │
   │  Durable Object│                       │    │   • Admin SPA    │
   │   ↓                                    │    │                  │
   │  D1 queries    │                       │    └──────────────────┘
   └────────┬───────┘                       │
            ▼                               │
   ┌────────────────┐                       │
   │  D1 (SQLite)   │                       │
   │  • hunts       │                       │
   │  • teams       │                       │
   │  • players     │                       │
   │  • team_state  │                       │
   │  • audit_log   │                       │
   └────────────────┘                       │
                                            │
                                  ┌─────────┴────────┐
                                  │ Cloudflare Access│ ← identity at edge
                                  │ (admin only)     │
                                  └──────────────────┘
```

### State sync model (cooperative multiplayer)

- The same pure `huntReducer` runs on both client and server (imported from
  `shared/state/reducer.ts`). The Durable Object is **authoritative**.
- Player dispatches an action → client applies it optimistically → sends over
  WebSocket → DO validates with Zod → applies via `huntReducer` → persists
  to D1 → broadcasts `ServerMsg.state` to **all** connected sockets → all
  clients reconcile.
- On reconnect, DO sends current state in the first WS frame; client doesn't
  render until that frame lands.
- DO hibernates when no connections; rehydrates from D1 on next request.

## 4. Repo layout (target end state)

```
birthday-hunt/
├── src/                      → frontend (existing — minimal touches)
│   ├── App.tsx               → routing: solo vs team vs admin vs join
│   ├── screens/              → Intro, GpsPreface, LocationActive, Reveal,
│   │                            PhotoInterstitial, Finale (existing)
│   │   └── Join.tsx          → NEW (T20)
│   ├── state/huntReducer.ts  → thin re-export façade after Phase 2.A
│   ├── lib/
│   │   ├── useTeamState.ts   → NEW (T19): WebSocket sync hook
│   │   ├── api.ts            → NEW (T18): typed fetch helpers
│   │   └── teamSession.ts    → NEW (T20): localStorage for team session
│   ├── admin/                → NEW (T21–T23): /admin SPA
│   │   ├── AdminApp.tsx
│   │   ├── CreateHunt.tsx
│   │   └── HuntDetail.tsx
│   └── config.ts             → existing; HuntConfigSchema.parse() at load
│
├── worker/                   → NEW: Cloudflare Worker
│   ├── index.ts              → Hono app + exported DO class
│   ├── routes/
│   │   ├── admin.ts          → /api/admin/* (T13)
│   │   ├── teams.ts          → /api/teams/* (T14, T17)
│   │   └── hunts.ts          → /api/hunts/:id/config (T14)
│   ├── do/
│   │   └── TeamSession.ts    → DO (T15–T17)
│   ├── db/
│   │   ├── queries.ts        → prepared-statement helpers (T8)
│   │   ├── schema.ts         → TS row types (T8)
│   │   └── migrations/
│   │       └── 0001_init.sql ✓ (T7 — already created)
│   ├── lib/
│   │   ├── invite.ts         → 8-char Crockford base32 (T9)
│   │   ├── access.ts         → CF Access JWT verify (T10)
│   │   └── validators.ts     → re-export shared Zod + worker schemas (T11)
│   ├── middleware/
│   │   └── errors.ts         → Zod errors → 400 JSON (T12)
│   ├── wrangler.toml         ✓ (T6)
│   └── tsconfig.json         ✓ (T6)
│
├── shared/                   → cross-environment contract — ALL DONE
│   ├── index.ts              ✓ barrel
│   ├── state/
│   │   ├── types.ts          ✓ inferred via z.infer
│   │   ├── schema.ts         ✓ Zod source of truth
│   │   └── reducer.ts        ✓ pure huntReducer
│   ├── config/
│   │   ├── types.ts          ✓
│   │   └── schema.ts         ✓
│   ├── messages.ts           ✓ ClientMsg/ServerMsg with v:1 envelope
│   └── tsconfig.json         ✓
│
├── tests/                    → vitest + playwright (T8 onwards)
├── planning/                 → frozen v1 research (MASTER-PLAN + 3 docs)
├── specs/                    → live design docs
│   ├── multiplayer-backend.md   → the spec
│   ├── multiplayer-plan.md      → the plan
│   ├── multiplayer-tasks.md     → 28-task breakdown
│   └── handoff-prompt.md        → this file
└── docs/                     → existing screenshots
```

## 5. Data model (D1 — already migrated locally)

See `worker/db/migrations/0001_init.sql` for the source of truth. Five tables:

| Table        | Purpose                                                         |
|--------------|-----------------------------------------------------------------|
| `hunts`      | Admin-defined hunt: deadline + serialized `HuntConfig`          |
| `teams`      | Invite code + name; FK to hunt                                  |
| `players`    | Name + browser-generated `client_id`; FK to team; unique on `(team_id, client_id)` |
| `team_state` | Server-authoritative current `HuntState` per team               |
| `audit_log`  | Admin email (from CF Access JWT) + action + target on every admin mutation |

## 6. API contract (target)

All JSON. Errors use `{ error: { code: string, message: string } }`.

| Method | Path                              | Auth     | Purpose                                  |
|--------|-----------------------------------|----------|------------------------------------------|
| POST   | `/api/admin/hunts`                | CF Access| create hunt                              |
| GET    | `/api/admin/hunts`                | CF Access| list hunts                               |
| GET    | `/api/admin/hunts/:id`            | CF Access| hunt detail + teams + progress           |
| PATCH  | `/api/admin/hunts/:id`            | CF Access| edit config / deadline                   |
| POST   | `/api/admin/hunts/:id/teams`      | CF Access| create team → returns invite_code        |
| POST   | `/api/teams/join`                 | open     | `{ invite_code, player_name, client_id }`|
| GET    | `/api/teams/:id`                  | player   | current team state (initial load)        |
| GET    | `/api/teams/:id/ws?player_id=...` | player   | upgrade to WebSocket                     |
| GET    | `/api/hunts/:id/config`           | player   | hunt config (resolved via team)          |

### WebSocket protocol (v=1)

```ts
type ClientMsg =
  | { v: 1; type: 'action'; action: HuntAction }
  | { v: 1; type: 'ping' };

type ServerMsg =
  | { v: 1; type: 'state'; state: HuntState }
  | { v: 1; type: 'presence'; players: PlayerPresence[] }
  | { v: 1; type: 'error'; code: string; message: string }
  | { v: 1; type: 'pong' };
```

All schemas defined in `shared/messages.ts` with Zod.

## 7. Frontend mode routing

```ts
// Pseudocode for src/App.tsx (T24)
if (url.startsWith('/admin')) return <AdminApp />;        // T21–T23
if (url.startsWith('/join'))  return <JoinScreen />;       // T20
if (localStorage.has(team))   return <TeamModeApp />;      // T19 hook
return <SoloModeApp />;                                    // existing, unchanged
```

`<TeamModeApp>` is a thin wrapper: it calls `useTeamState(teamId)` and passes
the `{state, dispatch}` to the **existing** `<Router>` switch in `App.tsx`. All
existing screens (Intro, LocationActive, Reveal, Finale, etc.) are reused
unchanged.

## 8. Resolved decisions log

All 8 open questions from `specs/multiplayer-backend.md` are resolved:

1. Frontend hosting → **Cloudflare Pages**
2. Admin auth → **Cloudflare Access** (Zero Trust)
3. GPS validation → **trust client**
4. Photo interstitials → **synchronized team-wide**
5. Reconnect → **re-bind via client_id**
6. Test mode → **local only** (admin gets team-wide `JUMP_TO_STEP`)
7. Hunt config → `src/config.ts` canonical + `hunts.config_json` validated
8. Max players/team → **10**

## 9. Progress (per `specs/multiplayer-tasks.md`)

✅ **Phase 2.A — `shared/` contract (T1–T5) COMPLETE**
- T1 ✓ Scaffold `shared/` + tsconfig paths
- T2 ✓ Move state types to `shared/state/types.ts`
- T3 ✓ Move `huntReducer` to `shared/state/reducer.ts`
- T4 ✓ Extract `HuntConfig` + Zod schema
- T5 ✓ WS message envelopes in `shared/messages.ts`

✅ **Phase 2.B — D1 schema (T6–T7 done, T8 next)**
- T6 ✓ Bootstrap `worker/` with Wrangler (D1 + DO bindings, /healthz works)
- T7 ✓ Migration `0001_init.sql` applied (all 5 tables present)
- T8 ⏳ Prepared-statement query helpers in `worker/db/queries.ts`

⏳ **Phase 2.C — Worker library (T9–T11)**
- T9 invite code generator (8-char Crockford base32)
- T10 CF Access JWT verify with JWKS cache + dev bypass via `ACCESS_DEV_BYPASS`
- T11 validators barrel re-exporting shared Zod + worker-only schemas

⏳ **Phase 2.D — HTTP routes (T12–T14)**
- T12 Hono bootstrap + error middleware
- T13 Admin routes (CRUD + audit_log writes)
- T14 Team routes (join, get, hunt config)

⏳ **Phase 2.E — Durable Object (T15–T17)**
- T15 DO skeleton with persistence + hibernation
- T16 Wire `huntReducer` + broadcast on action
- T17 WS upgrade route + presence tracking

⏳ **Phase 2.F+G — Frontend connection + Join (T18–T20)**
- T18 `src/lib/api.ts` typed fetch helpers
- T19 `src/lib/useTeamState.ts` (WebSocket sync hook)
- T20 `src/screens/Join.tsx` (invite code + name)

⏳ **Phase 2.H — Admin SPA (T21–T23)**
- T21 Admin entry + router
- T22 CreateHunt page
- T23 HuntDetail page (manage teams + live progress)

⏳ **Phase 2.I — Mode routing (T24)**

⏳ **Phase 2.J — Deploy (T25–T27)**
- T25 Cloudflare Pages config
- T26 Cloudflare Access app setup
- T27 Disable GitHub Pages workflow (set to `workflow_dispatch`)

⏳ **Phase 2.K — E2E (T28)**
- T28 Playwright two-tab cooperative test

## 10. Verification commands (all working as of T7)

```bash
# Frontend
npm run dev          # vite, localhost:5173
npm run build        # tsc && vite build
npm run typecheck    # types both frontend AND worker

# Worker
npm run worker:dev   # wrangler dev → localhost:8787
npm run worker:deploy
npm run db:migrate   # local D1
npm run db:migrate:remote
npm run db:exec -- --command "SELECT ..."

# Verify worker is up
curl http://127.0.0.1:8787/healthz
# → {"ok":true,"ts":...}
```

## 11. Risk register (top 5)

1. **DO hibernation eats unflushed state** → persist to D1 before broadcasting.
2. **CF Access JWT verify fails** (wrong aud, key rotation) → cache JWKS in DO
   storage with 24h TTL, dev bypass via `.dev.vars`.
3. **Solo mode breaks during refactor** → mode routing in App.tsx is the LAST
   change. Every PR runs solo smoke. Rollback = revert one commit.
4. **Reducer drift between client and server** → only one reducer, in
   `shared/state/reducer.ts`, imported by both sides.
5. **Vite `base` change from `/birthday-hunt/` to `/` breaks asset paths** →
   do it as a single explicit commit, test with `npm run preview` first.

## 12. Resuming work — what to do next

The next task in dependency order is **T8: write `worker/db/queries.ts`** —
prepared-statement helpers for D1 covering: insert/get/list/patch hunt;
insert/get team by invite code; upsert/get player; read/write team_state;
append audit_log. Each helper returns TS-typed rows matching shared/ types.

Acceptance: vitest unit tests with miniflare D1, one happy + one not-found
case per helper.

To start: install vitest + `@cloudflare/vitest-pool-workers`, write
`worker/vitest.config.ts`, write `worker/db/schema.ts` (row types matching the
SQL columns), then `worker/db/queries.ts`, then tests.

## 13. Tone / style conventions

- **Lowercase copy is intentional and stays lowercase** (Michael Reeves
  aesthetic — see `planning/MASTER-PLAN.md` §2.4).
- **Conventional Commits** (`feat:`, `fix:`, `chore:`).
- **Discriminated unions** for state and actions; no booleans-as-state.
- **JSDoc only where intent is non-obvious.** No "this function does X"
  narration. Lean comments.
- **Pure reducers.** Side effects (WebSocket, GPS, sound) live in hooks or
  effect handlers.
- **One file = one concern.** Components ≤200 lines.
- **No new deps without explicit ok.**

## 14. Files to read first (in order, when resuming)

1. `specs/multiplayer-backend.md` — the spec (what + why)
2. `specs/multiplayer-plan.md` — the plan (how + when)
3. `specs/multiplayer-tasks.md` — the task list (next steps)
4. `planning/MASTER-PLAN.md` — v1 design (frozen but informative)
5. `src/state/huntReducer.ts` — re-export façade; check `shared/state/`
6. `src/config.ts` — solo-mode config + Zod validation
7. `worker/index.ts` — current Worker skeleton
8. `worker/wrangler.toml` — bindings (D1, DO, ACCESS_AUD)
9. `worker/db/migrations/0001_init.sql` — D1 schema

---

**Status as of this handoff:** Phase 2.A complete, Phase 2.B halfway. Next task
is T8 (`worker/db/queries.ts`). All typecheck and build commands green. Solo
mode unaffected.
