# Changelog

## 0.3.0 — 7 July 2026 · Phases 4–5 core (NestJS API + Auth)

### Audit findings on the incoming tree (and their resolutions)

1. **The intake brief's "missing files" list was almost entirely false alarms** — root
   `package.json`, `apps/web/vite.config.ts`, `main.tsx`, `App.tsx`, Tailwind config etc. all
   exist and verify green (`npm run verify`: engine golden tests, web typecheck + SSR smoke +
   production build). The audit report (`docs/audit/2026-07-07-phase4-intake-audit.md`) lists
   every claimed-missing file with its actual state. **Nothing was regenerated or redesigned.**
2. **The genuinely missing piece was exactly what the README declared next**: `apps/api`
   (Phases 4–5), plus migrations/seed, compose db+api services, and the API CI job. → Shipped
   below, following the Phase-4 module blueprint in `docs/architecture/system-architecture.md`
   to the letter (module list, Argon2id, signed httpOnly refresh cookies, per-org row scoping,
   guard lattice).
3. **`@jsl/calc-engine` was source-only ESM** (`main: src/index.ts`) — fine for Vite's
   bundler resolution, unloadable from Node CJS. → Added a dual build (`dist/esm` + `dist/cjs`
   + `dist/types`, `exports` conditions). The web app's alias to `src/browser.ts` is untouched;
   engine sources untouched; golden tests untouched and green.

### Added — `apps/api` (NestJS 11 · Prisma 7 · PostgreSQL)

- **Modules** (all live, all e2e-covered): `rules` — ACTIVE `RuleSetVersion` rows assembled
  through the engine's own `buildRuleSet` (candidate-merge validation on draft, atomic
  publish/retire, path-level diff, public `GET /v1/rules/active` in the exact shape the web
  seam consumes); `calculations` — authoritative engine runs persisting inputs, the full step
  trace, and **all ten rule-version ids** (revise chains, pinning, org scoping);
  `quotations` + `customers` — `JSL-Q-YYYY-######` references (unique-collision retry),
  totals from persisted calcs + markup, guarded DRAFT→SENT→ACCEPTED/EXPIRED/CANCELLED;
  `fx` — ingest appends `ExchangeRate` history **and auto-publishes a fresh
  EXCHANGE_RATES version** (millisecond-stamped) so provenance survives every rate change;
  `vehicles`, `users` (approve/suspend/role), `notifications`, `audit` (fire-and-forget),
  `health`.
- **Auth (Phase 5)**: Argon2id (`ARGON2_MEMORY_KIB`), 15-min access JWTs, rotating refresh
  sessions (sha256-hashed, httpOnly `jsl_rt` cookie scoped to `/v1/auth`) with
  **reuse-detection family revoke**, register → email-verify → admin-approve → ACTIVE
  lifecycle with specific 403s, password reset revoking all sessions, login/register/reset
  throttled, account-enumeration-safe 202s.
- **Platform**: URI versioning (`/v1`), helmet + compression + CORS(credentials),
  global ValidationPipe(whitelist), uniform error envelope (engine `[rules:…]` failures →
  422 verbatim), Swagger at `/docs` outside production, `createApp()` factory.
- **Verification**: `apps/api/test/e2e.ts` — 31 checks incl. **golden Prius parity over
  HTTP + DB-assembled rules** (CIF 5,437,790 · landed 22,203,621 · on-road 22,232,221 ·
  LC what-if delta 986,552), RBAC negatives, refresh-reuse revoke, fx shift→restore, and
  validation errors. Deterministic across reruns (canonical-fx restore in setup/cleanup).
- **Ops**: `prisma/migrations/20260707000000_init` (hand-authored, see below) + seed
  (10 rule versions from `/config`, 9 ports, `jsl` org + SUPER_ADMIN, real-spec JDM catalog
  incl. the golden ZVW51); `docker/api.Dockerfile` (multistage, migrate-on-start);
  `docker-compose.yml` now postgres + api + web with health-gated startup; CI `api` job
  (Postgres service → generate → migrate deploy → **drift gate** → seed → typecheck →
  build → e2e); root `verify:full`.

### Changed — Prisma 7 migration (schema **models untouched**)

- Generator: `prisma-client-js` → `prisma-client` (Rust-free client, `pg` driver adapter,
  output `apps/api/src/generated/prisma`, CJS). Prisma 7 removed the datasource `url` from
  the schema — connection now lives in `prisma.config.ts` (checked in, reads `.env`).
