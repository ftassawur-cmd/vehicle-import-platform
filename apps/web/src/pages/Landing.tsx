import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, GitBranch, CalendarClock } from "lucide-react";
import { calculate } from "@jsl/calc-engine/browser";
import { rules, ruleVersion, tempSurcharge, vehicleClasses, LC_CUTOFF } from "@/lib/rules";
import { DEMO_INPUTS } from "@/lib/presets";
import { usePageMeta } from "@/hooks";
import { prettyDate } from "@/lib/format";
import { Reveal, Starfield } from "@/components/chrome";
import { RouteMap } from "@/components/RouteMap";
import { HeroQuoteCard } from "@/components/HeroQuoteCard";
import { ConfidenceLegend, Waterfall } from "@/components/ledger";

const STATS = [
  ["10", "config rule domains"],
  ["12", "point verification queue"],
  ["<1 ms", "in-browser previews"],
  ["100%", "reproducible quotes"],
] as const;

const STAGES = [
  { code: "FOB", title: "Win the auction", body: "Hammer price plus nine Japan-side lines — auction fee, JAAI inspection, inland transport, export papers — through loading at the origin port. Smart defaults for every line, all overridable." },
  { code: "CIF", title: "Cross the ocean", body: "RoRo or shared container to Colombo, marine insurance computed or entered. FX conversions happen once per line at dated, recorded rates." },
  { code: "DUTY", title: "Clear customs", body: "CID, both surcharges, excise by capacity and age, luxury tax on the CIF excess, SSCL, then VAT on the whole uplifted base — each line shows its formula and source." },
  { code: "DMT", title: "Get on the road", body: "Port handling, agent and bank charges, then first registration, plates and the year-one revenue licence. The number at the bottom is the one that leaves your account." },
] as const;

const FAQS = [
  {
    q: "Are these figures official?",
    a: "No — they're estimates built from gazettes, the Customs tariff guide and reported schedules. Every line carries a confidence badge and a source reference; anything unverified renders amber and is listed in the assumptions appendix. Confirm with a licensed Customs House Agent before committing funds.",
  },
  {
    q: "Why does my LC opening date change the total?",
    a: `The temporary 50% surcharge (Gazette 2488/56) exempts vehicles whose letter of credit was opened on or before ${prettyDate(LC_CUTOFF)}. Post-cutoff LC amendments void the exemption. The calculator applies the right treatment from your date and shows the difference.`,
  },
  {
    q: "How old a vehicle can I import?",
    a: "Limits are per class under the Imports & Exports (Control) Regulations No. 01 of 2025 — 3 years for cars and SUVs, 5 for vans, 4 for pickups — measured from first registration to the bill-of-lading date. Ineligible builds are blocked with the reason stated.",
  },
  {
    q: "Can I override the defaults?",
    a: "Everything. Japan-side fees, freight, insurance, clearing charges and the assessed customs value all accept your actual figures; overridden lines flip from amber (estimate) to green (verified) in the ledger.",
  },
  {
    q: "RoRo or container?",
    a: "RoRo is simpler and usually faster (14–21 days from Yokohama); a shared 40 ft container trades handling for a lower ocean rate. Switch methods in the calculator — port-side charges re-price automatically.",
  },
] as const;

