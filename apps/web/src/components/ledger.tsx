import { useMemo } from "react";
import { m, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info, OctagonX } from "lucide-react";
import type { CalcResult, CalcWarning, Confidence, StepResult } from "@jsl/calc-engine/browser";
import { useCountUp, useInViewOnce } from "@/hooks";
import { lkr, plain } from "@/lib/format";

/* ── Confidence ── */
export const CONF_META: Record<Confidence, { label: string; color: string }> = {
  verified: { label: "verified", color: "var(--ok)" },
  "verified-secondary": { label: "verified·2°", color: "var(--ok)" },
  reported: { label: "reported", color: "var(--rep)" },
  estimate: { label: "estimate", color: "var(--est)" },
  low: { label: "low", color: "var(--low)" },
};

export function ConfidenceDot({ level }: { level: Confidence }) {
  const meta = CONF_META[level];
  return (
    <span
      title={meta.label}
      aria-label={`confidence: ${meta.label}`}
      className="mt-[7px] inline-block size-[7px] shrink-0 rounded-full"
      style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}55` }}
    />
  );
}

export function ConfidenceChip({ level }: { level: Confidence }) {
  const meta = CONF_META[level];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px]"
      style={{ color: meta.color, borderColor: `color-mix(in srgb, ${meta.color} 40%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

export function ConfidenceLegend() {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Confidence legend">
      {(["verified", "reported", "estimate", "low"] as Confidence[]).map((c) => (
        <ConfidenceChip key={c} level={c} />
      ))}
    </div>
  );
}

/* ── Animated LKR figure ── */
export function LkrCounter({
  value, className, duration = 900,
}: { value: number; className?: string; duration?: number }) {
  const v = useCountUp(value, duration);
  return <span className={`num ${className ?? ""}`}>{lkr(v)}</span>;
}

/* ── The waterfall ledger (signature element) ── */
const GROUPS: { id: StepResult["group"]; title: string }[] = [
  { id: "japan", title: "Japan side → FOB" },
  { id: "freight", title: "Freight & CIF" },
  { id: "customs", title: "Customs & taxes" },
  { id: "local", title: "Colombo clearance" },
  { id: "registration", title: "Registration" },
  { id: "total", title: "Totals" },
];

function Row({ step, animate, index }: { step: StepResult; animate: boolean; index: number }) {
  const waived = step.amountLkr === 0 && step.group === "customs";
  const isTotal = step.group === "total";
  return (
    <m.li
      initial={animate ? { opacity: 0, x: -10 } : false}
      whileInView={animate ? { opacity: 1, x: 0 } : undefined}
      viewport={animate ? { once: true, margin: "-40px" } : undefined}
      transition={{ duration: 0.45, delay: (index % 12) * 0.04, ease: "easeOut" }}
      className={`ledger-row border-b border-line-soft py-2.5 last:border-0 ${isTotal ? "py-3.5" : ""}`}
    >
      <ConfidenceDot level={step.confidence} />
      <div className="min-w-0">
        <p className={`truncate text-[14px] ${isTotal ? "font-semibold text-ink" : "text-ink"}`}>{step.label}</p>
        <p className="mt-0.5 truncate font-mono text-[11.5px] text-faint sm:hidden" title={step.formula}>
          {step.formula}
        </p>
      </div>
      <p
        className="hidden min-w-0 truncate self-center font-mono text-[12px] text-faint sm:block"
        title={[step.formula, ...(step.notes ?? [])].join(" · ")}
      >
        {step.formula}
      </p>
      <div className="text-right">
        <p className={`num text-[14px] ${waived ? "text-faint" : isTotal ? "text-[16px] font-semibold text-ink" : "text-ink"}`}>
          {waived ? "LKR 0" : lkr(step.amountLkr)}
        </p>
        {step.runningTotalLkr != null && !isTotal && (
          <p className="num text-[11px] text-faint">Σ {plain(step.runningTotalLkr)}</p>
        )}
      </div>
    </m.li>
  );
}

export function Waterfall({
  result, animate = false, className,
}: { result: CalcResult; animate?: boolean; className?: string }) {
  const [railRef, railSeen] = useInViewOnce<HTMLDivElement>("-40px");
  const grouped = useMemo(
    () =>
      GROUPS.map((g) => ({ ...g, rows: result.steps.filter((s) => s.group === g.id) })).filter(
        (g) => g.rows.length
      ),
    [result]
  );

  return (
    <div ref={railRef} className={`relative ${className ?? ""}`}>
      {/* running-total rail */}
      <m.span
        aria-hidden="true"
        className="absolute -left-4 top-2 bottom-2 hidden w-px origin-top md:block"
        style={{ background: "linear-gradient(180deg, var(--accent), transparent)" }}
        initial={animate ? { scaleY: 0 } : false}
        animate={railSeen || !animate ? { scaleY: 1 } : undefined}
        transition={{ duration: 1.4, ease: "easeOut" }}
      />
      {grouped.map((g) => (
        <section key={g.id} aria-label={g.title} className="mb-5 last:mb-0">
          <div className="mb-1 flex items-baseline justify-between gap-4">
            <h3 className="eyebrow">{g.title}</h3>
            <span className="divider-x hidden grow sm:block" />
          </div>
          <ul>
            {g.rows.map((s, i) => (
              <Row key={s.id} step={s} animate={animate} index={i} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ── Totals summary ── */
export function TotalsSummary({ result, big = true }: { result: CalcResult; big?: boolean }) {
  const t = result.totals;
  return (
    <div aria-live="polite">
      <p className="eyebrow">Final on-road cost</p>
      <LkrCounter
        value={t.onRoadLkr}
        className={`mt-1 block font-display font-bold tracking-tight text-ink ${
          big ? "text-4xl sm:text-5xl" : "text-3xl"
        }`}
      />
      <dl className="mt-4 grid grid-cols-3 gap-3 text-[13px]">
        {[
          ["CIF", t.cifLkr],
          [`Import taxes · ${t.effectiveTaxPctOfCif}% of CIF`, t.importTaxesLkr],
          ["Landed at port", t.landedAtPortLkr],
        ].map(([label, v]) => (
          <div key={label as string} className="rounded-xl border border-line-soft bg-surface px-3 py-2.5">
            <dt className="truncate text-faint" title={label as string}>{label}</dt>
            <dd className="num mt-0.5 text-ink">{lkr(v as number)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ── Warnings & assumptions ── */
const SEV_META = {
  info: { icon: Info, color: "var(--rep)" },
  warn: { icon: AlertTriangle, color: "var(--est)" },
  error: { icon: OctagonX, color: "var(--low)" },
} as const;

export function WarningsPanel({ warnings }: { warnings: CalcWarning[] }) {
  if (!warnings.length) return null;
  return (
    <section aria-label="Warnings and assumptions" className="rounded-2xl border border-line-soft bg-surface p-4">
      <h3 className="eyebrow mb-3">Warnings & assumptions</h3>
      <ul className="space-y-2.5">
        <AnimatePresence initial={false}>
          {warnings.map((w) => {
            const M = SEV_META[w.severity];
            return (
              <m.li
                key={w.code + w.message}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="flex gap-2.5 overflow-hidden text-[13px] leading-relaxed text-mute"
              >
                <M.icon size={15} className="mt-0.5 shrink-0" style={{ color: M.color }} aria-hidden />
                <span>
                  <span className="font-mono text-[11px]" style={{ color: M.color }}>{w.code}</span>{" "}
                  {w.message}
                </span>
              </m.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </section>
  );
}
