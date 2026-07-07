import type { CalcInputs, RuleSet, StepResult } from "../types.js";
import { fmtLkr, r0 } from "../money.js";

export interface LocalBuild { steps: StepResult[]; localTotalLkr: number; registrationTotalLkr: number; }

export function buildLocalAndRegistration(
  inputs: CalcInputs, rules: RuleSet, remittedLkr: number
): LocalBuild {
  const steps: StepResult[] = [];
  const o = inputs.local ?? {};
  const pc = rules.portCharges;
  const overrides = new Map((o.portLines ?? []).map((l) => [l.id, l.amount]));

  let local = 0;
  const push = (id: string, label: string, amount: number, formula?: string) => {
    const amt = r0(overrides.get(id) ?? amount);
    if (id === "demurrageContingency" && !o.includeDemurrageContingency) return;
    local += amt;
    steps.push({
      id, group: "local", label, amountLkr: amt,
      formula: formula ?? (overrides.has(id) ? "user override" : "config default (estimate)"),
      confidence: overrides.has(id) ? "verified" : "estimate",
    });
  };

  for (const line of pc.byMethod[inputs.shipping.method] ?? []) push(line.id, line.label, line.amount);
  for (const line of pc.common) {
    if (line.id === "clearingAgent" && o.clearingAgentLkr != null) push(line.id, line.label, o.clearingAgentLkr, "user override");
    else if (line.id === "localTransport" && o.localTransportLkr != null) push(line.id, line.label, o.localTransportLkr, "user override");
    else push(line.id, line.label, line.amount);
  }
  for (const g of rules.governmentCharges.items) push(g.id, g.label, g.amount);

  const bank = pc.bankCharges;
  const bankAmt = r0(remittedLkr * (bank.lcPctOfRemitted / 100) + bank.fixedLkr);
  local += bankAmt;
  steps.push({
    id: "bankCharges", group: "local", label: "Bank charges (LC + docs)",
    formula: `${bank.lcPctOfRemitted}% × remitted ${fmtLkr(remittedLkr)} + ${fmtLkr(bank.fixedLkr)}`,
    amountLkr: bankAmt, confidence: "estimate",
  });

  // ── DMT registration ──
  let reg = 0;
  if (o.includeRegistration !== false) {
    const rf = rules.registrationFees;
    const v = inputs.vehicle;
    const first = rf.firstRegistration[v.vehicleClass] ?? rf.firstRegistration.car;
    const plates = rf.numberPlates.standardPair;
    const licTable =
      v.fuelType === "ev" || v.fuelType === "esmart" ? rf.revenueLicenceYear1.ev
      : v.fuelType.startsWith("diesel") ? rf.revenueLicenceYear1.diesel
      : rf.revenueLicenceYear1.petrol;
    const unitVal = v.engineCc ?? v.motorKw ?? 0;
    const lic = licTable.find((b: any) => {
      const cap = b.maxCc ?? b.maxKw ?? null; // null/absent cap ⇒ open-ended band
      return cap == null || unitVal <= cap;
    })?.amount ?? licTable.at(-1).amount;
    const agent = o.registrationAgentFee ? rf.optionalAgentFee : 0;

    const regLines: [string, string, number][] = [
      ["firstRegistration", "DMT first registration", first],
      ["numberPlates", "Number plates (standard pair)", plates],
      ["revenueLicence", "Revenue licence (year 1)", lic],
      ...(agent ? [["regAgent", "Registration agent (optional)", agent] as [string, string, number]] : []),
    ];
    for (const [id, label, amount] of regLines) {
      reg += r0(amount);
      steps.push({
        id, group: "registration", label, amountLkr: r0(amount),
        formula: "DMT schedule (config, estimate — Q8)", confidence: "estimate",
      });
    }
  }

  return { steps, localTotalLkr: r0(local), registrationTotalLkr: r0(reg) };
}
