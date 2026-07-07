/**
 * Golden regression + environment-parity test.
 *
 * 1. Locks the verified 2022 Prius ZVW51 figures (README §"Run the engine demo").
 * 2. Proves the browser path (pure `buildRuleSet` over pre-fetched payloads)
 *    produces byte-identical totals to the Node fs loader — the ADR-001
 *    guarantee that previews and authoritative results can never drift.
 *
 * Run:  npm test
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import assert from "node:assert/strict";
import {
  calculate, loadRuleSetFromDir, buildRuleSet, RULE_DOMAINS, type CalcInputs, type RuleDomain,
} from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const configDir = resolve(here, "../../../config");

const FILES: Record<RuleDomain, string> = {
  taxRules: "taxRules.json",
  luxury: "luxuryThresholds.json",
  vehicleCategories: "vehicleCategories.json",
  fx: "exchangeRates.json",
  shipping: "shippingRates.json",
  auctionDefaults: "auctionDefaults.json",
  insurance: "insuranceRules.json",
  portCharges: "portCharges.json",
  governmentCharges: "governmentCharges.json",
  registrationFees: "registrationFees.json",
};

const inputs: CalcInputs = {
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

// ── Golden figures (verified 3 Jul 2026, rule-set 2026.07.03-r1) ──
const GOLDEN = {
  cifLkr: 5_437_790,
  importTaxesLkr: 16_601_580,
  landedAtPortLkr: 22_203_621,
  onRoadLkr: 22_232_221,
  effectiveTaxPctOfCif: 305.3,
  surchargeWindowCostLkr: 986_552, // vs LC opened 2026-05-10
} as const;

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  try {
    assert.deepEqual(actual, expected);
    console.log(`  ✓ ${label}`);
  } catch {
    failures++;
    console.error(`  ✗ ${label}\n      expected ${String(expected)}\n      actual   ${String(actual)}`);
  }
};

console.log("golden · fs-loader path");
const viaFs = calculate(inputs, loadRuleSetFromDir(configDir));
check("CIF", viaFs.totals.cifLkr, GOLDEN.cifLkr);
check("import taxes", viaFs.totals.importTaxesLkr, GOLDEN.importTaxesLkr);
check("landed at port", viaFs.totals.landedAtPortLkr, GOLDEN.landedAtPortLkr);
check("on-road", viaFs.totals.onRoadLkr, GOLDEN.onRoadLkr);
check("effective tax % of CIF", viaFs.totals.effectiveTaxPctOfCif, GOLDEN.effectiveTaxPctOfCif);

console.log("golden · LC what-if (pre-cutoff exemption)");
const exempt = calculate({ ...inputs, facts: { ...inputs.facts, lcOpenedDate: "2026-05-10" } }, loadRuleSetFromDir(configDir));
check("surcharge window cost", viaFs.totals.onRoadLkr - exempt.totals.onRoadLkr, GOLDEN.surchargeWindowCostLkr);
check("temp surcharge zeroed when exempt", exempt.steps.find((s) => s.id === "surcharge_temp_2026")?.amountLkr, 0);

console.log("parity · browser path (buildRuleSet over payloads) ≡ fs loader");
const payloads = Object.fromEntries(
  RULE_DOMAINS.map((k) => [k, JSON.parse(readFileSync(join(configDir, FILES[k]), "utf8"))])
) as Record<RuleDomain, unknown>;
const viaPayloads = calculate(inputs, buildRuleSet(payloads));
check("totals identical", viaPayloads.totals, viaFs.totals);
check("step trace identical (ids+amounts)",
  viaPayloads.steps.map((s) => [s.id, s.amountLkr]),
  viaFs.steps.map((s) => [s.id, s.amountLkr]));
check("rule versions recorded", viaPayloads.ruleVersions.taxRules, "2026.07.03-r1");

console.log("eligibility · age-limit regulation");
const tooOld = calculate(
  { ...inputs, vehicle: { ...inputs.vehicle, firstRegistrationDate: "2022-06-01" } },
  buildRuleSet(payloads)
);
check("4.1-year-old car blocked", tooOld.eligibility.importable, false);

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll golden checks passed.");
