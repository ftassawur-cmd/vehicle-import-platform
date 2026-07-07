/**
 * End-to-end suite for the JSL Imports API (Phase 4/5 acceptance).
 *
 * Spawns the real server (ts-node transpile-only, PORT 3100) against the dev
 * database, then walks the whole product surface:
 *
 *   · health / DB reachability
 *   · admin login → Bearer + httpOnly refresh cookie
 *   · GET /v1/rules/active — all 10 domains on the seeded 2026.07.03-r1
 *   · golden Prius calculation — API totals byte-identical to the engine
 *     (the ADR-001 parity guarantee, now across HTTP + DB-assembled rules)
 *   · rule-version provenance on the persisted row (10 version ids)
 *   · LC what-if via /revise — surcharge window delta 986,552
 *   · quotations: customer → quote (JSL-Q-YYYY-######) → DRAFT→SENT,
 *     illegal transition rejected
 *   · RBAC negatives: VIEWER blocked from publish + calc create
 *   · refresh rotation, reuse-detection family revoke, logout
 *   · fx ingest → auto-published EXCHANGE_RATES version → totals shift,
 *     then restore → golden again
 *   · validation negatives: bad CalcInputs 400 with paths, broken rule
 *     payload 422 with the engine's [rules:…] message
 *
 * Run:  npm --prefix apps/api run e2e
 */
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import assert from "node:assert/strict";
import * as argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { AccountStatus, ConfigDomain, PrismaClient, Role, RuleSetStatus } from "../src/generated/prisma/client";
import { env } from "../src/config/env";

const PORT = 3100;
const BASE = `http://127.0.0.1:${PORT}/v1`;
const RUN = Date.now().toString(36);
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.databaseUrl }) });

/* ── tiny harness ──────────────────────────────────────────────────── */

