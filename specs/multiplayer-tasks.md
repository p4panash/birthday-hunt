# Tasks: Multiplayer Backend Implementation

> **Status:** Draft, awaiting human approval (Phase 3 of Addy Osmani's
> spec-driven workflow). References `specs/multiplayer-backend.md` (spec)
> and `specs/multiplayer-plan.md` (plan). Until this list is approved, no
> implementation begins.
>
> **Conventions:**
> - Tasks are ordered by dependency. Don't skip ahead.
> - Each task ≤5 files touched.
> - Each task lists: **Acceptance** (what's true when done), **Verify**
>   (how to confirm — test, command, or manual check), **Files** (touched).
> - Tasks within a phase that are independent can be parallelized; the
>   plan's parallelization windows still apply.

---

## Phase 2.A — `shared/` contract

### T1. Scaffold `shared/` directory + tsconfig wiring
- **Acceptance:** `shared/` exists at repo root with `index.ts` re-exporting
  submodules. `tsconfig.json` in both `src/` and (future) `worker/` resolve
  `shared/*` correctly via path aliases.
- **Verify:** `npm run typecheck` is green. `import { foo } from 'shared'`
  resolves in a scratch file.
- **Files:** `shared/index.ts`, `shared/tsconfig.json`, `tsconfig.json`
  (add `paths`).

### T2. Move `HuntStep`, `HuntState`, `HuntAction`, `CheckpointIndex` into `shared/state/types.ts`
- **Acceptance:** Types live in `shared/state/types.ts`. `src/state/huntReducer.ts`
  re-exports them so existing imports throughout `src/` remain unchanged.
- **Verify:** `npm run typecheck` green. `npm run dev` runs solo mode without
  errors. Diff shows no behavioural changes to `src/`.
- **Files:** `shared/state/types.ts` (new), `src/state/huntReducer.ts`
  (re-export).

### T3. Move `huntReducer` + `initialState` + `STORAGE_KEY` into `shared/state/reducer.ts`
- **Acceptance:** Reducer is in `shared/state/reducer.ts`, pure (no DOM refs).
  `src/state/huntReducer.ts` re-exports for unchanged frontend imports.
- **Verify:** Solo mode end-to-end works in `npm run dev`. Existing reducer
  unit tests (if any) still pass.
- **Files:** `shared/state/reducer.ts` (new), `src/state/huntReducer.ts`
  (re-export).

### T4. Extract `HuntConfig` types + Zod schema into `shared/config/`
- **Acceptance:** `shared/config/types.ts` holds the TypeScript shape;
  `shared/config/schema.ts` holds a Zod schema that produces the same type.
  `src/config.ts` imports `HuntConfig` from `shared/config/types`.
- **Verify:** `npm run typecheck` green. `npm install zod`. Round-trip:
  `schema.parse(config)` returns the existing config unchanged.
- **Files:** `shared/config/types.ts` (new), `shared/config/schema.ts`
  (new), `src/config.ts` (import path), `package.json` (zod).

### T5. Define WebSocket message envelopes in `shared/messages.ts`
- **Acceptance:** Discriminated unions `ClientMsg` + `ServerMsg` (v=1)
  defined with matching Zod schemas. Includes `action`, `state`, `presence`,
  `ping`, `pong`, `error` variants.
- **Verify:** `schema.parse({ v: 1, type: 'action', action: { type: 'START_HUNT' }})`
  succeeds. Malformed message fails parse.
- **Files:** `shared/messages.ts` (new).

**Checkpoint CP-1:** all of 2.A done, typecheck green from both sides,
solo mode unchanged.

---

## Phase 2.B — D1 schema

### T6. Bootstrap `worker/` workspace with Wrangler config
- **Acceptance:** `worker/wrangler.toml` declares Worker name, compatibility
  date, D1 binding (`DB`), DO binding (`TEAM_SESSION`), and `[vars]` for
  `ACCESS_AUD` (CF Access audience tag). `npm run worker:dev` starts wrangler
  dev (even with empty Worker).
- **Verify:** `npm run worker:dev` runs without errors. `curl localhost:8787/healthz`
  returns 200 from a minimal handler.
- **Files:** `worker/wrangler.toml` (new), `worker/index.ts` (minimal handler),
  `package.json` (scripts: worker:dev, worker:test, db:migrate, deploy),
  `worker/tsconfig.json` (new).

### T7. Write migration `0001_init.sql`
- **Acceptance:** Migration creates all 5 tables (`hunts`, `teams`, `players`,
  `team_state`, `audit_log`) + indexes exactly as specified in
  `multiplayer-backend.md` §Data Model.
- **Verify:** `wrangler d1 migrations apply DB --local` succeeds. Run
  `wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master WHERE type='table'"`
  → returns all 5 tables.
- **Files:** `worker/db/migrations/0001_init.sql` (new).

### T8. Prepared-statement query helpers in `worker/db/queries.ts`
- **Acceptance:** Typed wrappers around D1 prepared statements for: insert
  hunt, get hunt, list hunts, patch hunt; insert team, get team by invite
  code, list teams by hunt; insert/upsert player, get player by client_id;
  read/write team_state; append audit_log. Each returns TS-typed rows
  matching `shared/` types.
- **Verify:** Vitest unit tests with miniflare D1: each helper has one
  happy + one not-found case. `npm run worker:test` green.
- **Files:** `worker/db/queries.ts` (new), `worker/db/schema.ts` (TS row
  types, new), `tests/worker/queries.test.ts` (new).

**Checkpoint CP-2 (partial):** D1 migration applies, queries tested.

---

## Phase 2.C — Worker library

### T9. Invite code generator at `worker/lib/invite.ts`
- **Acceptance:** Exports `generateInviteCode()` returning 8-char base32
  (Crockford — no `I`/`L`/`O`/`U`), and `isValidInviteCode(s)` predicate.
  Collision check is the caller's responsibility.
- **Verify:** Unit test: 10k generations all match `/^[0-9A-HJKMNP-TV-Z]{8}$/`.
  No duplicates in 10k (probabilistic, but vanishingly likely).
- **Files:** `worker/lib/invite.ts` (new), `tests/worker/invite.test.ts`
  (new).

### T10. Cloudflare Access JWT verification at `worker/lib/access.ts`
- **Acceptance:** Exports `verifyAccessJwt(req, env)` that reads
  `Cf-Access-Jwt-Assertion`, fetches JWKS from `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`
  (cached in DO storage with 24h TTL), verifies signature + `aud` claim, returns
  `{ email, sub }` or throws. Local-dev bypass via `env.ACCESS_DEV_BYPASS=true`.
- **Verify:** Vitest with mocked JWKS endpoint: valid token → returns claims;
  wrong audience → throws; expired → throws; missing header → throws.
- **Files:** `worker/lib/access.ts` (new), `tests/worker/access.test.ts`
  (new), `package.json` (jose dependency).

### T11. Shared validators barrel at `worker/lib/validators.ts`
- **Acceptance:** Re-exports Zod schemas from `shared/` plus Worker-only
  schemas (e.g. `CreateHuntRequest`, `JoinTeamRequest`, `PatchHuntRequest`).
- **Verify:** Each schema has one positive + one negative vitest case.
- **Files:** `worker/lib/validators.ts` (new), `tests/worker/validators.test.ts`
  (new).

---

## Phase 2.D — HTTP routes

### T12. Hono app bootstrap + middleware in `worker/index.ts`
- **Acceptance:** Hono router mounted at `/api/*`, with: error middleware
  (Zod errors → 400 JSON, unknown → 500), request logging (console only),
  CORS preflight handler (allow same-origin only). Exports `TeamSession`
  DO class binding (placeholder until T18).
- **Verify:** `npm run worker:dev` → `curl /api/nonexistent` returns 404
  JSON; `curl /healthz` returns 200.
- **Files:** `worker/index.ts` (rewrite), `worker/middleware/errors.ts` (new),
  `package.json` (hono dependency).

### T13. Admin routes: hunts CRUD in `worker/routes/admin.ts`
- **Acceptance:** `POST /api/admin/hunts`, `GET /api/admin/hunts`,
  `GET /api/admin/hunts/:id`, `PATCH /api/admin/hunts/:id`,
  `POST /api/admin/hunts/:id/teams`. Each route runs `verifyAccessJwt`,
  validates body with Zod, calls D1 helper, returns JSON. Mutations write
  to `audit_log`.
- **Verify:** Vitest with mocked CF Access: each route has happy + auth-fail
  + validation-fail cases. PATCH with `If-Match` header tested for
  optimistic-lock behaviour.
- **Files:** `worker/routes/admin.ts` (new), `tests/worker/admin-routes.test.ts`
  (new). (`worker/index.ts` mount, ≤5 files total.)

### T14. Team routes: join + state + hunt config in `worker/routes/teams.ts`
- **Acceptance:** `POST /api/teams/join` (Zod-validates body, looks up
  invite_code, upserts player by client_id, returns `{ team_id, player_id, hunt_config }`).
  `GET /api/teams/:id` (returns team + current `team_state`). `GET /api/hunts/:id/config`
  (public, resolves via team).
- **Verify:** Vitest: join with valid invite → success; invalid invite → 404;
  re-join with same client_id → re-binds same player_id; different client_id →
  new player_id.
- **Files:** `worker/routes/teams.ts` (new), `tests/worker/team-routes.test.ts`
  (new), `worker/index.ts` (mount).

**Checkpoint CP-2 (full):** HTTP routes pass tests; auth rejects unsigned.

---

## Phase 2.E — Durable Object

### T15. `TeamSession` DO skeleton with persistence
- **Acceptance:** Class with `fetch()` handler for WS upgrade only.
  Internal state: in-memory `HuntState` + map of connections. On first
  request, rehydrates state from D1 `team_state` row. Provides
  `loadState()`, `persistState()` private methods.
- **Verify:** Vitest with miniflare DO: create DO, send a fake state via
  fetch, restart DO (`state.deleteAll()` + new instance), verify state
  rehydrates from D1.
- **Files:** `worker/do/TeamSession.ts` (new),
  `tests/worker/team-session-hibernation.test.ts` (new).

### T16. Wire `huntReducer` into DO + WS broadcast on action
- **Acceptance:** DO accepts WebSocket upgrades at the fetch handler.
  On `ClientMsg.action`: parse with Zod, apply `huntReducer`, persist to D1,
  broadcast `ServerMsg.state` to all connected sockets. On connect: send
  current state as first frame. On disconnect: cleanup connection map.
- **Verify:** Vitest with two simulated WS clients: client A sends
  `START_HUNT` → client B receives `state` frame with `step.kind === 'gps-preface'`
  within one tick. Sequential actions preserve order.
- **Files:** `worker/do/TeamSession.ts` (extend),
  `tests/worker/team-session-broadcast.test.ts` (new).

### T17. WS upgrade route + presence tracking
- **Acceptance:** `GET /api/teams/:id/ws?player_id=...` returns 101
  Switching Protocols and forwards to the DO instance for that team.
  Presence: DO tracks `{ player_id, connected_at }` per socket; broadcasts
  `ServerMsg.presence` when membership changes.
- **Verify:** Vitest: open WS for two players → both receive `presence`
  with 2 entries. Close one → other receives `presence` with 1 entry.
- **Files:** `worker/routes/teams.ts` (extend with WS route),
  `worker/do/TeamSession.ts` (presence logic),
  `tests/worker/team-session-presence.test.ts` (new).

**Checkpoint CP-3:** DO state transitions + broadcast + presence all green.

---

## Phase 2.F+G — Frontend team-mode connection + Join screen

### T18. Typed fetch helpers in `src/lib/api.ts`
- **Acceptance:** Exports `joinTeam`, `getTeamState`, `getHuntConfig`, plus
  admin variants. Each parses response with Zod from `shared/`. Throws typed
  `ApiError` on non-2xx.
- **Verify:** Frontend vitest with `fetch` mocked: success path returns
  parsed data; error path throws `ApiError` with code+message.
- **Files:** `src/lib/api.ts` (new), `tests/frontend/api.test.ts` (new).

### T19. `useTeamState` hook in `src/lib/useTeamState.ts`
- **Acceptance:** Returns `{ state, dispatch, presence, connected }` where
  `dispatch` shape matches existing `huntReducer` dispatch. Opens WebSocket
  on mount, reconnects with backoff on disconnect, parses server frames with
  Zod schema from `shared/`. Optimistic apply: `dispatch` applies action
  locally THEN sends over WS; server `state` frame reconciles.
- **Verify:** Frontend vitest with mocked WebSocket: connecting → receives
  initial state → updates render. Sending action → server confirms → state
  matches. Disconnect → `connected === false` → reconnect → resync.
- **Files:** `src/lib/useTeamState.ts` (new),
  `tests/frontend/useTeamState.test.ts` (new).

### T20. `Join` screen in `src/screens/Join.tsx`
- **Acceptance:** Form with invite-code (auto-uppercase, 8 chars) + name
  input. On submit: calls `joinTeam`, persists `{ team_id, player_id }` to
  localStorage under `bday-hunt-team-v1`, navigates to team mode. Error UI
  for invalid code. Uses existing palette + mascot.
- **Verify:** Manual: open `/join`, enter mock code+name in dev → lands on
  team-mode intro screen. Refresh → restores session.
- **Files:** `src/screens/Join.tsx` (new), `src/lib/teamSession.ts` (new —
  localStorage helpers for team session only).

---

## Phase 2.H — Admin SPA

> **Design source (added 2026-05-27):** `../treasure-hunt-ui-source/` (extracted
> from `goodLoot/Treasure Hunt.zip`) contains a "Trove" design system —
> 8-step setup wizard + map components (atlas/quest/svg) + clue editing
> (workbench/carddeck/coauthor) + styles.css with OKLCH palette + Instrument
> Serif/Geist/JetBrains Mono. T21–T23 port these from UMD/Babel-standalone to
> ESM modules. The wizard's `Hunt` shape (occasion/theme/stopCount/...) differs
> from our `HuntConfig` schema and must be reconciled — either by extending
> `HuntConfig` or by mapping wizard fields to existing ones during the save.

### T21. Admin app entry + simple router in `src/admin/AdminApp.tsx`
- **Acceptance:** Mount at `/admin`. Simple hash- or path-based router
  with routes: `/admin` (hunt list), `/admin/hunts/:id` (manage teams +
  live progress), `/admin/hunts/new` (create). Layout shell with auth
  status (email from CF Access whoami).
- **Verify:** Manual: visit `/admin` without CF Access cookie → CF Access
  redirect. With cookie → renders list.
- **Files:** `src/admin/AdminApp.tsx` (new), `src/admin/Layout.tsx` (new),
  `src/admin/main.tsx` (new — separate Vite entrypoint).

### T22. Create-hunt page in `src/admin/CreateHunt.tsx`
- **Acceptance:** Form for hunt name, friend name, deadline, and a JSON
  textarea for the `HuntConfig` body (default = current `src/config.ts`).
  On submit: POST `/api/admin/hunts`, redirects to hunt detail.
- **Verify:** Manual: submit form → hunt appears in list → DB row visible
  via `wrangler d1 execute`.
- **Files:** `src/admin/CreateHunt.tsx` (new), `src/admin/AdminApp.tsx`
  (route).

### T23. Manage-teams + live-progress page in `src/admin/HuntDetail.tsx`
- **Acceptance:** Shows hunt config (editable), list of teams with invite
  codes, "Create Team" button, per-team live progress (poll
  `GET /api/admin/hunts/:id` every 2s, render current step + unlocked).
  Edit-deadline inline input → PATCH.
- **Verify:** Manual: create a team → invite code visible. Open hunt as a
  player in another tab and unlock checkpoint → admin view updates within
  2s.
- **Files:** `src/admin/HuntDetail.tsx` (new), `src/admin/CreateTeam.tsx`
  (new), `src/admin/AdminApp.tsx` (route).

---

## Phase 2.I — App.tsx mode routing

### T24. Wire mode routing in `src/App.tsx`
- **Acceptance:** Single switch at the top of `<App>`:
  - URL starts with `/admin` → `<AdminApp>` (via separate entrypoint).
  - URL starts with `/join` → `<Join>`.
  - localStorage has team session → `<TeamModeApp>` (uses `useTeamState`).
  - Else → existing solo mode (untouched).
- **Verify:** Manual + automated: visit `/` with no session → solo mode
  intro. Visit `/join` → join screen. Complete join → team mode intro.
  Refresh → team mode persists. Clear localStorage → back to solo.
- **Files:** `src/App.tsx` (modify), `src/main.tsx` (modify if admin gets
  separate entrypoint), `src/screens/TeamModeApp.tsx` (new — thin wrapper
  passing useTeamState output to existing `<Router>`).

**Checkpoint CP-4:** Both solo + team mode work end-to-end locally.

---

## Phase 2.J — Cloudflare Pages deploy

### T25. Configure Cloudflare Pages for the frontend
- **Acceptance:** Pages project connected to the GitHub repo. Build:
  `npm run build`, output `dist/`. `_routes.json` (or Pages Functions
  config) excludes `/api/*` from Pages so Workers handles it. Vite `base`
  set to `/` if custom domain is used.
- **Verify:** Pages preview URL serves the SPA. `/api/healthz` hits the
  Worker, not Pages. Browser devtools shows same origin (no CORS).
- **Files:** `_routes.json` (new at repo root), `vite.config.ts` (base
  path), Cloudflare dashboard (manual config).

### T26. Set up Cloudflare Access for `/admin/*`
- **Acceptance:** Zero Trust application created covering `/admin/*` (or
  the admin subdomain). Identity provider configured (email OTP for v1).
  `ACCESS_AUD` env var set on the Worker.
- **Verify:** Unauthenticated visit to `/admin` → CF Access login page.
  After login → admin SPA renders. `Cf-Access-Jwt-Assertion` visible on
  `/api/admin/*` requests in devtools.
- **Files:** Cloudflare dashboard (manual), `worker/wrangler.toml`
  (ACCESS_AUD), `.dev.vars.example` (new).

### T27. Disable GitHub Pages workflow
- **Acceptance:** `.github/workflows/deploy.yml` trigger changed from
  `push: main` to `workflow_dispatch` only. Comment at top explains it's
  kept as a rollback target.
- **Verify:** Push to main → no GH Pages run. Manual dispatch from Actions
  UI → still works.
- **Files:** `.github/workflows/deploy.yml` (modify).

**Checkpoint CP-6:** Pages serves SPA, Workers serves API, Access protects
admin, GH Pages workflow disabled.

---

## Phase 2.K — End-to-end

### T28. Playwright two-tab cooperative test
- **Acceptance:** Test file uses two browser contexts, both join the same
  team, asserts state sync on:
  - `START_HUNT` from tab A → tab B advances within 500ms.
  - Code entry from tab A unlocks checkpoint → tab B sees reveal.
  - Tab A loses network 5s → tab B keeps playing → tab A reconnects and
    syncs.
- **Verify:** `npm run e2e` (new script) green. CI runs the test against
  Pages preview URL.
- **Files:** `tests/e2e/cooperative.spec.ts` (new),
  `playwright.config.ts` (new), `package.json` (e2e script + playwright
  dep), `.github/workflows/e2e.yml` (new).

**Checkpoint CP-7:** Two-tab cooperative play verified.

---

## Task Inventory

| #   | Phase | Task                                              | Est.    | Blocks      |
|-----|-------|---------------------------------------------------|---------|-------------|
| T1  | 2.A   | Scaffold `shared/`                                | 1h      | T2–T5       |
| T2  | 2.A   | Move state types                                  | 1h      | T3, T8      |
| T3  | 2.A   | Move reducer                                      | 1h      | T16, T19    |
| T4  | 2.A   | Extract HuntConfig + Zod                          | 2h      | T11, T13    |
| T5  | 2.A   | WS message envelopes                              | 1h      | T16, T19    |
| T6  | 2.B   | Wrangler bootstrap                                | 1h      | T7, T12     |
| T7  | 2.B   | D1 migration                                      | 1h      | T8          |
| T8  | 2.B   | Query helpers                                     | 3h      | T13, T14    |
| T9  | 2.C   | Invite code gen                                   | 1h      | T13         |
| T10 | 2.C   | CF Access JWT verify                              | 3h      | T13         |
| T11 | 2.C   | Validators barrel                                 | 1h      | T13, T14    |
| T12 | 2.D   | Hono bootstrap                                    | 2h      | T13, T14    |
| T13 | 2.D   | Admin HTTP routes                                 | 3h      | T21         |
| T14 | 2.D   | Team HTTP routes                                  | 3h      | T17, T18    |
| T15 | 2.E   | DO skeleton                                       | 3h      | T16         |
| T16 | 2.E   | Reducer + broadcast                               | 4h      | T17         |
| T17 | 2.E   | WS upgrade + presence                             | 3h      | T19         |
| T18 | 2.F   | Frontend api.ts                                   | 2h      | T19, T21    |
| T19 | 2.G   | useTeamState hook                                 | 4h      | T24         |
| T20 | 2.G   | Join screen                                       | 3h      | T24         |
| T21 | 2.H   | Admin app entry                                   | 2h      | T22, T23    |
| T22 | 2.H   | CreateHunt page                                   | 3h      | T24         |
| T23 | 2.H   | HuntDetail page                                   | 4h      | T24         |
| T24 | 2.I   | App.tsx mode routing                              | 2h      | T25         |
| T25 | 2.J   | Cloudflare Pages config                           | 2h      | T26, T28    |
| T26 | 2.J   | Cloudflare Access setup                           | 2h      | T28         |
| T27 | 2.J   | Disable GH Pages workflow                         | 0.5h    | —           |
| T28 | 2.K   | Playwright two-tab e2e                            | 3h      | —           |

**Total:** 28 tasks, ~60 hours of focused work.

## First Three Sessions (suggested)

If you want to start small and validate momentum:

1. **Session 1:** T1 + T2 + T3 (shared/ scaffold + state move) — ~3h.
   Frontend solo mode still works. Validates the contract approach.
2. **Session 2:** T4 + T5 (config Zod + WS envelopes) — ~3h. Now `shared/`
   is feature-complete.
3. **Session 3:** T6 + T7 (worker bootstrap + D1 migration) — ~2h.
   First Cloudflare touch, very contained.

After three sessions, you've established `shared/` + `worker/` skeleton +
D1 schema — enough surface area to validate the architecture before
investing in the larger DO + frontend work.

## Approval

Confirm before Phase 4 (Implement) begins:

- [ ] Task granularity is right (no task feels too big or too small).
- [ ] Ordering respects dependencies in `multiplayer-plan.md`.
- [ ] First-three-sessions plan is acceptable for getting started.
- [ ] No critical task missing (call out gaps).

---

**Next phase (Implement)** begins only when this task list is approved.
Phase 4 follows `agent-skills:incremental-implementation` +
`agent-skills:test-driven-development` per task.
