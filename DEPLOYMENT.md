# Deployment — JSL Imports (Phase 11)

Two deployables: the static **web** SPA (`apps/web`) and the **API** (`apps/api`, NestJS +
Postgres). The web section is first; the API section follows.

---

# Web (frontend slice)

`apps/web` builds to a fully static SPA (`apps/web/dist`). The engine and the ten `/config`
seeds are compiled into the bundle — no server, database, or environment variables are
required for this slice. When the NestJS API lands (Phase 4), the same hosts gain a
`/api` proxy and the browser switches from bundled seeds to published RuleSetVersions.

## Prerequisites

Node 22 (`.nvmrc`). Local check before any deploy:

```bash
npm run verify        # engine typecheck+golden tests, web typecheck+SSR smoke+build
```

## Vercel

`vercel.json` at the repo root does everything: install/build commands scoped to
`apps/web`, output `apps/web/dist`, SPA rewrite, immutable caching for `/assets`, and the
full security-header set (CSP with the hashed inline theme script, HSTS, etc.).

```bash
vercel --prod
```

## Netlify

`netlify.toml` mirrors the same setup (Node 22 pinned, SPA redirect, headers).

```bash
netlify deploy --prod
```

## Docker (any VPS / Railway / Fly / Render-as-container)

Multi-stage build: Node 22 compiles, nginx 1.27 serves with gzip, SPA fallback,
`/healthz`, and the same hardened headers baked into `docker/nginx.conf`.

```bash
docker compose up --build -d     # → http://localhost:8080
```

## Cloudflare Pages / Render static

- Build command: `npm --prefix apps/web ci && npm --prefix apps/web run build`
- Output directory: `apps/web/dist`
- SPA fallback: enable "single-page app" mode (or a `/* → /index.html 200` rule)
- Copy the header set from `netlify.toml`

## Notes that bite people

- **SPA routing**: `/calculator` must fall back to `index.html` — all configs above do this.
- **CSP hash**: the one inline `<script>` (no-flash theme) is allow-listed by hash
  `sha256-OcIf4wwP4hC5RlSiatkzKgtlucNPLPbBYRfZrAZ5xMY=`. If you edit that script in
  `apps/web/index.html`, recompute:
  `python3 - <<'P'\nimport re,hashlib,base64;s=re.search(r'<script>(.*?)</script>',open('apps/web/index.html').read(),16).group(1);print(base64.b64encode(hashlib.sha256(s.encode()).digest()).decode())\nP`
  and update `vercel.json`, `netlify.toml`, `docker/nginx.conf`.
- **Domain**: canonical/OG URLs and `robots.txt`/`sitemap.xml` reference
  `https://jslimports.lk` — search-replace when the real domain is chosen.
- **Rule updates before the Admin Panel exists**: edit `/config/*.json`, bump each
  `_meta.version`, run `npm run verify` (golden test guards the math), redeploy.


---

# API (`apps/api` · NestJS · PostgreSQL)

## What it needs

- **Node 22**, a reachable **PostgreSQL 14+** instance, and these env vars (see
  `.env.example`): `DATABASE_URL`, `APP_URL` (browser origin, for CORS), `PORT` (default
  3000), `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (32+ random chars each — **the server
  refuses to boot in production without them**), optional `ARGON2_MEMORY_KIB`,
  `THROTTLE_TTL_MS` / `THROTTLE_LIMIT`, `SMTP_*`, `FX_STALE_AFTER_HOURS`, and the one-off
  `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Compose (Postgres + API + web, one command)

`docker-compose.yml` runs all three with health-gated ordering (web waits for the API's
`/v1/health` to report `"db":"ok"`, which waits for Postgres `pg_isready`):

```bash
export JWT_ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")
export JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")

docker compose up --build -d          # api → http://localhost:3000/v1 , web → http://localhost:8080
docker compose exec api npm run db:seed   # one-off: rule versions, ports, admin, catalog
```

The API image (`docker/api.Dockerfile`, multistage `node:22-alpine`) runs
`prisma migrate deploy` on start, so a fresh database is schema-ready before it serves.
Seeding is deliberately a separate one-off (never auto-run against a database that may
already hold real data).

## Manual / PaaS (Railway, Fly, Render-as-service)

```bash
npm --prefix packages/calc-engine ci && npm --prefix packages/calc-engine run build
npm --prefix apps/api ci
npm --prefix apps/api run prisma:generate
npm --prefix apps/api run db:migrate:deploy     # apply committed migrations
npm --prefix apps/api run db:seed               # first deploy only
npm --prefix apps/api run build
node apps/api/dist/main.js                       # or: npm run api:build then run dist
```

Point the platform's release/pre-deploy step at `db:migrate:deploy` and its start command at
`node apps/api/dist/main.js`. The engine must be built first — the API depends on
`@jsl/calc-engine` via `file:../../packages/calc-engine`, so the monorepo layout must be
preserved on the host (the Dockerfile already does this).

## Health & observability

- `GET /v1/health` — liveness + `SELECT 1` DB probe (`{status, db, uptimeSec, timestamp}`).
  Point your load balancer / K8s `livenessProbe` + `readinessProbe` here; the container
  `HEALTHCHECK` already greps it.
- `GET /docs` — Swagger UI, served only when `NODE_ENV !== production`.
- Every state-changing action writes an `AuditLog` row (`action`, `entity`, `entityId`,
  `metadata`, `ip`).

## Migrations posture

Migrations live in `prisma/migrations` and are applied with `prisma migrate deploy` (never
`migrate dev` in any shared environment). CI runs a **drift gate**
(`prisma migrate diff --exit-code`) that fails the build if the committed migrations stop
matching `schema.prisma`, so production never diverges from the checked-in SQL. After editing
the schema, generate a new migration locally (`prisma migrate dev` where the schema-engine is
available) and commit it — do not hand-edit applied migrations.

## Things that bite people

- **Secrets**: dev falls back to built-in JWT secrets with a loud warning; production
  fast-fails without real ones. Set them.
- **CORS**: `APP_URL` must be the exact browser origin (scheme + host + port) or the refresh
  cookie won't be sent — it's `SameSite=Lax`, httpOnly, path `/v1/auth`.
- **`trust proxy`**: enabled for correct client IPs behind nginx/compose; keep the API behind
  a proxy that sets `X-Forwarded-For`.
- **Change the seeded admin password** (`SEED_ADMIN_PASSWORD`) before any real deployment; the
  default is intentionally noisy in the seed log.
