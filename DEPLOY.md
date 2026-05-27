# Deploy

Multiplayer backend deploys to **Cloudflare Pages** (frontend) + **Cloudflare
Workers** (API + Durable Objects, same-origin so no CORS). Solo-mode-only
fallback ships to **GitHub Pages** via the manually-triggered workflow at
`.github/workflows/deploy.yml`.

## One-time setup (admin action required)

These steps require Cloudflare dashboard access and can't be automated. Run
them once before the first deploy.

### 1. Cloudflare account + Wrangler login

```bash
npx wrangler login
```

### 2. Create the D1 database

```bash
npx wrangler d1 create birthday-hunt-db
```

Copy the `database_id` from the output and paste it into
`worker/wrangler.toml` (replace the placeholder UUID).

### 3. Apply migrations to the remote D1

```bash
npm run db:migrate:remote
```

### 4. Create the Pages project

In the dashboard:
- **Workers & Pages → Create → Pages → Connect to Git**
- Pick the `p4panash/birthday-hunt` repo
- Build command: `npm run build`
- Build output: `dist`
- Environment variable: `VITE_BASE_PATH=/`
- Node version: `20`

Or via CLI:

```bash
npx wrangler pages project create birthday-hunt --production-branch main
```

### 5. Bind the Worker to the same domain as Pages

The simplest path: deploy the Worker with a route that matches the Pages
domain. In the dashboard:
- Open the Worker `birthday-hunt`
- **Triggers → Routes → Add route**
- Pattern: `birthday-hunt.pages.dev/api/*` (or the custom domain you set on
  Pages)
- Zone: leave blank for `*.pages.dev`

This pattern: Pages serves the SPA at `/`, Worker handles `/api/*` on the same
origin. No CORS needed.

### 6. Configure Cloudflare Access for `/admin/*`

In the **Zero Trust** dashboard:
- **Access → Applications → Add an application → Self-hosted**
- Application name: `birthday-hunt admin`
- Subdomain: your Pages domain
- Path: `/admin`
- Identity providers: enable email OTP (or whichever)
- Policies: `Allow` for the admin's email(s)

Then grab the **Application Audience (AUD) tag** from the application detail
page and set it on the Worker:

```bash
npx wrangler secret put ACCESS_AUD --config worker/wrangler.toml
# paste the AUD tag
```

Also set the team domain (everything before `.cloudflareaccess.com`):

```bash
npx wrangler secret put ACCESS_TEAM_DOMAIN --config worker/wrangler.toml
# e.g. "my-team"
```

### 7. First deploy

```bash
npm run worker:deploy
git push origin main      # triggers the Pages build
```

## Local development

Two processes, two terminals:

```bash
# terminal 1 — backend
npm run worker:dev      # wrangler dev on :8787

# terminal 2 — frontend
npm run dev             # vite dev on :5173 (proxies /api/* and ws to :8787)
```

`.dev.vars` (gitignored) overrides Worker env locally. Copy `.dev.vars.example`
and keep `ACCESS_DEV_BYPASS=true` for dev so admin routes don't require a real
JWT.

## Rollback to solo-mode-only

If the multiplayer pivot needs to be reverted:

1. From GitHub Actions, manually trigger **Deploy to GitHub Pages** workflow.
2. Disable the Pages project in Cloudflare dashboard (or leave it — it
   harmlessly serves the static SPA; the Worker route is what enables team
   mode).
3. Solo mode keeps working because it has no backend dependencies.

## Notes

- `_routes.json` is intentionally absent. We use a Worker route binding, not
  Pages Functions, so Pages serves everything that isn't matched by the
  Worker route.
- The Worker's `wrangler.toml` keeps a placeholder `database_id`. The real
  ID lives in the dashboard / your local copy — never commit the real UUID
  to a public repo (it's not a secret but conventionally treated as one).
