# JSL Imports — Japan → Sri Lanka Vehicle Import Platform

Commercial SaaS for computing, quoting, and managing vehicle-import landed costs from Japan to
Sri Lanka. Config-driven, gazette-versioned, radically transparent.

**Build date:** 7 July 2026 · **Status:** Phases 1–5 complete (API + Auth shipped) · Calc Engine core (Phase 6) · Web frontend core (Phase 7)

---

## What exists right now

| Piece | Location | State |
|---|---|---|
| Research (taxes, regulations, logistics) with sources & confidence | `docs/research/` | ✅ complete, verification queue attached |
| System architecture + ADRs | `docs/architecture/` | ✅ |
| 10 config domains (never-hardcode layer) | `config/*.json` | ✅ seeded, admin-editable design |
| PostgreSQL schema (users/RBAC/orgs, vehicles, versioned rules, reproducible calculations, quotes, audit) | `prisma/schema.prisma` | ✅ v1 |
| **Calculation engine** — pure TS, shared FE/BE, full step trace | `packages/calc-engine/` | ✅ typed, golden-tested, browser entry (`/browser`) |
| **NestJS API** — versioned rules, auth/RBAC, authoritative calcs, quotations, fx | `apps/api/` | ✅ core (31-check e2e, golden parity over HTTP) |
| **React frontend** — cinematic landing + full calculator, in-browser engine | `apps/web/` | ✅ core (Vite · React 19 · TS · Tailwind v4) |

## Run the engine demo (60 seconds)

```bash
cd packages/calc-engine
npm install
npm run demo
```

Verified output (2022 Prius ZVW51, ¥2.3 M hammer, RoRo Yokohama→Colombo, LC opened 10 Jun 2026):

```
CIF LKR 5,437,790 · import taxes LKR 16,601,580 (305.3% of CIF)
LANDED LKR 22,203,621 · ON-ROAD LKR 22,232,221
WHAT-IF · LC opened 2026-05-10 (pre-cutoff): the May-2026 surcharge
window costs this buyer LKR 986,552.
```

Every line prints its formula, source badge (verified / reported / estimate), and the rule-set
version used — the console mirror of the UI's animated duty waterfall.

## Run the website (Phase 7 core)

```bash
npm --prefix apps/web install
npm run dev        # http://localhost:5173
npm run verify     # engine typecheck + golden tests, web typecheck + SSR smoke + prod build
```

What shipped: cinematic landing (live engine in the hero, LC what-if toggle, full animated
duty-waterfall ledger, 2026-rules cards rendered from the versioned config, FAQ) and the
calculator (six market presets, every override the engine supports, eligibility blocking,
LC-date savings strip, warnings appendix, print-ready paper quote, copy-JSON). Dark/light
themes, keyboard + screen-reader pass, `prefers-reduced-motion` respected throughout,
route-level code-splitting, security headers + hashed-inline CSP in every deploy target
(`vercel.json`, `netlify.toml`, `Dockerfile` + `docker/nginx.conf`). CI: `.github/workflows/ci.yml`.

**Deliberate deviation from the Phase 7 blueprint:** the React-Three-Fiber floating-vehicle
hero is deferred. With no production 3D vehicle asset, a placeholder mesh would cheapen the
brand, and three.js costs ~150 kB gz against the Lighthouse ≥95 / <2 s budget. In its place
the hero runs the *actual engine live* — a real quote with an LC what-if toggle — which is
truer to "transparency is the brand". The R3F slot remains: mount a lazy `<VehicleStage>` in
`HeroQuoteCard` behind the existing reduced-motion/capability gates when an asset exists.

## The tax stack encoded (as of 3 Jul 2026)

CIF → CID 20% → standing surcharge 50%-of-CID → **temporary surcharge 50% (16 May–~15 Aug 2026,
LC-date conditional)** → Excise (per-cc/kW/unit/ad-valorem, higher-of, age-banded) → Luxury Tax
(5.0/5.5/6.0 M thresholds by propulsion) → SSCL 2.5% → VAT 18% (10% CIF uplift). PAL/Cess exempt
on sampled lines. Full provenance in `docs/research/01-tax-structure.md`; disputed points and the
launch-gating verification queue in `03-open-questions.md`.

