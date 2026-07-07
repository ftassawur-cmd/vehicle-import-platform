import type { CalcResult, StepResult } from "./types.js";
import { fmtLkr } from "./money.js";

const BADGE: Record<string, string> = {
  verified: "  ", "verified-secondary": "  ", reported: "· ", estimate: "! ", low: "!!",
};

/** Console waterfall — mirrors what the UI renders as the animated duty waterfall. */
export function printWaterfall(r: CalcResult): string {
  const out: string[] = [];
  const line = (s: string) => out.push(s);
  const section = (title: string) => line(`\n── ${title} ${"─".repeat(Math.max(0, 58 - title.length))}`);

  line(`JSL IMPORTS — Landed Cost Statement (${r.generatedAt.slice(0, 10)})`);
  line(`Rule-set: taxRules ${r.ruleVersions.taxRules} · confidence floor: ${r.minConfidenceTouched}`);
  if (!r.eligibility.importable) line(`⛔ NOT IMPORTABLE: ${r.eligibility.reasons.join(" ")}`);

  const groups: [string, StepResult["group"][]][] = [
    ["JAPAN SIDE (→ FOB)", ["japan"]],
    ["FREIGHT & CIF", ["freight"]],
    ["CUSTOMS & TAXES", ["customs"]],
    ["COLOMBO CLEARANCE", ["local"]],
    ["REGISTRATION", ["registration"]],
    ["TOTALS", ["total"]],
  ];
  for (const [title, gs] of groups) {
    const rows = r.steps.filter((s) => gs.includes(s.group));
    if (!rows.length) continue;
    section(title);
    for (const s of rows) {
      const badge = BADGE[s.confidence] ?? "? ";
      line(`${badge}${s.label.padEnd(44)} ${fmtLkr(s.amountLkr).padStart(18)}`);
      line(`   └ ${s.formula}`);
      for (const n of s.notes ?? []) line(`     · ${n}`);
    }
  }
  section("SUMMARY");
  line(`  CIF ${fmtLkr(r.totals.cifLkr)} · import taxes ${fmtLkr(r.totals.importTaxesLkr)} (${r.totals.effectiveTaxPctOfCif}% of CIF)`);
  line(`  LANDED ${fmtLkr(r.totals.landedAtPortLkr)} · ON-ROAD ${fmtLkr(r.totals.onRoadLkr)}`);
  if (r.warnings.length) {
    section("WARNINGS & ASSUMPTIONS");
    for (const w of r.warnings) line(`  [${w.severity.toUpperCase()}] ${w.code}: ${w.message}`);
  }
  line(`\nLegend: (blank)=verified  ·=reported  !=estimate — verify before commitment.`);
  return out.join("\n");
}