export default function Landing() {
  usePageMeta(
    "JSL Imports — Japan → Sri Lanka landed-cost calculator",
    "Price any Japan-auction vehicle to your Colombo doorstep. Every duty line itemised and sourced. Estimates with receipts."
  );

  const demo = useMemo(() => calculate(DEMO_INPUTS, rules), []);
  const lux = rules.luxury;

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden pb-20 pt-32 sm:pt-36">
        <Starfield className="absolute inset-0 -z-10 h-full w-full" />
        <div
          aria-hidden
          className="absolute left-1/2 top-0 -z-10 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-40 blur-[120px]"
          style={{ background: "radial-gradient(closest-side, var(--glow), transparent)" }}
        />
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-[1.02fr_0.98fr]">
          <div>
            <Reveal>
              <p className="eyebrow">Japan → Sri Lanka · rule-set {ruleVersion}</p>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="mt-4 font-display text-[42px] font-bold leading-[1.04] tracking-tight sm:text-[58px]">
                Know the on-road cost <span className="text-accent">before you bid.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-mute">
                JSL Imports prices any Japan-auction vehicle to your Colombo doorstep — CIF, duty,
                surcharges, excise, luxury tax, SSCL and VAT — every rupee traced to a gazette,
                every estimate flagged.
              </p>
            </Reveal>
            <Reveal delay={0.18} className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/calculator" className="btn-primary">
                Price a vehicle <ArrowRight size={16} />
              </Link>
              <a href="#math" className="btn-ghost">See the math</a>
            </Reveal>
            <Reveal delay={0.24}>
              <dl className="mt-12 grid max-w-lg grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
                {STATS.map(([v, l]) => (
                  <div key={l}>
                    <dt className="sr-only">{l}</dt>
                    <dd className="num text-[22px] font-medium text-ink">{v}</dd>
                    <dd className="mt-0.5 text-[12px] leading-snug text-faint">{l}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          <div className="relative">
            <RouteMap className="absolute -top-16 left-1/2 -z-10 w-[min(640px,120%)] -translate-x-1/2 opacity-70" />
            <Reveal delay={0.15} y={26}>
              <div className="motion-safe:animate-float-y">
                <HeroQuoteCard />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── The math ── */}
      <section id="math" className="relative scroll-mt-24 border-t border-line-soft py-24">
        <div className="bg-grid absolute inset-0 -z-10" aria-hidden />
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">The signature</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              The whole stack, itemised.
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-mute">
              This is the demo Prius from the card above — all {demo.steps.length} lines of it.
              Every figure prints its formula; every source wears its confidence. Transparency
              isn't a disclaimer here, it's the product.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="mt-8">
            <ConfidenceLegend />
          </Reveal>
          <div className="glass mt-8 rounded-3xl p-5 sm:p-8 md:pl-12">
            <Waterfall result={demo} animate />
          </div>
        </div>
      </section>

      {/* ── Journey ── */}
      <section className="border-t border-line-soft py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">From hammer to number plate</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Four stages. One honest number.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STAGES.map((s, i) => (
              <Reveal key={s.code} delay={i * 0.07}>
                <article className="group relative h-full rounded-2xl border border-line-soft bg-surface p-6 transition-colors hover:border-accent/50">
                  <p className="num text-[13px] font-medium text-accent">{s.code}</p>
                  <h3 className="mt-3 font-display text-[18px] font-bold tracking-tight">{s.title}</h3>
                  <p className="mt-2.5 text-[14px] leading-relaxed text-mute">{s.body}</p>
                  {i < STAGES.length - 1 && (
                    <ArrowRight
                      size={15}
                      aria-hidden
                      className="absolute -right-[11px] top-7 hidden text-faint lg:block"
                    />
                  )}
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 2026 rules ── */}
      <section id="rules" className="scroll-mt-24 border-t border-line-soft py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">Current regime</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Built for the 2026 rules.
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-mute">
              These cards render straight from the versioned rule-set — when a gazette changes,
              the site changes with it, and old quotes stay reproducible on the rules they used.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            <Reveal>
              <article className="h-full rounded-2xl border border-line-soft bg-surface p-6">
                <CalendarClock size={18} className="text-accent" aria-hidden />
                <h3 className="mt-4 font-display text-[17px] font-bold tracking-tight">
                  Temporary surcharge window
                </h3>
                <p className="num mt-2 text-[26px] font-medium text-ink">
                  {tempSurcharge?.ratePct ?? 50}%<span className="text-[14px] text-faint"> on CID + standing surcharge</span>
                </p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-mute">
                  In force {prettyDate(tempSurcharge?.effectiveFrom ?? "2026-05-16")} – {prettyDate(tempSurcharge?.effectiveTo ?? "2026-08-15")}.
                  Exempt if your LC opened on or before {prettyDate(LC_CUTOFF)} — the calculator
                  applies it from your dates, not assumptions.
                </p>
              </article>
            </Reveal>

            <Reveal delay={0.07}>
              <article className="h-full rounded-2xl border border-line-soft bg-surface p-6">
                <ShieldCheck size={18} className="text-accent" aria-hidden />
                <h3 className="mt-4 font-display text-[17px] font-bold tracking-tight">
                  Import age limits, per class
                </h3>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {vehicleClasses.slice(0, 8).map((c) => (
                    <li key={c.id} className="rounded-full border border-line-soft px-3 py-1.5 text-[12.5px] text-mute">
                      {c.label} · <span className="num text-ink">{c.maxImportAgeYears}y</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[13.5px] leading-relaxed text-mute">
                  First registration → bill-of-lading date. Over-age builds are blocked, with the
                  regulation cited.
                </p>
              </article>
            </Reveal>

            <Reveal delay={0.14}>
              <article className="h-full rounded-2xl border border-line-soft bg-surface p-6">
                <GitBranch size={18} className="text-accent" aria-hidden />
                <h3 className="mt-4 font-display text-[17px] font-bold tracking-tight">
                  Luxury tax thresholds
                </h3>
                <table className="mt-4 w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-faint">
                      <th className="pb-2 font-normal">Propulsion</th>
                      <th className="pb-2 text-right font-normal">CIF threshold</th>
                      <th className="pb-2 text-right font-normal">On excess</th>
                    </tr>
                  </thead>
                  <tbody className="text-mute">
                    {([
                      ["Petrol", "petrol"],
                      ["Diesel", "diesel"],
                      ["Hybrid", "petrolHybrid"],
                      ["Electric", "ev"],
                    ] as const).map(([label, key]) => (
                      <tr key={key} className="border-t border-line-soft">
                        <td className="py-2">{label}</td>
                        <td className="num py-2 text-right text-ink">
                          {(lux.thresholdsLkr[key] / 1_000_000).toFixed(1)}M
                        </td>
                        <td className="num py-2 text-right text-ink">{lux.ratePctOnExcess[key]}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Transparency ── */}
      <section className="border-t border-line-soft py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">Accuracy posture</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Estimates, with receipts.
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-mute">
              Twelve open verification questions gate commercial launch — and until each closes,
              the product tells you so, line by line, instead of pretending.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              ["Confidence is a field, not a footnote", "Every rule value carries verified / reported / estimate and a source reference. The engine propagates the weakest confidence it touched into your result."],
              ["Rule-sets are versioned data", "Rates live in dated, versioned payloads — never in code. Each quote records the exact versions used, so it re-computes identically after any gazette change."],
              ["Dates drive the math", "Surcharges carry effective windows and conditions. Your LC date, B/L date and as-of date select the rules — what-ifs are a one-field change."],
            ].map(([h, b], i) => (
              <Reveal key={h} delay={i * 0.07}>
                <article className="h-full rounded-2xl border border-line-soft bg-surface p-6">
                  <h3 className="font-display text-[17px] font-bold tracking-tight">{h}</h3>
                  <p className="mt-2.5 text-[14px] leading-relaxed text-mute">{b}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="scroll-mt-24 border-t border-line-soft py-24">
        <div className="mx-auto max-w-3xl px-5">
          <Reveal>
            <p className="eyebrow">Questions</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Asked before every bid.
            </h2>
          </Reveal>
          <div className="mt-10 space-y-3">
            {FAQS.map((f, i) => (
              <Reveal key={f.q} delay={i * 0.05}>
                <details className="group rounded-2xl border border-line-soft bg-surface open:border-line">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15.5px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span aria-hidden className="text-faint transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="px-5 pb-5 text-[14.5px] leading-relaxed text-mute">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-line-soft py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <div className="glass relative overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-12">
              <div
                aria-hidden
                className="absolute left-1/2 top-1/2 -z-10 h-[300px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 blur-[100px]"
                style={{ background: "radial-gradient(closest-side, var(--glow), transparent)" }}
              />
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Price your next bid.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[15.5px] text-mute">
                Six market presets, or your exact build — the full ledger updates as you type.
              </p>
              <Link to="/calculator" className="btn-primary mt-8">
                Open the calculator <ArrowRight size={16} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