> ⚠️ **Excise band matrix contains flagged placeholders** pending verbatim transcription of
> Gazettes 2421/42 + 2434/04 (open question Q1). The engine warns on every result that touches one.
> This product ships honesty by design: results are *estimates with receipts*, never oracle claims.

## Architecture in one paragraph

pnpm monorepo. `@jsl/calc-engine` is pure and dependency-free: the browser runs it for instant
previews, the API re-runs it authoritatively and persists the snapshot **with the RuleSetVersion
ids used**, making every historical quote byte-reproducible after gazette changes. Rules live in
Postgres (`RuleSetVersion`, JSONB, draft→diff→publish workflow in the Admin Panel); `/config/*.json`
are only the v1 seeds. Roles: SUPER_ADMIN / ADMIN / DEALER / IMPORTER / VIEWER. Full ADRs in
`docs/architecture/system-architecture.md`.

## Run the API (Phases 4–5 core)

```bash
# one-time: local Postgres matching .env.example (or: docker compose up postgres -d)
npm --prefix apps/api install
npm run db:migrate            # applies prisma/migrations
npm run api:seed              # 10 rule versions, ports, org+admin, JDM catalog
npm run api:dev               # http://localhost:3000 · Swagger at /docs
npm run api:e2e               # boots the server on :3100, 31 end-to-end checks
```

What shipped: URI-versioned `/v1` NestJS API with the full Phase-4 module blueprint —
`rules` (ADR-002 in code: assemble ACTIVE `RuleSetVersion` rows → engine `buildRuleSet`,
draft → engine-validate → atomic publish/retire, path-level diff, `GET /v1/rules/active` is the
exact payload the web seam consumes), `calculations` (authoritative engine run persisting the
full step trace **plus all ten rule-version ids**, revisions, pinning, org scoping),
`quotations` + `customers` (JSL-Q-YYYY-###### references, guarded status lifecycle),
`fx` (rate ingest appends `ExchangeRate` history **and** auto-publishes a fresh
`EXCHANGE_RATES` version — provenance survives every rate change), `vehicles` catalog,
`users` approval workflow, `notifications`, `audit`, `health`. Auth (Phase 5): Argon2id,
15-min access JWTs, rotating refresh sessions in an httpOnly cookie with **reuse-detection
family revoke**, email-verify → admin-approve activation, password reset, throttled public
endpoints, `SUPER_ADMIN>ADMIN>DEALER>IMPORTER>VIEWER` guard lattice. The e2e suite proves the
golden Prius figures byte-identical through HTTP + DB-assembled rules (ADR-001's guarantee,
end to end), including the LC what-if delta of LKR 986,552.

## Phase tracker

1. ✅ Research  2. ✅ Architecture  3. ✅ Database  4. ✅ Backend (core)  5. ✅ Auth
6. ✅ Calc Engine (core)  7. ✅ Frontend (core)  8. ⏭ Admin Panel  9. ◐ Reporting (print quote shipped)
10. ◐ Testing (engine golden + web smoke + API e2e)  11. ◐ Deployment (compose: postgres+api+web)  12. ◐ Documentation

**▶ NEXT:** Phase 8 — Admin Panel UI over the shipped rules endpoints (versions list → diff →
publish), users approval queue, and fx dashboard; then point `apps/web/src/lib/rules.ts` at
`GET /v1/rules/active` (the seam was built for exactly this — call-sites unchanged), and
Phase 9 PDF/CSV quotation exports.

## Legal & accuracy posture

Rates and regulations change by gazette without notice. This software presents **estimates** with
dated rule-set provenance and explicit confidence badges; it is not customs brokerage, legal, or
tax advice. Verify with a licensed Customs House Agent and Sri Lanka Customs before financial
commitment.
