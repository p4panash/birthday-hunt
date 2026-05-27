# birthday-hunt — project workflow rules

Auto-loaded by Claude Code when working in this repo. These rules tell the
agent **which Addy Osmani agent-skill to invoke at which moment**, so the
process is consistent across sessions and across developers.

> All skills are in the `agent-skills:` namespace
> (`C:\Users\Bambi\.claude\plugins\cache\addy-agent-skills\agent-skills\…/skills/`).
> Invoke via the `Skill` tool. Subagents are invoked via the `Agent` tool with
> `subagent_type`.

---

## Architecture facts (so the agent stops re-deriving them)

- **Primary domain:** `hunt.use-adonis.com` (CNAME → Pages, proxied).
  Pages serves the SPA; a Worker route `hunt.use-adonis.com/api/*` sends
  API traffic to the Worker on the same origin (no CORS).
- **Frontend:** React 18 + Vite 5 + TypeScript 5 (existing v1), deployed to
  Cloudflare Pages project `birthday-hunt` (also at `birthday-hunt-awy.pages.dev`).
- **Backend:** Cloudflare Worker `birthday-hunt`, written with Hono + Zod +
  jose, plus one Durable Object per team for WebSocket fan-out. Also
  reachable at `birthday-hunt.raduroman94.workers.dev` as a fallback, but
  that URL returns 401 on admin paths because CF Access only protects
  `hunt.use-adonis.com`.
- **DB:** D1 (`birthday-hunt-db`, UUID `1ef8718c-1052-4454-9433-e21c552ddd99`).
- **Auth:** Cloudflare Access on `hunt.use-adonis.com/admin*` AND
  `hunt.use-adonis.com/api/admin*` (one app, both paths). Identity:
  email OTP (`raduroman94@gmail.com` in the allow policy). Team domain:
  `billowing-block-06aa.cloudflareaccess.com`. AUD lives as wrangler
  secret on the Worker.
- **State machine source of truth:** `shared/state/reducer.ts`. Run by both
  frontend (`useTeamState`) and DO (`TeamSession.applyAction`).
- **Solo mode is the rollback target.** Never let it regress. The Playwright
  suite enforces this.

Authoritative docs: `specs/multiplayer-backend.md`, `specs/multiplayer-plan.md`,
`specs/multiplayer-tasks.md`, `specs/handoff-prompt.md`.

---

## Workflow rules (in invocation order)

### Rule 1 — Spec before feature
**Trigger:** any request that adds new behaviour, modifies the state machine,
adds a route, or introduces a dependency.

**Action:** invoke `Skill agent-skills:spec-driven-development` and walk the
4 phases (Specify → Plan → Tasks → Implement). Don't shortcut to coding even
if the change "feels small" — the assumption checklist catches the
non-obvious things.

**Skip when:** typo fixes, copy edits, dependency version bumps inside the
same semver range.

### Rule 2 — Doubt-driven on irreversible decisions
**Trigger:** any choice that's hard to undo. Examples in this repo:
- Adding a column to a D1 migration (shipped migrations are immutable).
- Changing the WebSocket protocol version `v`.
- Changing the wrangler.toml `compatibility_date`.
- Modifying `shared/state/types.ts` (the contract between client + DO).

**Action:** invoke `Skill agent-skills:doubt-driven-development`. Run the
adversarial review before writing the code.

### Rule 3 — Source-driven on Cloudflare APIs
**Trigger:** writing new Worker code that touches D1, Durable Objects,
Cloudflare Access, Workers Cache, or Wrangler config.

**Action:** invoke `Skill cloudflare:cloudflare` or `cloudflare:wrangler` to
load current docs before writing. The training data lags Cloudflare's API
churn; doc-grounded code is the default.

### Rule 4 — TDD on backend logic
**Trigger:** new Worker code path (route handler, DO method, query helper,
validator).

**Action:** invoke `Skill agent-skills:test-driven-development`. Write the
failing vitest first under `tests/worker/`, then implement. The pool is
already configured (`@cloudflare/vitest-pool-workers`); migrations apply
automatically via `tests/setup.ts`.

### Rule 5 — Code review subagent before each commit
**Trigger:** before any `git commit`.

**Action:** spawn `Agent subagent_type=feature-dev:code-reviewer` with the
current `git diff` and a one-line context. The subagent reads in a clean
context and surfaces issues the implementing agent missed.

**Example prompt:**
> Review the diff staged on `birthday-hunt`. Context: I just added a route
> that lets admins push override actions to a team's Durable Object. The
> route forwards via `stub.fetch('/internal/action', ...)`. Check the
> authentication path, the JSON parsing, and the audit log write order.
> Report under 200 words.

