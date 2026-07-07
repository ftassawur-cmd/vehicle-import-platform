import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RuleSet } from "./types.js";
import { buildRuleSet, RULE_DOMAINS, type RuleDomain } from "./validate.js";

/**
 * Node-only convenience loader: reads the ten config domains from a directory
 * (dev/seed path) and delegates to the pure `buildRuleSet` validator.
 * Browser and API paths call `buildRuleSet` directly with pre-fetched payloads.
 */

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

export function loadRuleSetFromDir(configDir: string): RuleSet {
  const read = (f: string) => JSON.parse(readFileSync(join(configDir, f), "utf8"));
  const payloads = Object.fromEntries(
    RULE_DOMAINS.map((k) => [k, read(FILES[k])])
  ) as Record<RuleDomain, unknown>;
  return buildRuleSet(payloads);
}
