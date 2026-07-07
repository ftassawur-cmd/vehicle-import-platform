import type { RuleSet, TaxRules } from "./types.js";

/**
 * Pure rule-set assembly & validation. No I/O — safe in browser, worker, or server.
 * The Node fs loader (rules.ts) and the API's RuleSetVersion path both delegate here,
 * so every environment enforces identical structural guarantees (ADR-002).
 */

export const RULE_DOMAINS = [
  "taxRules",
  "luxury",
  "vehicleCategories",
  "fx",
  "shipping",
  "auctionDefaults",
  "insurance",
  "portCharges",
  "governmentCharges",
  "registrationFees",
] as const;

export type RuleDomain = (typeof RULE_DOMAINS)[number];
export type RulePayloads = Record<RuleDomain, unknown>;

function fail(domain: string, msg: string): never {
  throw new Error(`[rules:${domain}] ${msg}`);
}

export function assertTaxRules(t: TaxRules): void {
  if (!t.dutyComponents?.length) fail("taxRules", "dutyComponents must be a non-empty array");
  const ids = new Set<string>();
  for (const c of t.dutyComponents) {
    if (!c.id || ids.has(c.id)) fail("taxRules", `duplicate/missing duty component id '${c.id}'`);
    ids.add(c.id);
    if (typeof c.ratePct !== "number" || c.ratePct < 0) fail("taxRules", `${c.id}: ratePct invalid`);
    for (const b of c.base)
      if (b !== "customsValue" && !ids.has(b))
        fail("taxRules", `${c.id}: base '${b}' must be 'customsValue' or a previously-declared component id (order matters)`);
  }
  if (t.vat.ratePct <= 0 || t.vat.ratePct > 100) fail("taxRules", "vat.ratePct out of range");
  if (t.sscl.ratePct < 0 || t.sscl.ratePct > 100) fail("taxRules", "sscl.ratePct out of range");
  for (const [name, table] of Object.entries(t.exciseDuty.tables)) {
    let prevMax = 0;
    table.bands.forEach((b, i) => {
      if (b.min !== prevMax)
        fail("taxRules", `excise '${name}' band ${i}: min ${b.min} must equal previous max ${prevMax} (contiguous bands required)`);
      prevMax = b.max ?? Number.POSITIVE_INFINITY;
      const forms = [b.ratePerUnit, b.perUnitFixed, b.advaloremPct, b.ratePerUnitByAge].filter(
        (x) => x !== null && x !== undefined
      );
      if (forms.length === 0)
        fail("taxRules", `excise '${name}' band ${i}: at least one rate form required (ratePerUnit | perUnitFixed | advaloremPct | ratePerUnitByAge)`);
    });
    if (prevMax !== Number.POSITIVE_INFINITY)
      fail("taxRules", `excise '${name}': last band must have max=null (open-ended)`);
  }
}

/**
 * Assemble a validated RuleSet from ten pre-fetched domain payloads.
 * Sources: /config/*.json seeds (dev/browser) or RuleSetVersion rows (API).
 * Provenance: `versions` records each domain's `_meta.version` for the step trace.
 */
export function buildRuleSet(payloads: RulePayloads): RuleSet {
  for (const d of RULE_DOMAINS)
    if (payloads[d] == null) fail(d, "payload missing");

  const rs = { ...(payloads as unknown as RuleSet) };

  assertTaxRules(rs.taxRules);
  if (!rs.luxury.thresholdsLkr || !rs.luxury.ratePctOnExcess) fail("luxury", "thresholds/rates missing");
  if (!rs.vehicleCategories.classes?.length) fail("vehicleCategories", "classes missing");
  if (!rs.fx.rates?.length) fail("exchangeRates", "no rates configured");

  rs.versions = Object.fromEntries(
    RULE_DOMAINS.map((k) => {
      const meta = (payloads[k] as { _meta?: { version?: unknown } } | null)?._meta ?? {};
      return [k, String(meta.version ?? "unversioned")];
    })
  );
  return rs;
}