let passed = 0;
let failed = 0;
function check(label: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${label}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${label}\n      ${(e as Error).message}`);
  }
}

interface Res {
  status: number;
  body: any;
  setCookie: string[];
}
async function req(
  method: string,
  path: string,
  opts: { token?: string; cookie?: string; body?: unknown } = {},
): Promise<Res> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.cookie) headers.Cookie = opts.cookie;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, setCookie: res.headers.getSetCookie?.() ?? [] };
}

const refreshCookieOf = (r: Res): string | undefined => {
  const raw = r.setCookie.find((c) => c.startsWith("jsl_rt="));
  return raw?.split(";")[0];
};

/* ── golden fixture (verbatim from packages/calc-engine/tests/golden.ts) ── */

const GOLDEN_INPUTS = {
  vehicle: {
    makeName: "Toyota", modelName: "Prius", variantCode: "ZVW51", year: 2022,
    fuelType: "petrolHybrid", vehicleClass: "car", bodyClass: "car",
    engineCc: 1797, manufactureDate: "2023-09-15", firstRegistrationDate: "2023-10-20",
  },
  japan: { hammerPrice: { amount: 2_300_000, currency: "JPY" } },
  shipping: { method: "roro", originPortCode: "JPYOK", blDate: "2026-07-20" },
  facts: { asOfDate: "2026-07-03", lcOpenedDate: "2026-06-10" },
  local: { includeRegistration: true },
};
const GOLDEN = {
  cifLkr: 5_437_790,
  importTaxesLkr: 16_601_580,
  landedAtPortLkr: 22_203_621,
  onRoadLkr: 22_232_221,
  surchargeWindowCostLkr: 986_552,
};

/* ── server lifecycle ──────────────────────────────────────────────── */

async function startServer(): Promise<ChildProcess> {
  const child = spawn(
    process.execPath,
    ["-r", "ts-node/register/transpile-only", join(__dirname, "../src/main.ts")],
    {
      env: { ...process.env, PORT: String(PORT) },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let log = "";
  child.stdout?.on("data", (d) => (log += String(d)));
  child.stderr?.on("data", (d) => (log += String(d)));

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return child;
    } catch {
      /* not up yet */
    }
    if (child.exitCode !== null) break;
  }
  child.kill("SIGKILL");
  throw new Error(`API failed to start on :${PORT}\n${log.slice(-2000)}`);
}

/* ── fixtures via DB (roles the HTTP surface can't self-provision) ── */

async function createViewer(): Promise<{ email: string; password: string }> {
  const email = `e2e+viewer-${RUN}@jslimports.lk`;
  const password = "Viewer12345";
  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: "jsl" } });
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }),
      fullName: "E2E Viewer",
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      memberships: { create: { orgId: org.id, role: Role.VIEWER } },
    },
  });
  return { email: user.email, password };
}

/** Reruns against a dev DB must start canonical: seed fx back ACTIVE, e2e fx artifacts gone. */
async function restoreSeedFx(): Promise<void> {
  await prisma.ruleSetVersion.updateMany({
    where: { domain: ConfigDomain.EXCHANGE_RATES, status: RuleSetStatus.ACTIVE, NOT: { version: "2026.07.03-r1" } },
    data: { status: RuleSetStatus.RETIRED, effectiveTo: new Date() },
  });
  await prisma.ruleSetVersion.update({
    where: { domain_version: { domain: ConfigDomain.EXCHANGE_RATES, version: "2026.07.03-r1" } },
    data: { status: RuleSetStatus.ACTIVE, effectiveTo: null },
  });
  await prisma.exchangeRate.deleteMany({ where: { source: "manual" } });
}

async function cleanup(): Promise<void> {
  await restoreSeedFx();
  await prisma.user.deleteMany({ where: { email: { startsWith: `e2e+` } } });
  await prisma.quotation.deleteMany({ where: { customer: { fullName: { startsWith: "E2E " } } } });
  await prisma.customer.deleteMany({ where: { fullName: { startsWith: "E2E " } } });
}

/* ── suite ─────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  console.log("e2e · restoring canonical fx state…");
  await restoreSeedFx();
  console.log("e2e · booting API on :3100…");
  const server = await startServer();

  try {
    /* 1 · health */
    console.log("e2e · health");
    const health = await req("GET", "/health");
    check("GET /health → 200 db ok", () => {
      assert.equal(health.status, 200);
      assert.equal(health.body.db, "ok");
    });

    /* 2 · auth */
    console.log("e2e · auth");
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@jslimports.lk";
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
    const login = await req("POST", "/auth/login", { body: { email: adminEmail, password: adminPassword } });
    const admin: string = login.body?.accessToken;
    let adminCookie = refreshCookieOf(login);
    check("admin login → 200, access token + refresh cookie", () => {
      assert.equal(login.status, 200);
      assert.ok(admin?.length > 20);
      assert.ok(adminCookie?.startsWith("jsl_rt="));
      assert.ok(login.body.user.memberships.some((m: any) => m.role === "SUPER_ADMIN"));
    });
    const badLogin = await req("POST", "/auth/login", { body: { email: adminEmail, password: "wrong-password-1" } });
    check("wrong password → 401", () => assert.equal(badLogin.status, 401));
    const me = await req("GET", "/auth/me", { token: admin });
    check("GET /auth/me → profile with org membership", () => {
      assert.equal(me.status, 200);
      assert.equal(me.body.email, adminEmail);
      assert.ok(me.body.memberships[0].org.slug === "jsl");
    });
    const noAuth = await req("GET", "/calculations");
    check("no token on protected route → 401", () => assert.equal(noAuth.status, 401));

    /* 3 · rules */
    console.log("e2e · rules/active");
    const rules = await req("GET", "/rules/active");
    check("all 10 domains active on 2026.07.03-r1", () => {
      assert.equal(rules.status, 200);
      const versions = rules.body.versions;
      assert.equal(Object.keys(versions).length, 10);
      for (const key of Object.keys(versions)) assert.equal(versions[key].version, "2026.07.03-r1");
      assert.equal(Object.keys(rules.body.payloads).length, 10);
    });

    /* 4 · golden calculation parity */
    console.log("e2e · golden calculation (ADR-001 parity over HTTP)");
    const calc = await req("POST", "/calculations", {
      token: admin,
      body: { title: "e2e golden", inputs: GOLDEN_INPUTS },
    });
    check("POST /calculations → 201 with golden totals", () => {
      assert.equal(calc.status, 201);
      const t = calc.body.result.totals;
      assert.equal(t.cifLkr, GOLDEN.cifLkr);
      assert.equal(t.importTaxesLkr, GOLDEN.importTaxesLkr);
      assert.equal(t.landedAtPortLkr, GOLDEN.landedAtPortLkr);
      assert.equal(t.onRoadLkr, GOLDEN.onRoadLkr);
      assert.equal(calc.body.result.eligibility.importable, true);
    });
    const calcId: string = calc.body.id;
    const detail = await req("GET", `/calculations/${calcId}`, { token: admin });
    check("persisted row carries snapshot + 10 rule-version ids", () => {
      assert.equal(detail.status, 200);
      assert.equal(detail.body.resultSnapshot.totals.onRoadLkr, GOLDEN.onRoadLkr);
      assert.equal(Object.keys(detail.body.ruleVersionsMap).length, 10);
      assert.equal(Number(detail.body.totalLandedLkr), GOLDEN.landedAtPortLkr);
      assert.equal(detail.body.shippingMethod, "RORO");
    });

    /* 5 · LC what-if via revise */
    const whatIf = await req("POST", `/calculations/${calcId}/revise`, {
      token: admin,
      body: {
        title: "e2e LC pre-cutoff",
        inputs: { ...GOLDEN_INPUTS, facts: { ...GOLDEN_INPUTS.facts, lcOpenedDate: "2026-05-10" } },
      },
    });
    check("revise → surcharge window delta 986,552 & parent chained", () => {
      assert.equal(whatIf.status, 201);
      assert.equal(GOLDEN.onRoadLkr - whatIf.body.result.totals.onRoadLkr, GOLDEN.surchargeWindowCostLkr);
      assert.equal(whatIf.body.parentId, calcId);
    });
    const pin = await req("PATCH", `/calculations/${calcId}/pin`, { token: admin, body: { pinned: true } });
    check("pin toggle", () => assert.equal(pin.body.pinned, true));

    /* 6 · quotations */
    console.log("e2e · quotations");
    const orgId: string = me.body.memberships[0].org.id;
    const customer = await req("POST", "/customers", {
      token: admin,
      body: { orgId, fullName: "E2E Customer", email: `e2e+customer-${RUN}@example.lk`, phone: "0771234567" },
    });
    check("create customer", () => assert.equal(customer.status, 201));
    const quote = await req("POST", "/quotations", {
      token: admin,
      body: {
        orgId,
        customerId: customer.body.id,
        items: [{ calculationId: calcId, markupLkr: 350_000 }],
        validUntil: "2026-08-31",
      },
    });
    check("quotation: reference JSL-Q-YYYY-###### & total = landed + markup", () => {
      assert.equal(quote.status, 201);
      assert.match(quote.body.reference, /^JSL-Q-\d{4}-\d{6}$/);
      assert.equal(Number(quote.body.totalLkr), GOLDEN.landedAtPortLkr + 350_000);
      assert.equal(quote.body.items.length, 1);
    });
    const sent = await req("PATCH", `/quotations/${quote.body.id}/status`, { token: admin, body: { status: "SENT" } });
    check("DRAFT → SENT allowed", () => assert.equal(sent.body.status, "SENT"));
    const illegal = await req("PATCH", `/quotations/${quote.body.id}/status`, { token: admin, body: { status: "DRAFT" } });
    check("SENT → DRAFT rejected 400", () => assert.equal(illegal.status, 400));

    /* 7 · RBAC negatives */
    console.log("e2e · RBAC (VIEWER)");
    const viewer = await createViewer();
    const viewerLogin = await req("POST", "/auth/login", { body: viewer });
    const viewerToken: string = viewerLogin.body?.accessToken;
    check("viewer can log in", () => assert.equal(viewerLogin.status, 200));
    const viewerPublish = await req("POST", "/rules/taxRules/versions", {
      token: viewerToken,
      body: { version: "nope", payload: {} },
    });
    check("VIEWER draft rules → 403", () => assert.equal(viewerPublish.status, 403));
    const viewerCalc = await req("POST", "/calculations", { token: viewerToken, body: { inputs: GOLDEN_INPUTS } });
    check("VIEWER create calculation → 403", () => assert.equal(viewerCalc.status, 403));
    const viewerList = await req("GET", "/calculations", { token: viewerToken });
    check("VIEWER read own (empty) list → 200", () => {
      assert.equal(viewerList.status, 200);
      assert.equal(viewerList.body.total, 0);
    });

    /* 8 · refresh rotation + reuse detection + logout */
    console.log("e2e · session rotation");
    const r1 = await req("POST", "/auth/refresh", { cookie: adminCookie });
    const cookieB = refreshCookieOf(r1);
    check("refresh rotates → new access + new cookie", () => {
      assert.equal(r1.status, 200);
      assert.ok(r1.body.accessToken?.length > 20);
      assert.ok(cookieB && cookieB !== adminCookie);
    });
    const reuse = await req("POST", "/auth/refresh", { cookie: adminCookie }); // old cookie again
    check("reusing rotated token → 401 (family revoked)", () => assert.equal(reuse.status, 401));
    const afterRevoke = await req("POST", "/auth/refresh", { cookie: cookieB });
    check("even the newest token is dead after reuse detection", () => assert.equal(afterRevoke.status, 401));
    const relogin = await req("POST", "/auth/login", { body: { email: adminEmail, password: adminPassword } });
    adminCookie = refreshCookieOf(relogin);
    const logout = await req("POST", "/auth/logout", { cookie: adminCookie });
    check("logout → 204", () => assert.equal(logout.status, 204));
    const refreshAfterLogout = await req("POST", "/auth/refresh", { cookie: adminCookie });
    check("refresh after logout → 401", () => assert.equal(refreshAfterLogout.status, 401));

    /* 9 · fx ingest → provenance shift → restore */
    console.log("e2e · fx ingest (ADR-002/005)");
    const today = new Date().toISOString().slice(0, 10);
    const ingest = await req("POST", "/fx/rates", {
      token: admin,
      body: { rates: [{ pair: "JPY/LKR", rate: 1.97, asOf: today, source: "manual", confidence: "reported" }] },
    });
    check("ingest publishes a new EXCHANGE_RATES version", () => {
      assert.equal(ingest.status, 201);
      assert.match(ingest.body.publishedVersion, /^fx-\d{17}$/);
    });
    const rulesAfter = await req("GET", "/rules/active");
    check("rules/active now serves the fx-… version", () =>
      assert.equal(rulesAfter.body.versions.fx.version, ingest.body.publishedVersion),
    );
    const shifted = await req("POST", "/calculations", {
      token: admin,
      body: { title: "e2e fx shifted", inputs: GOLDEN_INPUTS },
    });
    check("new rate shifts CIF & provenance records the new fx id", () => {
      assert.notEqual(shifted.body.result.totals.cifLkr, GOLDEN.cifLkr);
      assert.equal(shifted.body.result.ruleVersions.fx, ingest.body.publishedVersion);
    });
    // restore 1.95 (same-day reading wins the merge) → golden again
    const restore = await req("POST", "/fx/rates", {
      token: admin,
      body: { rates: [{ pair: "JPY/LKR", rate: 1.95, asOf: today, source: "manual", confidence: "reported" }] },
    });
    const goldenAgain = await req("POST", "/calculations", {
      token: admin,
      body: { title: "e2e fx restored", inputs: GOLDEN_INPUTS },
    });
    check("restored rate → golden totals again", () => {
      assert.equal(restore.status, 201);
      assert.equal(goldenAgain.body.result.totals.onRoadLkr, GOLDEN.onRoadLkr);
    });

    /* 10 · validation negatives */
    console.log("e2e · validation");
    const badCalc = await req("POST", "/calculations", {
      token: admin,
      body: { inputs: { ...GOLDEN_INPUTS, japan: {} } },
    });
    check("missing hammerPrice → 400 naming the path", () => {
      assert.equal(badCalc.status, 400);
      assert.ok(JSON.stringify(badCalc.body.message).includes("japan.hammerPrice"));
    });
    const badDraft = await req("POST", "/rules/taxRules/versions", {
      token: admin,
      body: { version: `e2e-broken-${RUN}`, payload: { _meta: { domain: "TAX_RULES" }, nonsense: true } },
    });
    check("broken rule payload → 422 with engine [rules:…] message", () => {
      assert.equal(badDraft.status, 422);
      assert.match(String(badDraft.body.message), /\[rules:/);
    });
    const badDomain = await req("GET", "/rules/notADomain/versions", { token: admin });
    check("unknown rule domain → 400", () => assert.equal(badDomain.status, 400));

    /* 11 · vehicles catalog */
    console.log("e2e · vehicles");
    const variants = await req("GET", "/vehicles/variants?q=prius");
    check("catalog search finds the golden ZVW51 (public)", () => {
      assert.equal(variants.status, 200);
      assert.ok(variants.body.items.some((v: any) => v.code === "ZVW51"));
    });
  } finally {
    server.kill("SIGTERM");
    await cleanup().catch(() => undefined);
    await prisma.$disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
  else console.log("All e2e checks passed.");
}

main().catch((e) => {
  console.error("e2e harness error:", e);
  process.exitCode = 1;
});
