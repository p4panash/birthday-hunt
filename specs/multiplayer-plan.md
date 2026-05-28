# Plan: Multiplayer Backend Implementation

> **Status:** Draft, awaiting human approval (Phase 2 of Addy Osmani's
> spec-driven workflow). References `specs/multiplayer-backend.md` —
> the spec is the *what*, this plan is the *how* and the *order*.
> Until this plan is approved, no task breakdown begins.

## 1. Components and Dependencies

```
                      ┌──────────────────────────┐
                      │  shared/ (types, Zod)    │ ← contract
                      │  • HuntAction            │
                      │  • HuntState             │
                      │  • HuntConfig            │
                      │  • WS message envelopes  │
                      └────────────┬─────────────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            ▼                                             ▼
   ┌────────────────┐                            ┌──────────────────┐
   │  worker/       │                            │  src/ (frontend) │
   │                │                            │                  │
   │  Hono router   │                            │  Existing solo   │
   │   ↓            │                            │  mode (untouched)│
   │  Admin routes  │◄─── Cf-Access JWT ────┐    │   ↓              │
   │  Team routes   │                       │    │  Team mode:      │
   │   ↓            │                       │    │   • Join screen  │
   │  TeamSession   │◄═══ WebSocket ════════╪═══►│   • useTeamState │
   │  Durable Object│                       │    │   • Admin pages  │
   │   ↓                                    │    │                  │
   │  D1 queries    │                       │    │                  │
   └────────┬───────┘                       │    └──────────────────┘
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

### Build dependency order (must-be-built-first first)

1. **`shared/`** — types + Zod schemas. Nothing compiles until these exist.
2. **`worker/db/`** — D1 schema (migration 0001) + query helpers.
3. **`worker/lib/`** — auth (CF Access JWT verify), invite-code generator,
   shared validators.
4. **`worker/routes/`** — Hono app, admin + team HTTP routes.
5. **`worker/do/TeamSession.ts`** — Durable Object with WebSocket fan-out
   and reducer reuse.
6. **`src/lib/useTeamState.ts`** + **`src/lib/api.ts`** — frontend
   connection layer.
7. **`src/screens/Join.tsx`** — invite-code entry screen.
8. **`src/admin/`** — admin SPA (CreateHunt, ManageTeams, LiveProgress).
9. **`src/App.tsx`** — mode-routing logic to wire team mode in without
   breaking solo mode.
10. **Cloudflare Pages config** — replace GitHub Pages deploy.
11. **End-to-end verification** — Playwright two-tab cooperative test.

## 2. Parallelizable vs Sequential

| Phase | Work                           | Sequential dependency        |
|-------|--------------------------------|------------------------------|
| 2.A   | `shared/` types                | none — start here            |
| 2.B   | D1 schema + migrations         | depends on 2.A               |
| 2.C   | `worker/lib/` utilities        | depends on 2.A               |
| 2.D   | `worker/routes/` (HTTP only)   | depends on 2.B, 2.C          |
| 2.E   | `TeamSession` Durable Object   | depends on 2.B, 2.C, `huntReducer` move into `shared/` |
| 2.F   | `useTeamState` + `api.ts`      | depends on 2.A, 2.D, 2.E     |
| 2.G   | `Join` screen                  | depends on 2.F               |
| 2.H   | Admin SPA                      | depends on 2.D (HTTP only — does not need WS) |
| 2.I   | `App.tsx` mode routing         | depends on 2.G, 2.H          |
| 2.J   | Cloudflare Pages deploy        | depends on 2.I               |
| 2.K   | Playwright e2e                 | depends on 2.J               |

**Parallelization windows:**

- After 2.A: 2.B, 2.C can run in parallel.
- After 2.D: 2.E and 2.H can run in parallel (admin SPA needs only HTTP;
  the DO is for player-facing realtime).
- 2.F and 2.G are tightly coupled — pair them in one focused session.

The skill `superpowers:dispatching-parallel-agents` applies for 2.B+2.C
and 2.E+2.H. Outside those windows, sequential is safer.

## 3. Risks and Mitigations

| # | Risk                                                                                  | Likelihood | Impact | Mitigation                                                                                                       |
|---|---------------------------------------------------------------------------------------|------------|--------|------------------------------------------------------------------------------------------------------------------|
| 1 | Durable Object WebSocket hibernation eats unflushed state                             | M          | H      | Persist to D1 *before* broadcasting. Acknowledge actions only after D1 write succeeds.                           |
| 2 | Cloudflare Access JWT verification fails (wrong audience tag, key rotation)           | M          | H      | Lock down `aud` claim in env var. Cache JWKS in DO storage with 24h TTL. Add `wrangler dev` bypass via `.dev.vars`. |
| 3 | Solo mode breaks during frontend refactor                                             | M          | H      | Solo path is the default. Every PR runs a manual solo smoke test. Mode routing in `App.tsx` is the last thing touched. |
| 4 | Reducer in `shared/` drifts between client and server implementations                 | L          | H      | Move `huntReducer` into `shared/` once and import on both sides. Same test vectors run in both vitest configs.   |
| 5 | Multiple admins editing the same hunt mid-game cause lost updates                     | L          | M      | Use D1 `updated_at` as optimistic-lock token. PATCH requires `If-Match` header.                                  |
| 6 | Player joins mid-hunt and sees stale state because WS connects before initial fetch   | M          | M      | Initial state arrives in the *first* WS frame on connect; client doesn't render until that frame lands.          |
| 7 | Vite `base` change from `/birthday-hunt/` to `/` breaks asset paths                   | M          | M      | Do the base change as a single explicit commit. Test with `npm run preview` before Pages deploy.                 |
| 8 | Cloudflare free-tier limits (DO CPU, WS subrequests) hit during testing               | L          | M      | Stay well under: 10 players per DO, no chatty heartbeats (ping every 30s, not every 5s).                         |
| 9 | GitHub Pages workflow keeps deploying stale code and confuses URLs                    | M          | L      | Disable the workflow on the same commit that introduces Pages deploy. Keep file for rollback.                    |
| 10| `huntReducer` action set is missing actions needed for admin overrides (e.g. JUMP_TO_STEP for team) | M | M | Audit the action union early in 2.A; add `ADMIN_JUMP_TO_STEP` if needed. Bump the wire-protocol `v` if shape changes. |

## 4. Verification Checkpoints

Each checkpoint blocks the next phase. Don't advance until the checkpoint
passes — Phase 4 (Implement) per Addy's `incremental-implementation` skill.

### CP-1 — After `shared/` is wired (end of 2.A)

- [ ] `npm run typecheck` is green from both `src/` and `worker/`.
- [ ] `huntReducer` moved to `shared/state/`; existing solo mode still
      compiles and runs unchanged via re-export.
- [ ] All Zod schemas have matching TS types (no drift).

### CP-2 — After D1 schema + worker routes (end of 2.D)

- [ ] `wrangler d1 migrations apply --local` succeeds.
- [ ] Each route has at least one happy-path + one error-path vitest.
- [ ] CF Access JWT verification rejects an unsigned token, accepts a
      mocked valid token.

### CP-3 — After `TeamSession` DO (end of 2.E)

- [ ] Two simulated WS clients (vitest) receive each other's state
      updates within one event-loop tick.
- [ ] DO survives hibernation: simulate `state.deleteAll()` then
      reconnect and verify rehydration from D1.
- [ ] Reducer determinism: same action sequence on client + server
      produces identical state.

### CP-4 — After team-mode frontend (end of 2.G)

- [ ] Join screen accepts invite code, posts to `/api/teams/join`,
      receives session, opens WS.
- [ ] `useTeamState` re-renders on every `state` frame.
- [ ] Refresh preserves session via localStorage (`{ team_id, player_id }`
      only — no state cached).
- [ ] Solo mode still works when no team session exists.

### CP-5 — After admin SPA (end of 2.H)

- [ ] Logged-in admin can create a hunt, then create a team for it,
      then see the invite code.
- [ ] Live progress page updates as the team plays (poll every 2s — no
      WS in admin v0).
- [ ] Unauthenticated request to `/admin` redirects to CF Access.

### CP-6 — After Cloudflare Pages deploy (end of 2.J)

- [ ] Pages deploy URL serves the SPA correctly with all assets.
- [ ] Worker route + Pages route share an origin (no CORS in browser
      devtools).
- [ ] GitHub Pages workflow is disabled (`workflow_dispatch`-only).

### CP-7 — Playwright two-tab e2e (end of 2.K)

- [ ] Open `/join` in two contexts → both enter the same invite code →
      both land on intro.
- [ ] Tab 1 triggers `START_HUNT` → tab 2 advances within 500ms.
- [ ] Tab 1 enters checkpoint code → tab 2 sees reveal animation.
- [ ] Disconnect tab 1's network for 5s → tab 2 keeps playing → tab 1
      reconnects and resyncs to current state.

## 5. Out of Scope (this iteration)

Explicit non-goals to prevent scope creep:

- **Real-time admin dashboard.** v0 admin polls; live WS for admin
  comes later if needed.
- **Multiple concurrent hunts.** The data model supports it; the UI
  doesn't surface a hunt switcher.
- **Native mobile app.** Mobile-first web, that's it.
- **Translations / i18n framework.** Copy stays in `src/config.ts`
  (or `hunts.config_json`) per-hunt.
- **Spectator mode** (non-team members watching live).
- **Hunt cloning / templates.** Admin recreates by hand.
- **Replacing solo mode.** Solo mode is preserved indefinitely.

## 6. Rollback Strategy

If multiplayer turns out to be unshippable for any reason (Cloudflare
issue, time pressure, bug):

1. Revert the `App.tsx` mode-routing commit. Solo mode is the default
   anyway, but this removes the team mode UI entirely.
2. Re-enable `.github/workflows/deploy.yml`. Push to `main` → GitHub
   Pages serves the v1 solo app.
3. Pages and Workers can stay deployed (no harm); the frontend simply
   stops linking to them.

This means **solo mode is the load-bearing rollback target.** Don't
break it. The plan treats solo-mode preservation as a non-negotiable
constraint, not a nice-to-have.

## 7. Estimated Effort

Order-of-magnitude only — not commitments.

| Phase | Rough effort | Notes                                                      |
|-------|--------------|------------------------------------------------------------|
| 2.A   | 0.5 day      | Type extraction + reducer move; mostly mechanical.         |
| 2.B   | 0.5 day      | One migration + query helpers; tested via vitest.          |
| 2.C   | 0.5 day      | CF Access JWT verify is the trickiest piece.               |
| 2.D   | 1 day        | HTTP routes + Zod validation + tests.                      |
| 2.E   | 1.5 days     | DO is the highest-risk piece; budget extra debugging time. |
| 2.F+G | 1 day        | Hook + Join screen; tight coupling.                        |
| 2.H   | 1 day        | Admin SPA — keep it minimal.                               |
| 2.I   | 0.5 day      | Mode routing in App.tsx.                                   |
| 2.J   | 0.5 day      | Pages config + DNS + Access app setup.                     |
| 2.K   | 0.5 day      | Two-tab Playwright.                                        |
| **Total** | **~7.5 days** | Single-developer sequential; less with parallelization. |

## 8. Approval Checklist

Human reviewer confirms before moving to Phase 3 (Tasks):

- [ ] Component diagram matches mental model.
- [ ] Build order makes sense (no skipped dependencies).
- [ ] Risk register covers the failure modes that worry you.
- [ ] Verification checkpoints are concrete and observable.
- [ ] Out-of-scope list reflects what you actually want deferred.
- [ ] Rollback strategy is acceptable.
- [ ] Effort estimate is in the right ballpark for your timeline.

---

**Next phase (Tasks)** begins only when this plan is approved.
