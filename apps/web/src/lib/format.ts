const nf0 = new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 });

export const lkr = (n: number): string => `LKR ${nf0.format(Math.round(n))}`;
export const jpy = (n: number): string => `¥${nf0.format(Math.round(n))}`;
export const plain = (n: number): string => nf0.format(Math.round(n));

/** 22 232 221 → "22.23M" — for chips and tight spots. */
export const compactLkr = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return nf0.format(Math.round(n));
};

export const todayIso = (): string => new Date().toISOString().slice(0, 10);

export const addDaysIso = (iso: string, days: number): string => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const prettyDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
