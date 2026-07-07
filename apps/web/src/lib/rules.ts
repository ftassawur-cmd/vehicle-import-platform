/**
 * Browser rule-set: the ten /config seeds, statically bundled and validated
 * once at startup via the same `buildRuleSet` the API uses (ADR-001/002).
 * When the API ships, this module swaps its source to the published
 * RuleSetVersion payloads — the call-sites don't change.
 */
import { buildRuleSet, type FuelType, type RuleSet } from "@jsl/calc-engine/browser";

import taxRules from "@config/taxRules.json";
import luxury from "@config/luxuryThresholds.json";
import vehicleCategories from "@config/vehicleCategories.json";
import fx from "@config/exchangeRates.json";
import shipping from "@config/shippingRates.json";
import auctionDefaults from "@config/auctionDefaults.json";
import insurance from "@config/insuranceRules.json";
import portCharges from "@config/portCharges.json";
import governmentCharges from "@config/governmentCharges.json";
import registrationFees from "@config/registrationFees.json";

export const rules: RuleSet = buildRuleSet({
  taxRules,
  luxury,
  vehicleCategories,
  fx,
  shipping,
  auctionDefaults,
  insurance,
  portCharges,
  governmentCharges,
  registrationFees,
});

/* ── Derived, UI-facing views of the rule-set ── */

export interface PortOption { code: string; name: string; popular?: boolean }
export const originPorts: PortOption[] = (shipping as { originPorts: PortOption[] }).originPorts;

export const vehicleClasses = rules.vehicleCategories.classes;

export const FUEL_LABELS: Record<FuelType, string> = {
  petrol: "Petrol",
  diesel: "Diesel",
  petrolHybrid: "Petrol hybrid",
  dieselHybrid: "Diesel hybrid",
  petrolPhev: "Plug-in hybrid (petrol)",
  dieselPhev: "Plug-in hybrid (diesel)",
  ev: "Electric (BEV)",
  esmart: "Series hybrid (e-POWER / e-SMART)",
};

export const FUELS = Object.keys(FUEL_LABELS) as FuelType[];

export const isElectric = (f: FuelType): boolean => f === "ev";

/** Excise capacity unit for a fuel type — drives the cc/kW field. */
export const capacityUnit = (f: FuelType): "cc" | "kW" =>
  rules.taxRules.exciseDuty.tables[f]?.unit ?? "cc";

/** The temporary 2026 surcharge window, surfaced for hero copy & what-ifs. */
export const tempSurcharge = rules.taxRules.dutyComponents.find(
  (c) => c.id === "surcharge_temp_2026"
);
export const LC_CUTOFF = tempSurcharge?.conditions?.lcOpenedAfter ?? "2026-05-15";

export const jpyRate =
  rules.fx.rates.find((r) => r.pair === "JPY/LKR")?.rate ?? 0;

export const ruleVersion = rules.versions.taxRules ?? "unversioned";
