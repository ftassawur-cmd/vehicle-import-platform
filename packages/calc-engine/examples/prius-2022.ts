/**
 * Demo: 2022 Toyota Prius ZVW51 · 1.8L Petrol Hybrid · Grade 4.5 · 36,000 km
 * — the exact vehicle on the approved homepage mockup — priced under the tax
 * regime in force on 3 July 2026 (temporary surcharge window ACTIVE).
 *
 * Run:  npm run demo
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { calculate, loadRuleSetFromDir, printWaterfall } from "../src/index.js";
import type { CalcInputs } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const rules = loadRuleSetFromDir(resolve(here, "../../../config"));

const inputs: CalcInputs = {
  vehicle: {
    makeName: "Toyota",
    modelName: "Prius",
    variantCode: "ZVW51",
    year: 2022,
    fuelType: "petrolHybrid",
    vehicleClass: "car",
    bodyClass: "car",
    engineCc: 1797,
    manufactureDate: "2023-09-15",       // late-2023 build of the 2022-gen unit on the mockup
    firstRegistrationDate: "2023-10-20", // 2.7y old at shipment → inside the 3-year car limit
  },
  japan: {
    hammerPrice: { amount: 2_300_000, currency: "JPY" }, // USS grade 4.5, 36k km
    // all other Japan-side lines: Smart Assistance defaults (each overridable)
  },
  shipping: {
    method: "roro",
    originPortCode: "JPYOK", // Yokohama — "Most Popular" per the mockup
    blDate: "2026-07-20",
  },
  facts: {
    asOfDate: "2026-07-03",
    lcOpenedDate: "2026-06-10", // after 15 May 2026 → temporary surcharge APPLIES
  },
  local: { includeRegistration: true },
};

const result = calculate(inputs, rules);
console.log(printWaterfall(result));

// What-if: same vehicle, LC opened before the surcharge cutoff
const exempt = calculate(
  { ...inputs, facts: { ...inputs.facts, lcOpenedDate: "2026-05-10" } },
  rules
);
const delta = result.totals.onRoadLkr - exempt.totals.onRoadLkr;
console.log(
  `\nWHAT-IF · LC opened 2026-05-10 (pre-cutoff): on-road LKR ${exempt.totals.onRoadLkr.toLocaleString()} ` +
  `→ the May-2026 surcharge window costs this buyer LKR ${delta.toLocaleString()}.`
);
