/**
 * Lagged correlation between a commodity price change and a CPI rate. Pure and
 * dependency-free so it can be tested on its own.
 *
 * Both series are 12-month changes, so neighbouring months overlap heavily:
 * a correlation computed from them describes how closely the two curves move
 * together, not how many independent observations support the relationship.
 */

export type Monthly = Map<string, number>;

/** `ds` ("YYYY-MM-01") moved by `months` calendar months. */
export function shiftMonth(ds: string, months: number): string {
  const total = Number(ds.slice(0, 4)) * 12 + Number(ds.slice(5, 7)) - 1 + months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/** 12-month percentage change of a monthly price series, keyed by month. */
export function yearOnYear(prices: { date: string; value: number }[]): Monthly {
  const byDate = new Map(prices.map((p) => [p.date, p.value]));
  const out: Monthly = new Map();
  for (const [ds, value] of byDate) {
    const before = byDate.get(shiftMonth(ds, -12));
    if (before !== undefined && before > 0) out.set(ds, (value / before - 1) * 100);
  }
  return out;
}

/**
 * Pearson correlation between `cpi` at month t and `commodity` at month
 * t − `lag` (the commodity leads by `lag` months), over months in
 * [from, to). Null when fewer than `minPoints` months overlap or either side
 * is constant.
 */
export function correlationAtLag(commodity: Monthly, cpi: Monthly, lag: number, from: string, to: string, minPoints = 24): number | null {
  const x: number[] = [];
  const y: number[] = [];
  for (const [ds, rate] of cpi) {
    if (ds < from || ds >= to) continue;
    const lead = commodity.get(shiftMonth(ds, -lag));
    if (lead !== undefined) {
      x.push(lead);
      y.push(rate);
    }
  }
  if (x.length < minPoints) return null;
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const [mx, my] = [mean(x), mean(y)];
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy);
}

export type LagProfile = { lag: number; r: number | null }[];

export function lagProfile(commodity: Monthly, cpi: Monthly, maxLag: number, from: string, to: string): LagProfile {
  return Array.from({ length: maxLag + 1 }, (_, lag) => ({ lag, r: correlationAtLag(commodity, cpi, lag, from, to) }));
}

/** The lag with the highest correlation, or null if none could be computed. */
export function bestLag(profile: LagProfile): { lag: number; r: number } | null {
  let best: { lag: number; r: number } | null = null;
  for (const { lag, r } of profile) if (r !== null && (best === null || r > best.r)) best = { lag, r };
  return best;
}
