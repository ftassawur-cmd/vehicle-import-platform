# Intake Audit — Phase 4 handoff · 7 July 2026

Scope: full audit of the uploaded `jsl-imports-pro323` tree against the intake brief's
claims, before any code was written. Method: every claim checked by **running the project**,
not by reading it. Nothing was regenerated, renamed, or redesigned.

## 1 · Claimed-missing files vs. reality

The intake brief asserted a broken/incomplete tree. Verification results:

| Brief claimed missing | Actual state |
|---|---|
| root `package.json` | ✅ exists — orchestration scripts, `engines.node >= 22` |
| `apps/web/package.json`, `vite.config.ts` | ✅ exist — Vite 6, aliases `@config` + `@jsl/calc-engine/browser` |
| `apps/web/src/main.tsx`, `App.tsx`, router | ✅ exist — route-level code splitting |
| Tailwind config / CSS pipeline | ✅ exists — Tailwind v4 via `@tailwindcss/vite`, tokens in `src/index.css` |
| tsconfig(s) | ✅ exist — strict, `noUncheckedIndexedAccess` |
| Engine entry/exports | ✅ exist — `.` + `./browser` conditions |
| CI workflow | ✅ exists — engine + web job |
| Deploy configs | ✅ exist — `vercel.json`, `netlify.toml`, `Dockerfile` + nginx, CSP headers |

Evidence (all commands run on the untouched tree):

- `packages/calc-engine`: `npm ci && npm run typecheck && npm test` → **11/11 golden +
  parity + eligibility checks pass** (CIF 5,437,790 · landed 22,203,621 · on-road
  22,232,221 · LC delta 986,552).
- `apps/web`: `npm ci && npm run typecheck && npm run smoke && npm run build` → green;
  SSR smoke asserts the golden figures; initial bundle ≈ 83 kB gz.

**Conclusion: the brief's damage report was ~90 % false alarms.** The tree was a healthy
Phases 1–3 + 6 + 7 build.

## 2 · Genuinely missing (and now shipped)

Exactly what `README.md` §"Phase tracker" declared next:

1. `apps/api` — Phases 4 (backend) + 5 (auth). **Shipped**: 12 modules, 40+ endpoints,
   31-check e2e including golden parity over HTTP. See CHANGELOG 0.3.0.
2. `prisma/migrations` + seed + runtime config wiring. **Shipped** (hand-authored init
   migration + CI drift gate; engine-validated seed).
3. `docker-compose.yml` db+api services + `docker/api.Dockerfile`. **Shipped.**
4. CI `api` job. **Shipped.**

## 3 · Environment constraints encountered (and how they were neutralised)

| Constraint | Resolution | Residual risk |
|---|---|---|
| Prisma engine binaries (`binaries.prisma.sh`) unreachable from the build sandbox | Adopted Prisma 7's Rust-free client (`prisma-client` generator + `pg` adapter) — generation is WASM, runtime needs no binaries | None — this is Prisma's forward path |
| `prisma migrate dev` needs the schema-engine binary | Init migration hand-authored in Prisma's exact SQL conventions; applied cleanly; **CI drift gate** (`prisma migrate diff --exit-code`) re-proves migrations ≡ schema wherever the network is open | Drift gate catches any slip on first push |
| Prisma 7 removed datasource `url` from schema | `prisma.config.ts` (checked in) carries it; all CLI scripts pass `--config` explicitly | None |
| No SMTP in dev/CI | Mail service logs action links (dev outbox) unless `SMTP_HOST` set | None — flows stay exercisable |

## 4 · Deviations from the architecture doc

Only one, additive: `@jsl/calc-engine` gained a **dual dist build** (`esm`/`cjs`/`types` +
`exports` conditions) because Node CJS cannot load the source-only ESM package the web
bundler consumes. Engine sources, tests, and the web alias are byte-identical to intake.

## 5 · Post-build verification matrix (7 Jul 2026)

| Surface | Command | Result |
|---|---|---|
| Engine | `npm test` | 11/11 ✓ (untouched) |
| Web | `npm run verify` | typecheck + smoke + build ✓ (untouched) |
| API types | `npm run api:typecheck` | 0 errors |
| API build | `npm run api:build` | dist boots, serves `/v1/health` + 10 rule domains |
| API e2e | `npm run api:e2e` | **31/31 ✓**, deterministic across reruns |
| Migration | `psql` apply + seed | 21 tables, 10 ACTIVE rule versions |
