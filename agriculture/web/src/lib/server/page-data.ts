import 'server-only';
import type { Metadata } from 'next';
import { countryRefs, countryStripes, producers, profileFor, ranked, type CountryProfile, type CountryRef, type Ranked } from '../crops.ts';
import { compact, coverage, number } from '../data.ts';
import type { Crop, Forecast, Manifest, Point } from '../types.ts';
import { loadCrop, loadForecast, loadManifest } from './load.ts';

export type ExplorerInitial = {
  year: number;
  years: number[];
  profile: CountryProfile;
  /** Top ten producers in the latest year. */
  top: Ranked[];
  totals: { total: number; countries: number };
  /** Harvest stripes for the entry country, one per year. */
  stripes: (number | null)[];
  prices: Point[];
};

export type ExplorerProps = {
  crop: Crop;
  country: string;
  manifest: Manifest;
  /** Countries that have a page for this crop: the ones that report production. */
  countries: CountryRef[];
  forecast: Forecast | null;
  initial: ExplorerInitial;
};

/** Every crop/country pair that has a page. */
export async function pagePaths(crop: Crop): Promise<{ id: string; slug: string }[]> {
  const [manifest, data] = await Promise.all([loadManifest(), loadCrop(crop)]);
  const slugs = new Map(countryRefs(manifest).map(c => [c.id, c.slug]));
  return producers(data).map(id => {
    const slug = slugs.get(id);
    if (!slug) throw new Error(`${crop} data has country ${id} that the manifest does not list`);
    return { id, slug };
  });
}

/** The page's default country: the largest producer in the latest year. */
export async function defaultCountry(crop: Crop): Promise<string> {
  const data = await loadCrop(crop);
  return ranked(data, data.years[data.years.length - 1])[0].id;
}

export async function resolveSlug(crop: Crop, slug: string): Promise<string | null> {
  return (await pagePaths(crop)).find(p => p.slug === slug)?.id ?? null;
}

export async function explorerProps(crop: Crop, country: string): Promise<ExplorerProps> {
  const [manifest, data, forecast] = await Promise.all([loadManifest(), loadCrop(crop), loadForecast()]);
  const year = data.years[data.years.length - 1];
  const withPages = new Set(producers(data));
  return {
    crop,
    country,
    manifest,
    countries: countryRefs(manifest).filter(c => withPages.has(c.id)),
    forecast,
    initial: {
      year,
      years: data.years,
      profile: profileFor(data, country, year),
      top: ranked(data, year).slice(0, 10),
      totals: coverage(data, year),
      stripes: countryStripes(data, country),
      prices: data.prices,
    },
  };
}

/** Title and description for a crop/country page, built from the same numbers the page shows. */
export async function pageMetadata(crop: Crop, country: string): Promise<Metadata> {
  const [manifest, data, paths] = await Promise.all([loadManifest(), loadCrop(crop), pagePaths(crop)]);
  const year = data.years[data.years.length - 1];
  const profile = profileFor(data, country, year);
  const name = manifest.countries[country].name;
  const crops = manifest.commodities[crop].name.toLowerCase();
  const production = profile.observation?.production;
  const facts = [
    production != null ? `${compact(production)} in ${year}` : null,
    profile.rank ? `#${profile.rank} of ${profile.of} reporting countries` : null,
    profile.share != null ? `${number(profile.share, 1)}% of covered world production` : null,
    profile.change != null ? `${profile.change > 0 ? '+' : ''}${number(profile.change)}% against the prior five-year mean` : null,
  ].filter((f): f is string => f !== null);
  return {
    title: `${name} ${crops} production${production != null ? `: ${compact(production)}` : ''} · Agriculture Radar`,
    description: `${name}: ${facts.join('; ')}. Source: FAOSTAT.`,
    alternates: { canonical: `/${crop}/${paths.find(p => p.id === country)!.slug}` },
  };
}
