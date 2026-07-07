import type {
  CalcInputs, CalcWarning, Confidence, ExciseBand, ExciseTable, RuleSet, StepResult,
} from "../types.js";
import { fmtLkr, r0, within, yearsBetween } from "../money.js";

const CONF_ORDER: Confidence[] = ["verified", "verified-secondary", "reported", "estimate", "low"];
export const worst = (a: Confidence, b: Confidence): Confidence =>
  CONF_ORDER[Math.max(CONF_ORDER.indexOf(a), CONF_ORDER.indexOf(b))]!;

export interface CustomsBuild {
  steps: StepResult[];
  warnings: CalcWarning[];
  customsValueLkr: number;
  importTaxesLkr: number;
  minConfidence: Confidence;
}

export function buildCustomsStack(inputs: CalcInputs, rules: RuleSet, cifLkr: number): CustomsBuild {
  const t = rules.taxRules;
  const v = inputs.vehicle;
  const steps: StepResult[] = [];
  const warnings: CalcWarning[] = [];
  let minConf: Confidence = "verified";
  const touch = (c?: Confidence) => { if (c) minConf = worst(minConf, c); };

  // ── Customs value ──
  const declared = r0(cifLkr);
  const assessed = inputs.facts.assessedCustomsValueLkr;
  let cv = declared;
  let cvNote = "declared CIF";
  if (t.customsValue.mode !== "declared" && assessed != null) {
    if (t.customsValue.mode === "assessed" || assessed > declared) {
      cv = r0(assessed);
      cvNote = assessed > declared ? "Customs-assessed value (higher than declared)" : "assessed override";
      warnings.push({ severity: "info", code: "CV_ASSESSED", message: `Customs value uses ${cvNote}: ${fmtLkr(cv)}.` });
    }
  }
  steps.push({
    id: "customsValue", group: "customs", label: "Customs value (CV)",
    formula: `CV = ${cvNote} = ${fmtLkr(cv)}`,
    amountLkr: cv, confidence: t.customsValue.confidence ?? "verified",
  });

  // ── Duty components (CID + surcharges), temporal + conditional ──
  const registry = new Map<string, number>([["customsValue", cv]]);
  for (const c of t.dutyComponents) {
    const active = within(inputs.facts.asOfDate, c.effectiveFrom, c.effectiveTo ?? undefined);
    const excluded = c.excludedVehicleClasses?.includes(v.vehicleClass) ?? false;
    let conditionMet = true;
    const notes: string[] = [];

    if (active && !excluded && c.conditions?.lcOpenedAfter) {
      const cutoff = c.conditions.lcOpenedAfter;
      const lc = inputs.facts.lcOpenedDate;
      if (lc == null) {
        notes.push(`Assumed LC opened after ${cutoff}; provide lcOpenedDate to confirm.`);
        warnings.push({
          severity: "warn", code: "LC_DATE_ASSUMED",
          message: `${c.label} applied on the assumption the LC opens after ${cutoff}. Enter the LC date to confirm exemption status.`,
        });
      } else if (new Date(lc).getTime() <= new Date(cutoff).getTime() + 86_399_000) {
        conditionMet = false;
        notes.push(`Exempt: LC opened ${lc} (on/before ${cutoff}). Post-cutoff LC amendments void this exemption.`);
      }
    }

    const applies = active && !excluded && conditionMet;
    const baseSum = c.base.reduce((s, id) => s + (registry.get(id) ?? 0), 0);
    const amount = applies ? r0(baseSum * (c.ratePct / 100)) : 0;
    registry.set(c.id, amount);
    touch(applies ? c.confidence : undefined);

    steps.push({
      id: c.id, group: "customs", label: c.label,
      formula: applies
        ? `${c.ratePct}% × (${c.base.join(" + ")} = ${fmtLkr(baseSum)})`
        : !active ? `not in force on ${inputs.facts.asOfDate}`
        : excluded ? `not applicable to vehicle class '${v.vehicleClass}'`
        : `exempt — LC-date condition`,
      amountLkr: amount, confidence: c.confidence ?? "reported",
      notes: [...notes, ...(c.notes ? [c.notes] : [])],
    });
  }

  // ── Excise duty (XID) ──
  const table = t.exciseDuty.tables[v.fuelType] as ExciseTable | undefined;
  if (!table) throw new Error(`No excise table for fuel type '${v.fuelType}'. Add it in Admin Panel > Tax Rules.`);
  const units = table.unit === "cc" ? v.engineCc : v.motorKw;
  if (units == null || units <= 0)
    throw new Error(`Vehicle requires ${table.unit === "cc" ? "engineCc" : "motorKw"} for the '${v.fuelType}' excise table.`);
  const band = table.bands.find(
    (b: ExciseBand) => units >= b.min && (b.max == null || units < b.max)
  );
  if (!band) throw new Error(`No excise band covers ${units}${table.unit} in '${v.fuelType}'.`);

  const ageY = yearsBetween(v.manufactureDate, inputs.facts.asOfDate);
  let perUnitRate: number | null = band.ratePerUnit ?? null;
  let tierLabel = "";
  if (band.ratePerUnitByAge) {
    const tiers = band.ratePerUnitByAge;
    const key =
      ageY <= 1 && tiers.le1y != null ? "le1y" :
      ageY <= 2 && tiers.le2y != null ? "le2y" :
      ageY <= 3 && tiers.le3y != null ? "le3y" :
      tiers.gt1y != null && ageY > 1 ? "gt1y" :
      Object.keys(tiers).at(-1)!;
    perUnitRate = tiers[key]!;
    tierLabel = ` [age tier ${key}, ${ageY.toFixed(1)}y]`;
  }

  const candidates: { form: string; amount: number }[] = [];
  if (perUnitRate != null)
    candidates.push({ form: `LKR ${perUnitRate.toLocaleString()}/${table.unit} × ${units}${table.unit}${tierLabel}`, amount: perUnitRate * units });
  if (band.perUnitFixed != null)
    candidates.push({ form: `fixed per-unit LKR ${band.perUnitFixed.toLocaleString()}`, amount: band.perUnitFixed });
  if (band.advaloremPct != null)
    candidates.push({ form: `${band.advaloremPct}% × CV`, amount: (band.advaloremPct / 100) * cv });
  let xid = candidates.reduce((m, c) => (c.amount > m.amount ? c : m));
  const exciseNotes: string[] = [];
  if (candidates.length > 1) exciseNotes.push(`higher-of rule: ${candidates.map((c) => fmtLkr(r0(c.amount))).join(" vs ")}`);

  if (!band.ratePerUnitByAge && ageY > 3) {
    const mult = t.exciseDuty.combustionOver3YearsMultiplier;
    xid = { form: `${xid.form} × ${mult.value} (over-3-years multiplier)`, amount: xid.amount * mult.value };
    touch(mult.confidence ?? "estimate");
    exciseNotes.push(mult.notes ?? "over-3-years multiplier applied");
  }
  const xidAmt = r0(xid.amount);
  registry.set("excise", xidAmt);
  touch(band.confidence ?? "estimate");
  if ((band.confidence ?? "estimate") === "estimate")
    warnings.push({
      severity: "warn", code: "XID_BAND_ESTIMATE",
      message: `Excise band ${band.min}–${band.max ?? "∞"}${table.unit} (${v.fuelType}) uses a placeholder rate pending gazette transcription (Q1). Verify before commitment.`,
    });
  steps.push({
    id: "excise", group: "customs", label: "Excise Duty (XID)",
    formula: xid.form, amountLkr: xidAmt,
    confidence: band.confidence ?? "estimate", notes: exciseNotes,
  });

  // ── Luxury tax ──
  const lux = rules.luxury;
  let luxAmt = 0;
  let luxFormula = "";
  if (lux.exemptVehicleClasses.includes(v.vehicleClass)) {
    luxFormula = `exempt vehicle class '${v.vehicleClass}'`;
  } else {
    const thr = lux.thresholdsLkr[v.fuelType];
    const rate = lux.ratePctOnExcess[v.fuelType];
    const excess = Math.max(0, cifLkr - thr);
    luxAmt = r0(excess * (rate / 100));
    luxFormula = excess > 0
      ? `${rate}% × (CIF ${fmtLkr(cifLkr)} − threshold ${fmtLkr(thr)})`
      : `CIF below ${fmtLkr(thr)} threshold — no luxury tax`;
    const headroom = thr - cifLkr;
    if (headroom > 0 && headroom <= 300000)
      warnings.push({
        severity: "info", code: "LUX_PROXIMITY",
        message: `CIF is only ${fmtLkr(headroom)} below the luxury-tax threshold. FX movement or reassessment could trigger ${rate}% on the excess.`,
      });
  }
  registry.set("luxuryTax", luxAmt);
  steps.push({
    id: "luxuryTax", group: "customs", label: "Luxury Tax",
    formula: luxFormula, amountLkr: luxAmt, confidence: "verified-secondary",
  });

  // ── Base resolver for SSCL / VAT ──
  const upliftPct = t.vat.cifUpliftPct / 100;
  const resolve = (tokens: string[]): { sum: number; parts: string[] } => {
    let sum = 0; const parts: string[] = [];
    for (const tok of tokens) {
      let val = 0;
      if (tok === "customsValue") val = cv;
      else if (tok === "customsValueUplifted") val = cv * (1 + upliftPct);
      else val = registry.get(tok) ?? 0;
      if (val !== 0 || tok.startsWith("customsValue")) parts.push(tok);
      sum += val;
    }
    return { sum, parts };
  };

  // ── SSCL ──
  const ssclBase = resolve(t.sscl.baseIncludes);
  const sscl = r0(ssclBase.sum * (t.sscl.ratePct / 100));
  registry.set("sscl", sscl);
  touch(t.sscl.confidence);
  steps.push({
    id: "sscl", group: "customs", label: `SSCL (${t.sscl.ratePct}%)`,
    formula: `${t.sscl.ratePct}% × (${ssclBase.parts.join(" + ")}) = ${t.sscl.ratePct}% × ${fmtLkr(ssclBase.sum)}`,
    amountLkr: sscl, confidence: t.sscl.confidence ?? "reported",
    notes: t.sscl.notes ? [t.sscl.notes] : undefined,
  });

  // ── VAT ──
  const vatBase = resolve(t.vat.baseIncludes);
  const vat = r0(vatBase.sum * (t.vat.ratePct / 100));
  registry.set("vat", vat);
  touch(t.vat.confidence);
  steps.push({
    id: "vat", group: "customs", label: `VAT (${t.vat.ratePct}%)`,
    formula: `${t.vat.ratePct}% × (${vatBase.parts.join(" + ")}) = ${t.vat.ratePct}% × ${fmtLkr(vatBase.sum)}  [CIF uplift ${t.vat.cifUpliftPct}%]`,
    amountLkr: vat, confidence: t.vat.confidence ?? "reported",
    notes: t.vat.notes ? [t.vat.notes] : undefined,
  });

  const importTaxes =
    [...registry.entries()]
      .filter(([k]) => k !== "customsValue")
      .reduce((s, [, val]) => s + val, 0);

  return { steps, warnings, customsValueLkr: cv, importTaxesLkr: r0(importTaxes), minConfidence: minConf };
}
