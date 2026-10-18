import type { Crop, CropData, Manifest, Observation, Point } from './types.ts';
import { changeFromBaseline } from './data.ts';

export const CROPS: readonly Crop[] = ['wheat', 'maize', 'rice'];
export const isCrop = (value: string): value is Crop => (CROPS as readonly string[]).includes(value);

/** URL slug for a country name: "Côte d'Ivoire" → "cote-d-ivoire". */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type CountryRef = { id: string; name: string; slug: string };

/** Every country in the manifest with its slug, sorted by name. Slugs must be unique: they are URLs. */
export function countryRefs(manifest: Pick<Manifest, 'countries'>): CountryRef[] {
  const refs = Object.values(manifest.countries)
    .map(c => ({ id: c.id, name: c.name, slug: slugify(c.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const seen = new Map<string, string>();
  for (const ref of refs) {
    const clash = seen.get(ref.slug);
    if (clash) throw new Error(`Countries ${clash} and ${ref.id} share the URL slug "${ref.slug}"`);
    seen.set(ref.slug, ref.id);
  }
  return refs;
}

export type Ranked = { id: string; production: number };

/** Countries with a reported production for the year, largest first. */
export function ranked(data: CropData, year: number): Ranked[] {
  return Object.entries(data.countries)
    .flatMap(([id, history]) => {
      const production = history[String(year)]?.production;
      return production == null ? [] : [{ id, production }];
    })
    .sort((a, b) => b.production - a.production);
}

/**
 * Countries with production in the crop's latest year, which is what the
 * site's pages exist for. Countries that stopped reporting keep their history
 * on the map, but a page of facts about them would have no current figure.
 */
export function producers(data: CropData): string[] {
  const latest = String(data.years[data.years.length - 1]);
  return Object.entries(data.countries)
    .filter(([, history]) => history[latest]?.production != null)
    .map(([id]) => id);
}

export type CountryProfile = {
  id: string;
  year: number;
  observation: Observation | null;
  /** 1-based position among reporting countries, or null if the country reports nothing that year. */
  rank: number | null;
  of: number;
  /** Percent of the covered total (reporting countries and territories only). */
  share: number | null;
  /** Percent change against the mean of the five preceding years. */
  change: number | null;
  history: Point[];
};

export function profileFor(data: CropData, country: string, year: number): CountryProfile {
  const history = data.countries[country] ?? {};
  const observation = history[String(year)] ?? null;
  const order = ranked(data, year);
  const total = order.reduce((sum, r) => sum + r.production, 0);
  const index = order.findIndex(r => r.id === country);
  const production = observation?.production;
  return {
    id: country,
    year,
    observation,
    rank: index === -1 ? null : index + 1,
    of: order.length,
    share: production != null && total > 0 ? (production / total) * 100 : null,
    change: changeFromBaseline(history, year),
    history: Object.entries(history)
      .flatMap(([y, o]) => (o.production == null ? [] : [{ date: `${y}-01-01`, value: o.production }]))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/**
 * World production change against the mean of the five preceding years,
 * measured only over countries that report all six years. Using one fixed
 * set of countries keeps coverage jumps (new countries entering the data)
 * from reading as harvest swings.
 */
export function worldChange(data: CropData, year: number): number | null {
  let current = 0;
  let baseline = 0;
  for (const history of Object.values(data.countries)) {
    const now = history[String(year)]?.production;
    const prior = Array.from({ length: 5 }, (_, i) => history[String(year - i - 1)]?.production);
    if (now == null || prior.some(p => p == null)) continue;
    current += now;
    baseline += (prior as number[]).reduce((a, b) => a + b, 0) / 5;
  }
  return baseline > 0 ? (current / baseline - 1) * 100 : null;
}

/** One value per year of `data.years`: null where the change cannot be measured. */
export const worldStripes = (data: CropData): (number | null)[] => data.years.map(y => worldChange(data, y));
export const countryStripes = (data: CropData, country: string): (number | null)[] =>
  data.years.map(y => changeFromBaseline(data.countries[country] ?? {}, y));

export type Leader = { id: string; production: number } | null;

/** The largest producer in each year of `data.years`. */
export function leaders(data: CropData): Leader[] {
  return data.years.map(year => ranked(data, year)[0] ?? null);
}

export type LeaderTally = { id: string; years: number };

/** Countries that led at least one year, most years first. */
export function leaderTally(all: Leader[]): LeaderTally[] {
  const tally = new Map<string, number>();
  for (const leader of all) if (leader) tally.set(leader.id, (tally.get(leader.id) ?? 0) + 1);
  return [...tally].map(([id, years]) => ({ id, years })).sort((a, b) => b.years - a.years);
}

/** Every country that is in the top `n` in at least one year, so a race can keep stable rows. */
export function everInTop(data: CropData, n: number): string[] {
  const ids = new Set<string>();
  for (const year of data.years) for (const r of ranked(data, year).slice(0, n)) ids.add(r.id);
  return [...ids];
}

export type WorldTotals = { production: number; area: number; yield: number | null; countries: number };

/** Production, harvested area and the implied yield over countries reporting both. */
export function worldTotals(data: CropData, year: number): WorldTotals {
  let production = 0;
  let area = 0;
  let countries = 0;
  for (const history of Object.values(data.countries)) {
    const o = history[String(year)];
    if (o?.production == null || o.area == null) continue;
    production += o.production;
    area += o.area;
    countries++;
  }
  return { production, area, yield: area > 0 ? production / area : null, countries };
}

/** Mean of the monthly benchmark prices in a calendar year, or null if the year has none. */
export function meanPrice(prices: Point[], year: number): number | null {
  const values = prices.filter(p => p.date.startsWith(`${year}-`)).map(p => p.value);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
