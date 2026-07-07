import { useMemo, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Ship, Gavel, Fuel } from "lucide-react";
import { calculate } from "@jsl/calc-engine/browser";
import { rules, ruleVersion } from "@/lib/rules";
import { DEMO_INPUTS } from "@/lib/presets";
import { lkr } from "@/lib/format";
import { Segmented } from "@/components/fields";
import { ConfidenceChip, LkrCounter } from "@/components/ledger";

type LcMode = "window" | "exempt";

const chip = "inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface px-2.5 py-1 text-[12px] text-mute";

export function HeroQuoteCard() {
  const [lc, setLc] = useState<LcMode>("window");

  const { inWindow, exempt } = useMemo(() => {
    const inWindow = calculate(DEMO_INPUTS, rules);
    const exempt = calculate(
      { ...DEMO_INPUTS, facts: { ...DEMO_INPUTS.facts, lcOpenedDate: "2026-05-10" } },
      rules
    );
    return { inWindow, exempt };
  }, []);

  const result = lc === "window" ? inWindow : exempt;
  const saving = inWindow.totals.onRoadLkr - exempt.totals.onRoadLkr;
  const t = result.totals;

  const segments = useMemo(() => {
    const clearance = t.landedAtPortLkr - t.cifLkr - t.importTaxesLkr;
    const reg = t.onRoadLkr - t.landedAtPortLkr;
    return [
      { label: "CIF", v: t.cifLkr, o: 1 },
      { label: "Import taxes", v: t.importTaxesLkr, o: 0.55 },
      { label: "Clearance", v: clearance, o: 0.3 },
      { label: "Registration", v: reg, o: 0.18 },
    ];
  }, [t]);

  return (
    <div className="glass relative rounded-3xl p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Live estimate · rule-set {ruleVersion}</p>
          <h2 className="mt-1.5 font-display text-[19px] font-bold tracking-tight">
            2022 Toyota Prius <span className="text-mute">ZVW51</span>
          </h2>
        </div>
        <ConfidenceChip level={result.minConfidenceTouched} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className={chip}><Gavel size={12} aria-hidden /> ¥2,300,000 hammer</span>
        <span className={chip}><Ship size={12} aria-hidden /> RoRo · Yokohama → Colombo</span>
        <span className={chip}><Fuel size={12} aria-hidden /> 1.8 petrol hybrid</span>
      </div>

      <div className="mt-6" aria-live="polite">
        <p className="eyebrow">Final on-road cost</p>
        <LkrCounter value={t.onRoadLkr} className="mt-1 block font-display text-4xl font-bold tracking-tight sm:text-[42px]" />
      </div>

      {/* composition bar — monochrome accent ladder */}
      <div className="mt-5">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-line-soft" role="img"
          aria-label={`Cost composition: CIF ${lkr(segments[0]!.v)}, import taxes ${lkr(segments[1]!.v)}, clearance ${lkr(segments[2]!.v)}, registration ${lkr(segments[3]!.v)}`}>
          {segments.map((s) => (
            <m.span
              key={s.label}
              className="h-full border-r border-bg last:border-0"
              style={{ background: "var(--accent)", opacity: s.o }}
              initial={false}
              animate={{ width: `${(s.v / t.onRoadLkr) * 100}%` }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-4">
          {segments.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5 text-faint">
              <span className="size-2 rounded-sm" style={{ background: "var(--accent)", opacity: s.o }} aria-hidden />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-2.5">
        <Segmented<LcMode>
          label="Letter of credit opening date"
          value={lc}
          onChange={setLc}
          options={[
            { value: "window", label: "LC 10 Jun · in window" },
            { value: "exempt", label: "LC 10 May · exempt" },
          ]}
        />
        <div className="min-h-[30px]">
          <AnimatePresence mode="wait" initial={false}>
            {lc === "exempt" ? (
              <m.p
                key="save"
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px]"
                style={{ color: "var(--ok)", borderColor: "color-mix(in srgb, var(--ok) 40%, transparent)" }}
              >
                Saves {lkr(saving)} — pre-cutoff exemption, Gazette 2488/56
              </m.p>
            ) : (
              <m.p
                key="cost"
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="text-[12.5px] text-faint"
              >
                Temporary surcharge applies · 16 May – 15 Aug 2026
              </m.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <a href="#math" className="mt-4 inline-block text-[13.5px] font-medium text-accent hover:underline">
        See every line of this number ↓
      </a>
    </div>
  );
}
