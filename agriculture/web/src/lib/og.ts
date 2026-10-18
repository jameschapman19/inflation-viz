import type { Point } from './types.ts';

export const AMBER = '#e7b45e';
export const AMBER_FILL = 'rgba(231,180,94,0.16)';
export const TEAL = '#76d2b7';
export const TEAL_FILL = 'rgba(118,210,183,0.14)';

export const toSeries = (points: Point[]) => points.map(p => ({ t: Date.parse(p.date), v: p.value }));

/** Latest monthly price and its change against the same month a year earlier. */
export function priceSummary(prices: Point[]): { value: number; yearOnYear: number | null } {
  const latest = prices[prices.length - 1];
  const before = prices.find(p => p.date === `${Number(latest.date.slice(0, 4)) - 1}${latest.date.slice(4)}`);
  return { value: latest.value, yearOnYear: before ? (latest.value / before.value - 1) * 100 : null };
}
