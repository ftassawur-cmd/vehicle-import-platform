import { RULE_DOMAINS, type RuleDomain } from "@jsl/calc-engine";
import { ConfigDomain } from "../generated/prisma/client";

/** DB enum (schema) ⇄ engine key (validate.ts RULE_DOMAINS). Single source, both directions. */
export const DB_TO_ENGINE: Record<ConfigDomain, RuleDomain> = {
  [ConfigDomain.TAX_RULES]: "taxRules",
  [ConfigDomain.LUXURY_TAX]: "luxury",
  [ConfigDomain.VEHICLE_CATEGORIES]: "vehicleCategories",
  [ConfigDomain.EXCHANGE_RATES]: "fx",
  [ConfigDomain.SHIPPING]: "shipping",
  [ConfigDomain.AUCTION_DEFAULTS]: "auctionDefaults",
  [ConfigDomain.INSURANCE]: "insurance",
  [ConfigDomain.PORT_CHARGES]: "portCharges",
  [ConfigDomain.GOVERNMENT_CHARGES]: "governmentCharges",
  [ConfigDomain.REGISTRATION]: "registrationFees",
};

export const ENGINE_TO_DB = Object.fromEntries(
  Object.entries(DB_TO_ENGINE).map(([db, eng]) => [eng, db as ConfigDomain]),
) as Record<RuleDomain, ConfigDomain>;

/** Accepts either spelling from URLs ("taxRules" or "TAX_RULES"); undefined if neither. */
export function parseDomainParam(raw: string): ConfigDomain | undefined {
  if ((RULE_DOMAINS as readonly string[]).includes(raw)) return ENGINE_TO_DB[raw as RuleDomain];
  if ((Object.values(ConfigDomain) as string[]).includes(raw)) return raw as ConfigDomain;
  return undefined;
}
