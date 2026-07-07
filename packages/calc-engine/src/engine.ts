import type { CalcInputs, CalcResult, CalcWarning, Confidence, RuleSet, StepResult } from "./types.js";
import { FxBook, fmt, fmtLkr, r0, yearsBetween } from "./money.js";
import { buildJapanLines } from "./steps/japan.js";
import { buildCif } from "./steps/freight.js";
import { buildCustomsStack, worst } from "./steps/customs.js";
import { buildLocalAndRegistration } from "./steps/local.js";

export function calculate(inputs: CalcInputs, rules: RuleSet): CalcResult {
  const warnings: CalcWarning[] = [];
  const steps: StepResult[] = [];
  const conf: { min: Confidence } = { min: "verified" };
  const touch = (c: Confidence) => (conf.min = worst(conf.min, c));
  const fx = new FxBook(rules.fx);

  // ── Eligibility (import-control regulations) ──
  const v = inputs.vehicle;
  const cls = rules.vehicleCategories.classes.find((c) => c.id === v.vehicleClass);
  const eligibility = { importable: true, reasons: [] as string[] };
  if (!cls) {
    eligibility.importable = false;
    eligibility.reasons.push(`Unknown vehicle class '${v.vehicleClass}'.`);
  } else if (v.firstRegistrationDate) {
    const shipDate = inputs.shipping.blDate ?? inputs.facts.asOfDate;
    const age = yearsBetween(v.firstRegistrationDate, shipDate);
    if (age > cls.maxImportAgeYears) {
      eligibility.importable = false;
      eligibility.reasons.push(
        `Vehicle age ${age.toFixed(1)}y (first registration → B/L) exceeds the ${cls.maxImportAgeYears}-year limit for '${cls.label}' under the Imports & Exports (Control) Regulations No. 01 of 2025.`
      );
      warnings.push({ severity: "error", code: "AGE_LIMIT", message: eligibility.reasons.at(-1)! });
    }
  } else {
    warnings.push({
      severity: "warn", code: "AGE_UNVERIFIED",
      message: "firstRegistrationDate not provided — import age-limit compliance not verified.",
    });
  }
  if (fx.hasStale())
    warnings.push({ severity: "warn", code: "FX_STALE", message: "One or more configured exchange rates are stale. Refresh in Admin Panel > Exchange Rates before quoting." });

  // ── Japan side → FOB ──
  const jp = buildJapanLines(inputs, rules);
  for (const l of jp) {
    touch(l.confidence);
    steps.push({
      id: `jp:${l.id}`, group: "japan", label: l.label,
      formula: l.source === "default" ? "Smart Assistance default (override anytime)" : "user input",
      amountLkr: r0(fx.toLkr(l.money).lkr), confidence: l.confidence,
      notes: [fmt(l.money.amount, l.money.currency)],
    });
  }

  // ── Freight & insurance → CIF ──
  const cif = buildCif(inputs, rules, fx, jp);
  touch(cif.freight.confidence); touch(cif.insurance.confidence);
  steps.push({
    id: "fob", group: "freight", label: "FOB (Free on Board)",
    formula: "hammer + all Japan-side lines through loading",
    amountLkr: r0(cif.fobLkr), confidence: conf.min,
    notes: [`≈ ${fmt(cif.fobJpy, "JPY")} native`],
  });
  steps.push({
    id: "freight", group: "freight", label: `Ocean freight (${inputs.shipping.method.toUpperCase()}, ${inputs.shipping.originPortCode} → LKCMB)`,
    formula: cif.freight.source === "user" ? "user input" : "route default (estimate)",
    amountLkr: r0(fx.toLkr(cif.freight.money).lkr), confidence: cif.freight.confidence,
    notes: [fmt(cif.freight.money.amount, cif.freight.money.currency)],
  });
  steps.push({
    id: "insurance", group: "freight", label: "Marine insurance",
    formula: cif.insurance.formula,
    amountLkr: r0(fx.toLkr(cif.insurance.money).lkr), confidence: cif.insurance.confidence,
  });
  steps.push({
    id: "cif", group: "freight", label: "CIF (Cost, Insurance & Freight)",
    formula: `FOB + freight + insurance, converted at configured rates`,
    amountLkr: r0(cif.cifLkr), confidence: conf.min,
    fxUsed: fx.uses.slice(0, 3),
  });

  // ── Customs duty stack ──
  const customs = buildCustomsStack(inputs, rules, cif.cifLkr);
  steps.push(...customs.steps);
  warnings.push(...customs.warnings);
  touch(customs.minConfidence);

  // ── Local clearance + registration ──
  const local = buildLocalAndRegistration(inputs, rules, cif.cifLkr);
  steps.push(...local.steps);
  touch("estimate");

  // ── Totals & running totals ──
  const landedAtPort = r0(cif.cifLkr + customs.importTaxesLkr + local.localTotalLkr);
  const onRoad = r0(landedAtPort + local.registrationTotalLkr);
  let running = 0;
  for (const s of steps) {
    if (["fob", "cif", "customsValue"].includes(s.id)) { s.runningTotalLkr = s.amountLkr; running = s.amountLkr; continue; }
    if (s.group === "japan") continue;
    running = r0(running + s.amountLkr);
    s.runningTotalLkr = running;
  }
  steps.push({
    id: "landedAtPort", group: "total", label: "Landed cost (cleared at Colombo)",
    formula: `CIF ${fmtLkr(cif.cifLkr)} + import taxes ${fmtLkr(customs.importTaxesLkr)} + clearance ${fmtLkr(local.localTotalLkr)}`,
    amountLkr: landedAtPort, confidence: conf.min,
  });
  steps.push({
    id: "onRoad", group: "total", label: "Final on-road cost",
    formula: `landed + registration ${fmtLkr(local.registrationTotalLkr)}`,
    amountLkr: onRoad, confidence: conf.min,
  });

  if (conf.min === "estimate" || conf.min === "low")
    warnings.push({
      severity: "warn", code: "CONTAINS_ESTIMATES",
      message: "This result touched values pending verification (see amber lines). Confirm with a licensed clearing agent / Sri Lanka Customs before financial commitment.",
    });

  return {
    inputsEcho: inputs,
    ruleVersions: rules.versions,
    steps,
    totals: {
      fobJpy: r0(cif.fobJpy),
      cifLkr: r0(cif.cifLkr),
      customsValueLkr: customs.customsValueLkr,
      importTaxesLkr: customs.importTaxesLkr,
      landedAtPortLkr: landedAtPort,
      onRoadLkr: onRoad,
      effectiveTaxPctOfCif: Math.round((customs.importTaxesLkr / cif.cifLkr) * 1000) / 10,
    },
    warnings,
    eligibility,
    minConfidenceTouched: conf.min,
    generatedAt: new Date().toISOString(),
  };
}