### Rule 6 — `verify` script before declaring a feature done
**Trigger:** any time the agent or human is about to say "this is done" or
move on to the next task.

**Action:** run `npm run verify` (typecheck + worker:test + build + e2e).
All 4 phases must pass. If any fail, the work is not done.

### Rule 7 — `ship` skill before each deploy
**Trigger:** before `npm run worker:deploy`, `wrangler pages deploy`, or any
production push.

**Action:** invoke `Skill agent-skills:ship`. Walk the pre-launch checklist
(`/ship` covers monitoring, rollback path, secrets, schema migrations,
feature flags). For this repo specifically:
- D1 remote migration applied? (`npm run db:migrate:remote`)
- Worker secrets set? (`ACCESS_AUD`, `ACCESS_TEAM_DOMAIN`)
- Pages build env `VITE_API_BASE_URL` correct?
- GH Pages workflow still `workflow_dispatch` only?

### Rule 8 — Browser test via DevTools or harness for UI work
**Trigger:** any change to a React component the human is likely to see.

**Action:** invoke `Skill agent-skills:browser-testing-with-devtools` (or
use the local `browser-harness` if Chrome DevTools MCP is disconnected). Don't
declare a UI change "done" based on typecheck alone — eyeball it in the
browser.

### Rule 9 — Security audit on auth boundaries
**Trigger:** modifying `worker/lib/access.ts`, `worker/middleware/access.ts`,
`worker/routes/admin.ts`, anything touching `Cf-Access-Jwt-Assertion`, or the
audit_log table.

**Action:** spawn `Agent subagent_type=agent-skills:security-auditor` with the
diff. Report-only mode; the implementing agent decides what to act on.

### Rule 10 — task-observer logs as we go
**Trigger:** continuous, by SessionStart hook.

**Action:** the `task-observer` skill (One Skill to Rule Them All) is already
auto-invoked. Whenever a user correction reveals a missing rule, the agent
appends an entry to `skill-observations/log.md` so future sessions inherit
the lesson.

---

## Red flags that mean "stop and invoke a skill"

These are mental triggers that override "just keep going":

| Symptom | Skill |
|---------|-------|
| About to add a new dependency | Rule 1 (spec) + Rule 2 (doubt) |
| About to write SQL in a migration | Rule 2 (doubt) + Rule 4 (TDD) |
| About to commit | Rule 5 (code-reviewer subagent) |
| About to deploy | Rule 7 (ship) + Rule 6 (verify) |
| Typecheck green but feature feels unfinished | Rule 8 (browser-test) |
| Tempted to shortcut auth | Rule 9 (security-auditor) |
| Multiple iterations on the same bug | Skill `agent-skills:debugging-and-error-recovery` |
| Code is hard to read after a few rounds of changes | Skill `agent-skills:code-simplification` |

---

## Commands cheat sheet

```bash
npm run verify          # typecheck + worker tests + build + Playwright (canonical "is it green?")
npm run worker:test     # vitest run inside Miniflare
npm run e2e             # Playwright (auto-starts vite + wrangler with bypass)
npm run worker:dev      # wrangler dev (reads worker/.dev.vars if present)
npm run dev             # vite dev (proxies /api/* + ws to :8787)
npm run worker:deploy   # production Worker
npx wrangler pages deploy dist --project-name birthday-hunt --branch main
npm run db:migrate         # local D1
npm run db:migrate:remote  # production D1
```

---

## What NOT to do (lessons logged in skill-observations/)

- Do not run `goto_url(...)` in browser-harness — it clobbers the user's
  active tab. Use `new_tab(url)` instead.
- Do not pass `/` as a literal arg from Git Bash to a Node process — msys
  rewrites it to `C:\Program Files\Git\`. Use env vars or `VITE_BASE_PATH=/`
  set explicitly in the CI workflow, not on the CLI from a local Bash.
- Do not edit shipped D1 migrations. Add a new `000N_*.sql`.
- Do not set `ACCESS_DEV_BYPASS=true` as a wrangler env var if you've also
  defined it under `[vars]` — they conflict. Either remove the var or set
  via `wrangler secret put`.
- Do not run `wrangler dev --config worker/wrangler.toml --var X:Y` and
  expect `[vars] X = ""` in the same toml — `--var` wins, but the binding
  collision rule means you can't have `X` declared in both.

---

## Skills directory shortcut

When the agent needs a skill it hasn't used in this session, the first stop
is the available-skills list in the system prompt. If a skill matches the
task description, invoke it via `Skill <name>`. Don't paraphrase what the
skill says; load it and follow it.
