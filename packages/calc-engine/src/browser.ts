/**
 * Browser-safe entry: the full engine minus the node:fs directory loader.
 * Import from "@jsl/calc-engine/browser" in web bundles; pair with
 * `buildRuleSet` and statically-imported /config JSON (or API payloads).
 */
export * from "./types.js";
export { calculate } from "./engine.js";
export { buildRuleSet, assertTaxRules, RULE_DOMAINS } from "./validate.js";
export type { RuleDomain, RulePayloads } from "./validate.js";
export { printWaterfall } from "./format.js";
export { fmtLkr, fmt, FxBook, r0, r2, yearsBetween, within } from "./money.js";
