import { leaders, ranked } from './crops.ts';
import type { CropData } from './types.ts';

export type Overtake = {
  /** Year the new leader first led. */
  year: number;
  from: string;
  to: string;
  /** The latest year, with each country's production in it where reported. */
  latestYear: number;
  toProduction: number | null;
  fromProduction: number | null;
};

/**
 * The most recent change in the world's largest producer, if it happened
 * within `within` years of the latest data. A change only counts when the
 * former leader is still reporting: a country dropping out of the data is a
 * gap, not an overtake.
 */
export function leaderChange(data: CropData, within = 5): Overtake | null {
  const lead = leaders(data);
  const { years } = data;
  const latestYear = years[years.length - 1];
  for (let i = lead.length - 1; i > 0; i--) {
    const now = lead[i];
    const before = lead[i - 1];
    if (!now || !before) return null;
    if (now.id === before.id) continue;
    if (latestYear - years[i] > within) return null;
    if (data.countries[before.id]?.[String(years[i])]?.production == null) return null;
    const latest = ranked(data, latestYear);
    const production = (id: string) => latest.find(r => r.id === id)?.production ?? null;
    return { year: years[i], from: before.id, to: now.id, latestYear, toProduction: production(now.id), fromProduction: production(before.id) };
  }
  return null;
}

/** "India overtook China as the world's largest rice producer in 2023 (217.9M t to 207.5M t in 2024)." */
export function overtakeText(o: Overtake, cropName: string, nameOf: (id: string) => string, format: (tonnes: number) => string): { text: string; short: string } {
  const [to, from, crop] = [nameOf(o.to), nameOf(o.from), cropName.toLowerCase()];
  const figures = o.toProduction != null && o.fromProduction != null ? ` (${format(o.toProduction)} to ${format(o.fromProduction)} in ${o.latestYear})` : '';
  return { text: `${to} overtook ${from} as the world's largest ${crop} producer in ${o.year}${figures}.`, short: `${to} overtook ${from} as the top ${crop} producer in ${o.year}` };
}
