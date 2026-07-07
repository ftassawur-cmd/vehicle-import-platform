import { useMemo, useState, type ReactNode } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Printer, Copy, Check, RotateCcw, OctagonX, Sparkles } from "lucide-react";
import { calculate, type CalcResult } from "@jsl/calc-engine/browser";
import {
  rules, ruleVersion, originPorts, vehicleClasses, FUELS, FUEL_LABELS,
  capacityUnit, LC_CUTOFF, jpyRate,
} from "@/lib/rules";
import {
  PRESETS, initialForm, applyPreset, toCalcInputs, type FormState,
} from "@/lib/presets";
import { usePageMeta } from "@/hooks";
import { lkr, prettyDate, compactLkr } from "@/lib/format";
import { Logo } from "@/components/chrome";
import {
  Advanced, DateInput, Field, NumberInput, Segmented, Select, Switch, TextInput,
} from "@/components/fields";
import {
  ConfidenceChip, TotalsSummary, Waterfall, WarningsPanel,
} from "@/components/ledger";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-line-soft bg-card p-4 sm:p-5">
      <legend className="eyebrow px-1.5">{title}</legend>
      <div className="mt-1 space-y-4">{children}</div>
    </fieldset>
  );
}

export default function Calculator() {
  usePageMeta(
    "Calculator — JSL Imports",
    "Price a Japan-auction vehicle to on-road in Colombo. Full duty waterfall, LC-date what-ifs, printable quote."
  );

  const [f, setF] = useState<FormState>(initialForm);
  const [copied, setCopied] = useState(false);
  const set = <K extends keyof FormState>(k: K) => (v: FormState[K]) =>
    setF((s) => ({ ...s, [k]: v, presetId: k === "presetId" ? (v as string) : "custom" }));

  const unit = capacityUnit(f.fuelType);

  const { result, error } = useMemo<{ result: CalcResult | null; error: string | null }>(() => {
    try {
      return { result: calculate(toCalcInputs(f), rules), error: null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [f]);

  /* LC what-if: only meaningful while the temporary window can touch this calc */
  const whatIf = useMemo(() => {
    if (!result) return null;
    const step = result.steps.find((s) => s.id === "surcharge_temp_2026");
    if (!step) return null;
    const applied = step.amountLkr > 0;
    const exemptByLc = step.formula.includes("exempt");
    if (!applied && !exemptByLc) return null; // window not in force for these dates/class
    const altDate = applied ? LC_CUTOFF : new Date().toISOString().slice(0, 10);
    const alt = calculate(
      { ...toCalcInputs(f), facts: { ...toCalcInputs(f).facts, lcOpenedDate: altDate } },
      rules
    );
    const delta = Math.abs(alt.totals.onRoadLkr - result.totals.onRoadLkr);
    return { applied, delta };
  }, [result, f]);

  const copyJson = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  };

  const v = toCalcInputs(f).vehicle;

  return (
    <section className="mx-auto max-w-6xl px-5 pb-24 pt-28">
      <header data-noprint className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">rule-set {ruleVersion} · JPY/LKR {jpyRate.toFixed(2)}</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Landed-cost calculator
          </h1>
        </div>
        <p className="max-w-sm text-[13.5px] leading-relaxed text-faint">
          The ledger updates as you type. Amber lines are estimates — override them with your
          actual figures and they turn green.
        </p>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[0.92fr_1.08fr]">
        {/* ── Form ── */}
        <form data-noprint className="space-y-4" onSubmit={(e) => e.preventDefault()} aria-label="Import details">
          <Field label="Start from a market preset">
            {(id) => (
              <Select id={id} value={f.presetId} onChange={(val) => setF((s) => applyPreset(s, val))}>
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label} — {p.note}</option>
                ))}
                <option value="custom">Custom build</option>
              </Select>
            )}
          </Field>

          <Group title="Vehicle">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Make">{(id) => <TextInput id={id} value={f.makeName} onChange={set("makeName")} placeholder="Toyota" />}</Field>
              <Field label="Model">{(id) => <TextInput id={id} value={f.modelName} onChange={set("modelName")} placeholder="Prius" />}</Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Variant / chassis code">{(id) => <TextInput id={id} value={f.variantCode} onChange={set("variantCode")} placeholder="ZVW51" />}</Field>
              <Field label="Model year">{(id) => <NumberInput id={id} value={f.year} onChange={(n) => set("year")(n ?? 0)} min={1990} />}</Field>
            </div>
            <Field label="Propulsion" hint="Selects the excise table — hybrids and EVs band differently.">
              {(id) => (
                <Select id={id} value={f.fuelType} onChange={(val) => set("fuelType")(val as FormState["fuelType"])}>
                  {FUELS.map((ft) => <option key={ft} value={ft}>{FUEL_LABELS[ft]}</option>)}
                </Select>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Vehicle class" hint="Sets the import age limit.">
                {(id) => (
                  <Select id={id} value={f.vehicleClass} onChange={(val) => set("vehicleClass")(val as FormState["vehicleClass"])}>
                    {vehicleClasses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Body (for freight)">
                {(id) => (
                  <Select id={id} value={f.bodyClass} onChange={(val) => set("bodyClass")(val as FormState["bodyClass"])}>
                    <option value="car">Car / hatch / sedan</option>
                    <option value="suv">SUV</option>
                    <option value="vanDualPurpose">Van</option>
                    <option value="pickup">Pickup</option>
                  </Select>
                )}
              </Field>
            </div>
            <Field
              label={unit === "cc" ? "Engine capacity" : "Motor power"}
              hint={unit === "cc" ? "Excise is charged per cc for this propulsion." : "EV excise is charged per kW, tiered by age."}
            >
              {(id) => <NumberInput id={id} value={f.capacity} onChange={(n) => set("capacity")(n ?? 0)} min={1} suffix={unit} />}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Manufacture date" hint="Drives excise age banding.">
                {(id) => <DateInput id={id} value={f.manufactureDate} onChange={set("manufactureDate")} />}
              </Field>
              <Field label="First registration" hint="Drives the import age limit.">
                {(id) => <DateInput id={id} value={f.firstRegistrationDate} onChange={set("firstRegistrationDate")} />}
              </Field>
            </div>
          </Group>

          <Group title="Japan side">
            <Field label="Auction hammer price" hint={`≈ ${lkr(f.hammerJpy * jpyRate)} at the configured rate.`}>
              {(id) => <NumberInput id={id} value={f.hammerJpy} onChange={(n) => set("hammerJpy")(n ?? 0)} min={0} step={10000} suffix="JPY" />}
            </Field>
            <Advanced title="Override Japan-side fees (defaults otherwise)">
              <Field label="Auction fee">{(id) => <NumberInput id={id} allowEmpty placeholder="22,000 default" value={f.auctionFeeJpy} onChange={set("auctionFeeJpy")} min={0} step={1000} suffix="JPY" />}</Field>
              <Field label="Exporter service fee">{(id) => <NumberInput id={id} allowEmpty placeholder="88,000 default" value={f.exporterFeeJpy} onChange={set("exporterFeeJpy")} min={0} step={1000} suffix="JPY" />}</Field>
              <Field label="Inland transport (auction → port)">{(id) => <NumberInput id={id} allowEmpty placeholder="25,000 default" value={f.inlandTransportJpy} onChange={set("inlandTransportJpy")} min={0} step={1000} suffix="JPY" />}</Field>
              <p className="text-[12px] leading-snug text-faint">
                Six smaller lines (export papers, JAAI, radiation, cleaning, courier, port &
                loading) keep their Smart defaults and stay itemised in the ledger.
              </p>
            </Advanced>
          </Group>

          <Group title="Shipping">
            <Segmented
              label="Shipping method"
              value={f.method}
              onChange={set("method")}
              options={[
                { value: "roro", label: "RoRo" },
                { value: "container", label: "Shared container" },
              ]}
            />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Origin port">
                {(id) => (
                  <Select id={id} value={f.originPortCode} onChange={set("originPortCode")}>
                    {originPorts.map((p) => (
                      <option key={p.code} value={p.code}>{p.name}{p.popular ? " · popular" : ""}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="B/L (shipment) date">
                {(id) => <DateInput id={id} value={f.blDate} onChange={set("blDate")} />}
              </Field>
            </div>
            <Advanced title="Override ocean freight">
              <Field label="Freight" hint="Leave empty to use the route default for your body class.">
                {(id) => <NumberInput id={id} allowEmpty placeholder="route default" value={f.freightUsd} onChange={set("freightUsd")} min={0} step={50} suffix="USD" />}
              </Field>
            </Advanced>
          </Group>

          <Group title="Dates & customs facts">
            <div className="grid grid-cols-2 gap-4">
              <Field label="LC opened" hint={`On/before ${prettyDate(LC_CUTOFF)} exempts the temporary surcharge.`}>
                {(id) => <DateInput id={id} value={f.lcOpenedDate} onChange={set("lcOpenedDate")} />}
              </Field>
              <Field label="Rules as of">
                {(id) => <DateInput id={id} value={f.asOfDate} onChange={set("asOfDate")} />}
              </Field>
            </div>
            <Advanced title="Customs reassessment">
              <Field label="Assessed customs value" hint="If Customs reassessed above your declared CIF.">
                {(id) => <NumberInput id={id} allowEmpty placeholder="declared CIF used" value={f.assessedCustomsValueLkr} onChange={set("assessedCustomsValueLkr")} min={0} step={10000} suffix="LKR" />}
              </Field>
            </Advanced>
          </Group>

          <Group title="Colombo & registration">
            <Switch checked={f.includeRegistration} onChange={set("includeRegistration")} label="Include DMT registration" hint="First registration, plates, year-one revenue licence." />
            <Switch checked={f.registrationAgentFee} onChange={set("registrationAgentFee")} label="Use a registration agent" hint="Optional LKR 10,000 line." />
            <Switch checked={f.includeDemurrageContingency} onChange={set("includeDemurrageContingency")} label="Add demurrage contingency" hint="Buffer for delays beyond free days." />
            <Advanced title="Override clearance fees">
              <Field label="Clearing agent (CHA)">{(id) => <NumberInput id={id} allowEmpty placeholder="40,000 default" value={f.clearingAgentLkr} onChange={set("clearingAgentLkr")} min={0} step={1000} suffix="LKR" />}</Field>
              <Field label="Port → yard transport">{(id) => <NumberInput id={id} allowEmpty placeholder="18,000 default" value={f.localTransportLkr} onChange={set("localTransportLkr")} min={0} step={1000} suffix="LKR" />}</Field>
            </Advanced>
          </Group>

          <button type="button" onClick={() => setF(initialForm())} className="btn-ghost w-full !py-2.5 !text-[14px]">
            <RotateCcw size={14} /> Reset to demo Prius
          </button>
        </form>

        {/* ── Results ── */}
        <div id="breakdown" className="space-y-5 lg:sticky lg:top-24">
          {/* print-only quote header */}
          <div className="hidden print:block">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <Logo />
              <p className="font-mono text-[11px] text-mute">
                Landed Cost Statement · {new Date().toISOString().slice(0, 10)}
              </p>
            </div>
            <p className="mt-3 text-[14px]">
              {v.year} {v.makeName} {v.modelName} {v.variantCode ?? ""} · {FUEL_LABELS[v.fuelType]} ·{" "}
              {v.engineCc ?? v.motorKw}{unit} · {f.method.toUpperCase()} {f.originPortCode} → LKCMB
            </p>
            <p className="mt-1 font-mono text-[11px] text-faint">
              rule-set {ruleVersion} · LC {f.lcOpenedDate || "—"} · B/L {f.blDate || "—"} · as-of {f.asOfDate}
            </p>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {error ? (
              <m.div
                key="err"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-2xl border p-5"
                style={{ borderColor: "color-mix(in srgb, var(--est) 45%, transparent)" }}
              >
                <p className="flex items-center gap-2 font-medium" style={{ color: "var(--est)" }}>
                  <Sparkles size={15} aria-hidden /> One more detail needed
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-mute">{error}</p>
              </m.div>
            ) : result ? (
              <m.div key="res" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                {!result.eligibility.importable && (
                  <div className="rounded-2xl border p-5" role="alert"
                    style={{ borderColor: "color-mix(in srgb, var(--low) 50%, transparent)", background: "color-mix(in srgb, var(--low) 7%, transparent)" }}>
                    <p className="flex items-center gap-2 font-medium" style={{ color: "var(--low)" }}>
                      <OctagonX size={16} aria-hidden /> Not importable as specified
                    </p>
                    {result.eligibility.reasons.map((r) => (
                      <p key={r} className="mt-2 text-[13.5px] leading-relaxed text-mute">{r}</p>
                    ))}
                  </div>
                )}

                <div className="glass rounded-3xl p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <TotalsSummary result={result} />
                    <div data-noprint className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => window.print()} aria-label="Print quote"
                        className="grid size-10 place-items-center rounded-full border border-line text-mute transition-colors hover:border-accent/60 hover:text-ink">
                        <Printer size={15} />
                      </button>
                      <button type="button" onClick={copyJson} aria-label="Copy result JSON"
                        className="grid size-10 place-items-center rounded-full border border-line text-mute transition-colors hover:border-accent/60 hover:text-ink">
                        {copied ? <Check size={15} style={{ color: "var(--ok)" }} /> : <Copy size={15} />}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    <ConfidenceChip level={result.minConfidenceTouched} />
                    {whatIf && (
                      <span className="rounded-full border border-line-soft px-3 py-1 text-[12px] text-mute">
                        {whatIf.applied
                          ? <>LC on/before {prettyDate(LC_CUTOFF)} would save <span className="num text-ink">{lkr(whatIf.delta)}</span></>
                          : <>Your pre-cutoff LC is saving <span className="num" style={{ color: "var(--ok)" }}>{lkr(whatIf.delta)}</span></>}
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-line-soft bg-card p-5 sm:p-6 md:pl-10">
                  <Waterfall result={result} />
                </div>

                <WarningsPanel warnings={result.warnings} />

                <p className="hidden text-[11px] leading-relaxed text-faint print:block">
                  Estimates with dated rule-set provenance — not customs brokerage, legal, or tax
                  advice. Verify with a licensed Customs House Agent and Sri Lanka Customs before
                  financial commitment. © 2026 JSL Imports.
                </p>
              </m.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {/* mobile summary bar */}
      {result && !error && (
        <div data-noprint className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 px-5 py-3 backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div>
              <p className="text-[11px] text-faint">On-road</p>
              <p className="num text-[17px] font-semibold">LKR {compactLkr(result.totals.onRoadLkr)}</p>
            </div>
            <a href="#breakdown" className="btn-primary !px-4 !py-2 !text-[13px]">View breakdown</a>
          </div>
        </div>
      )}
    </section>
  );
}
