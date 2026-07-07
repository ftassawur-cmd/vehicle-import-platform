import type { CalcInputs, Confidence, Money, RuleSet } from "../types.js";
import { FxBook, r2 } from "../money.js";
import type { JapanLine } from "./japan.js";

export interface CifBuild {
  fobJpy: number;                 // native display total of JPY lines
  fobLkr: number;
  freight: { money: Money; source: "user" | "default"; confidence: Confidence };
  insurance: { money: Money; source: "user" | "default" | "computed"; confidence: Confidence; formula: string };
  cifLkr: number;
}

export function buildCif(inputs: CalcInputs, rules: RuleSet, fx: FxBook, japanLines: JapanLine[]): CifBuild {
  const fobJpy = japanLines
    .filter((l) => l.money.currency === "JPY")
    .reduce((s, l) => s + l.money.amount, 0);
  const fobLkr = japanLines.reduce((s, l) => s + fx.toLkr(l.money).lkr, 0);

  // Freight: user override, else shipping defaults by method + body class.
  const s = inputs.shipping;
  const ship = rules.shipping.methods[s.method];
  let freight: CifBuild["freight"];
  if (s.freight) freight = { money: s.freight, source: "user", confidence: "verified" };
  else if (s.method === "roro") {
    const body = inputs.vehicle.bodyClass ?? "car";
    const amt = ship.byBodyClass[body] ?? ship.byBodyClass.car;
    freight = { money: { amount: amt, currency: ship.currency }, source: "default", confidence: "estimate" };
  } else {
    freight = { money: { amount: ship.perCarShared40ft, currency: ship.currency }, source: "default", confidence: "estimate" };
  }

  // Insurance: user override, else rules.insurance.marine % of (FOB+freight), floored.
  let insurance: CifBuild["insurance"];
  if (s.insurance) {
    insurance = { money: s.insurance, source: "user", confidence: "verified", formula: "user-provided premium" };
  } else {
    const m = rules.insurance.marine;
    const freightJpyEquivalentLkr = fx.toLkr(freight.money).lkr;
    const baseLkr = fobLkr + freightJpyEquivalentLkr;
    const pct = m.defaultRatePctOfFobPlusFreight / 100;
    const floorLkr = fx.toLkr({ amount: m.minimumJpy, currency: "JPY" }).lkr;
    const premiumLkr = Math.max(r2(baseLkr * pct), r2(floorLkr));
    insurance = {
      money: { amount: premiumLkr, currency: "LKR" },
      source: "computed",
      confidence: "estimate",
      formula: `max(${m.defaultRatePctOfFobPlusFreight}% × (FOB + freight), ¥${m.minimumJpy} floor)`,
    };
  }

  const cifLkr = fobLkr + fx.toLkr(freight.money).lkr + fx.toLkr(insurance.money).lkr;
  return { fobJpy, fobLkr, freight, insurance, cifLkr };
}
