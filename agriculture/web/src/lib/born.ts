import { meanPrice, ranked, worldTotals, worldTrendDeviation, type Ranked, type WorldTotals } from './crops.ts';
import type { CropData } from './types.ts';

export type BornFacts = {
  year: number;
  latest: number;
  then: WorldTotals;
  now: WorldTotals;
  /** Covered world production now as a multiple of the birth year's. */
  productionMultiple: number;
  /** Implied world yield now as a multiple of the birth year's, when both exist. */
  yieldMultiple: number | null;
  /** Mean benchmark price (nominal USD / t) over the birth year and over the latest twelve months. */
  priceThen: number | null;
  priceNow: number;
  priceMultiple: number | null;
  topThen: Ranked[];
  topNow: Ranked[];
  /** World production against its ten-year trend, per year from the birth year on, and the years they belong to. */
  stripes: (number | null)[];
  stripeYears: number[];
};

/**
 * What the crop looked like in a birth year against today. Totals cover the
 * countries that report, which grow in number over time, so multiples are
 * "covered production", not a census of the world.
 */
export function bornFacts(data: CropData, year: number): BornFacts {
  const latest = data.years[data.years.length - 1];
  if (!data.years.includes(year) || year >= latest) {
    throw new RangeError(`Birth year must be ${data.years[0]}–${latest - 1}, got ${year}`);
  }
  const then = worldTotals(data, year);
  const now = worldTotals(data, latest);
  const lastTwelve = data.prices.slice(-12).map(p => p.value);
  const priceNow = lastTwelve.reduce((a, b) => a + b, 0) / lastTwelve.length;
  const priceThen = meanPrice(data.prices, year);
  const stripeYears = data.years.filter(y => y >= year);
  return {
    year,
    latest,
    then,
    now,
    productionMultiple: now.production / then.production,
    yieldMultiple: then.yield != null && now.yield != null ? now.yield / then.yield : null,
    priceThen,
    priceNow,
    priceMultiple: priceThen != null ? priceNow / priceThen : null,
    topThen: ranked(data, year).slice(0, 3),
    topNow: ranked(data, latest).slice(0, 3),
    stripes: stripeYears.map(y => worldTrendDeviation(data, y)),
    stripeYears,
  };
}
