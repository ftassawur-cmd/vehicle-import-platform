# System Architecture — JSL Vehicle Import Platform

**Phase 2 deliverable · v1.0 · 3 July 2026**

## 1. Shape of the system

pnpm monorepo. One deviation from the brief's flat layout, made deliberately: the calculation engine
is a **standalone, dependency-free TypeScript package** consumed by both the API and the web app.

```
vehicle-import-platform/
├─ packages/
│  └─ calc-engine/          Pure functions. No I/O, no framework, no deps.
├─ apps/
│  ├─ api/                  NestJS + Prisma + PostgreSQL (Phases 4–5)
│  └─ web/                  React + Vite + TS + Tailwind + R3F (Phase 7)
├─ config/                  Seed rule-sets (JSON) → imported into DB as v1
├─ prisma/                  Schema, migrations, seeds (Phase 3)
└─ docs/                    Research, architecture, ADRs
```

### ADR-001 — Shared pure engine
*Decision:* all tax math lives in `packages/calc-engine`; the browser runs it for **instant
"Smart Suggestions" previews** (<1 ms, no network), the server re-runs the identical code as the
**authoritative** calculation persisted with the result. *Consequence:* previews and saved quotes
can never drift; the engine is trivially unit-testable; regulators' formulas are one importable
artifact.

### ADR-002 — Rule-sets are versioned data, never code
*Decision:* `/config/*.json` are only the **v1 seeds**. At runtime, rules live in the
`RuleSetVersion` table (one row per domain per version, JSONB payload, `effectiveFrom`,
`publishedBy`, `changeNote`, `sourceGazette`). The Admin Panel edits a draft, diffs it against the
active version, and publishes — zero deploys. *Consequence:* every `Calculation` row stores its
`ruleSetVersionId`s, so any historical quote is **byte-reproducible** even after a gazette change.
This is the platform's core enterprise differentiator.

### ADR-003 — Confidence is a first-class field
Every rule value carries `confidence: verified | reported | estimate` and a `sourceRef`. The engine
propagates the *minimum* confidence touched into each step's output; the UI renders amber badges and
the PDF quote prints an assumptions appendix. Honesty is a feature, not a disclaimer.

### ADR-004 — Money & rounding policy
LKR amounts are computed in floating point but **rounded to whole rupees at each statutory duty
line** (Customs practice), with the rounding mode declared in config (`rounding.duties = "rupee"`).
JPY has no minor unit. FX conversions happen once per input line at a dated rate; the rate id is
recorded in the step trace.

### ADR-005 — Temporal rules
Surcharges and rates carry `{effectiveFrom, effectiveTo, conditions}`. The engine evaluates against
`asOfDate` + facts (e.g. `lcOpenedDate`), so "what would this cost if my LC opens after Aug 15?"
is a one-parameter what-if — powering the Comparison module.

## 2. Module map → phases

| Module | Home | Phase |
|---|---|---|
| Calculation engine (FOB→CIF→duties→on-road, step trace) | packages/calc-engine | **6 (pulled forward — done in core)** |
| DB schema: users/orgs/RBAC, vehicles, rules, calculations, quotes, audit | prisma/ | **3 (done)** |
| REST API: auth (JWT+refresh, RBAC guards), rules service, calc service, vehicles, quotes, exports | apps/api | 4–5 |
| Frontend: 5-step flow, vehicle showcase (R3F), dashboards, history/favorites/compare | apps/web | 7 |
| Admin Panel: rule editor + diff + publish, verification queue, users/roles, branding, logs | apps/web/admin | 8 |
| Reporting: PDF/CSV/JSON export, quotation builder, profit calculator | api + web | 9 |
| Testing (engine golden files, API e2e, Playwright), CI | tests/ | 10 |
| Docker compose (pg + api + web), deploy docs | docker/ | 11–12 |

## 3. Backend (Phase 4 blueprint)

NestJS modules: `auth`, `users`, `orgs`, `rules` (RuleSetVersion CRUD + publish workflow + cache),
`vehicles` (makes/models/variants + image asset abstraction ready for future auction/VIN APIs),
`fx` (rate ingestion job + staleness alerts), `calculations` (runs engine against active rule-set,
persists snapshot), `quotations`, `exports` (PDF via headless renderer, CSV/JSON), `audit`
(interceptor-driven), `notifications`. Cross-cutting: class-validator DTOs mirrored from engine Zod
schemas, rate limiting, helmet, CSRF for cookie flows, Argon2id hashing, signed httpOnly refresh
cookies, per-org row scoping.

## 4. Frontend & design system (Phase 7 blueprint)

Direction locked by the approved mockup: deep-space navy surfaces, glass panels, a single indigo
accent, cinematic vehicle hero (React-Three-Fiber floating vehicle on a light-ring pedestal,
parallax layers, particle field), Inter/display pairing to be finalized against the
frontend-design skill's two-pass token process at Phase 7 kickoff. Signature element: the
**live duty waterfall** — every intermediate figure animates into place as inputs change, because
transparency *is* the brand. Performance budget: <2 s initial load, Lighthouse ≥95, route-level
code-splitting, R3F lazy-mounted behind `prefers-reduced-motion` and capability checks.

## 5. Security & compliance posture

OWASP ASVS-aligned: parameterized access via Prisma, output encoding, strict CSP, secrets via env,
audit trail on every rule publish and every quote issued, role matrix
(SUPER_ADMIN > ADMIN > DEALER > IMPORTER > VIEWER) enforced in guards *and* row filters. Legal
posture: the product presents **estimates** with dated rule-set provenance; wording reviewed in
Phase 9 templates.