- `prisma migrate dev` requires the schema-engine binary, which this build environment
  cannot download; the init migration was therefore **hand-authored in Prisma's exact SQL
  conventions** and applies cleanly. The CI drift gate (`prisma migrate diff --exit-code`,
  runs where the network is open) proves migrations ≡ schema on every push, so any
  hand-authoring slip fails the build, not production.

### Known limitations (honest scope)

- Phase 8 Admin Panel UI, Phase 9 PDF/CSV exports, and pointing the web's rules seam at
  `GET /v1/rules/active` are the next milestones (see README "▶ NEXT").
- Mail uses a console/dev-outbox transport unless `SMTP_HOST` is set.

## 0.2.0 — 6 July 2026 · Phase 7 core (web frontend) + engine hardening

### Audit findings on the incoming tree (and their resolutions)

1. **Engine unusable in the browser** — `index.ts` re-exported the `node:fs` loader, so any
   web bundle importing the engine dragged in Node built-ins. → Split pure validation into
   `src/validate.ts` (`buildRuleSet(payloads)`, no I/O), added `src/browser.ts` entry and a
   package `exports` map (`.` and `./browser`). `rules.ts` is now a thin Node-only delegate.
2. **No regression protection on the money math** — the verified Prius figures existed only
   in the README. → `tests/golden.ts` (`npm test`) locks CIF / taxes / landed / on-road /
   what-if delta, proves fs-loader ≡ `buildRuleSet` parity (the ADR-001 guarantee), and
   asserts age-limit blocking.
3. **Fragile band lookup** in `steps/local.ts` revenue-licence resolution (mixed `==`/`===`
   against possibly-`undefined` caps; worked only by accident on current data). → Rewritten
   to a single open-ended-cap rule.
4. **Duplicate loose files at the archive root** (README, schema, tax docs shipped twice).
   → Consolidated; the repository root is the single source of truth.
5. **No frontend existed** (Phase 7 pending) — the largest gap. → Shipped below.

### Added — `apps/web` (Vite 6 · React 19 · TypeScript strict · Tailwind v4 · framer-motion)

- **Landing**: hero that runs the real engine live (2022 Prius ZVW51) with an LC-date
  what-if toggle and cost-composition bar; full animated duty-waterfall ledger (the
  signature element — badge · label · mono formula · running-total rail); journey stages;
  2026-rules cards rendered from the versioned config (surcharge window, per-class age
  limits, luxury thresholds); transparency principles; FAQ; CTA. Ambient starfield and
  Yokohama→Colombo route arc, both `prefers-reduced-motion`-aware.
- **Calculator**: six market presets + custom; every engine override exposed (Japan-side
  fees, freight, assessed customs value, clearance fees, registration options); live
  ledger; eligibility blocking with the regulation cited; LC savings strip; warnings &
  assumptions appendix; copy-JSON; **print-ready paper quote** (forced-light print theme
  with provenance header/footer).
- **Design system**: deep-space-navy/glass/single-indigo tokens with a first-class light
  theme; Bricolage Grotesque display · Inter body · IBM Plex Mono figures; confidence
  colors as semantic tokens.
- **Quality floor**: skip link, labelled controls, `aria-live` totals, visible focus,
  keyboard-native disclosures, reduced-motion damping, route-level code-splitting
  (~134 kB gz JS initial), self-hosted fonts.
- **SEO**: canonical/OG/Twitter meta, generated `og.png`, JSON-LD (SoftwareApplication +
  FAQPage), `robots.txt`, `sitemap.xml`, web manifest, SVG favicon.
- **Verification**: `scripts/smoke.tsx` SSR-renders all routes in Node and asserts the
  golden figure and key landmarks (`npm run smoke`).

### Added — delivery & operations (Phase 11 slice)

- `vercel.json`, `netlify.toml`, `Dockerfile` + `docker/nginx.conf`, `docker-compose.yml`:
  SPA fallback, immutable asset caching, gzip, and a hardened header set everywhere —
  CSP (inline theme script allow-listed by SHA-256 hash), HSTS, nosniff, Referrer-Policy,
  Permissions-Policy, COOP, `frame-ancestors 'none'`.
- `.github/workflows/ci.yml`: engine typecheck + golden tests, web typecheck + smoke +
  build, artifact upload. `.nvmrc` (22), root `npm run verify` orchestration,
  `DEPLOYMENT.md`.

### Deviation (documented)

- R3F floating-vehicle hero deferred pending a production 3D asset; the live-engine hero
  card holds its slot. Rationale and re-entry point in `README.md`.
