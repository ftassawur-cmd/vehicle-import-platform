import type { Currency, FxRules, Money } from "./types.js";

/** Round to whole rupees — statutory duty lines (ADR-004). */
export const r0 = (n: number): number => Math.round(n);
/** Round to cents — display / non-statutory lines. */
export const r2 = (n: number): number => Math.round(n * 100) / 100;

export interface FxUse { pair: string; rate: number; asOf: string }

export class FxBook {
  private map = new Map<string, { rate: number; asOf: string; stale: boolean }>();
  readonly uses: FxUse[] = [];
  constructor(fx: FxRules) {
    for (const r of fx.rates) this.map.set(r.pair, { rate: r.rate, asOf: r.asOf, stale: !!r.stale });
  }
  /** Convert to LKR, recording the rate used. LKR passes through. */
  toLkr(m: Money): { lkr: number; use?: FxUse; stale?: boolean } {
    if (m.currency === "LKR") return { lkr: m.amount };
    const pair = `${m.currency}/LKR`;
    const hit = this.map.get(pair);
    if (!hit) throw new Error(`No exchange rate configured for ${pair}. Add it in Admin Panel > Exchange Rates.`);
    const use = { pair, rate: hit.rate, asOf: hit.asOf };
    this.uses.push(use);
    return { lkr: m.amount * hit.rate, use, stale: hit.stale };
  }
  hasStale(): boolean {
    return [...this.map.values()].some((v) => v.stale);
  }
}

const nf = new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 });
export const fmtLkr = (n: number): string => `LKR ${nf.format(r0(n))}`;
export const fmt = (n: number, ccy: Currency): string =>
  ccy === "LKR" ? fmtLkr(n) : `${ccy === "JPY" ? "¥" : ccy === "USD" ? "$" : ccy + " "}${nf.format(Math.round(n))}`;

export const yearsBetween = (fromIso: string, toIso: string): number =>
  (new Date(toIso).getTime() - new Date(fromIso).getTime()) / (365.25 * 24 * 3600 * 1000);

export const within = (dateIso: string, from?: string, to?: string | null): boolean => {
  const t = new Date(dateIso).getTime();
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime() + 86_399_000) return false;
  return true;
};
