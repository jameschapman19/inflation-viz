import { formatMonth } from "./format.ts";
import { STRIPE_TARGET } from "./stripeColor.ts";

/** 12-month rates keyed by "YYYY-MM-01". */
export type Rates = Map<string, number>;
export type Measure = "CPI" | "RPI";

/**
 * CPI is the headline measure but its 12-month rate only starts in 1989; RPI
 * runs back to 1948. A lifetime uses CPI wherever it exists and RPI before.
 */
export interface Sources {
  cpi: Rates;
  rpi: Rates;
}

const AGES = [10, 18, 25, 30, 40];

export interface AgeRate {
  age: number;
  year: number;
  /** Mean of the 12-month rates for that calendar year. */
  rate: number;
  measure: Measure;
}

export interface Lifetime {
  birthYear: number;
  /** "Aug 1992": the month prices are compared from. */
  baseLabel: string;
  latestLabel: string;
  /** Today's price level as a multiple of the base month's. */
  multiple: number;
  dates: string[];
  values: number[];
  /** How many leading months use RPI because CPI does not exist yet. */
  rpiMonths: number;
  peak: { ds: string; rate: number; measure: Measure };
  /** Months above the target, counted over the CPI months only: the target is a CPI target. */
  monthsAboveTarget: number;
  cpiMonths: number;
  /** Mean of RPI minus CPI over the months both exist, in percentage points. */
  rpiPremium: number | null;
  ages: AgeRate[];
}

function rateAt(s: Sources, ds: string): { rate: number; measure: Measure } | undefined {
  const cpi = s.cpi.get(ds);
  if (cpi !== undefined) return { rate: cpi, measure: "CPI" };
  const rpi = s.rpi.get(ds);
  return rpi === undefined ? undefined : { rate: rpi, measure: "RPI" };
}

/** The latest month CPI has been published for. */
export function latestMonth(s: Sources): string {
  return [...s.cpi.keys()].sort().at(-1) as string;
}

/**
 * Birth years that can be answered: the last needs a full year of prices, the
 * first is the earliest from which an unbroken run of rates reaches today.
 */
export function birthYearRange(s: Sources): { first: number; last: number } {
  const latest = latestMonth(s);
  const latestYear = Number(latest.slice(0, 4));
  const month = latest.slice(5, 7);
  let year = latestYear;
  while (rateAt(s, `${year}-${month}-01`) !== undefined) year--;
  // `year` is the first year with no rate: prices can be compared from `year`
  // itself (rates exist for every year after it), so it is the earliest birth year.
  return { first: year, last: latestYear - 1 };
}

/**
 * Prices since the same calendar month of `birthYear`, chained from the
 * published 12-month rates at 12-month steps back from the latest month —
 * each rate compares exactly one pair of months, so the product is exact
 * apart from the rates being published to one decimal (about ±1% over a
 * lifetime).
 */
export function lifetimeFrom(s: Sources, birthYear: number): Lifetime {
  const latest = latestMonth(s);
  const latestYear = Number(latest.slice(0, 4));
  const month = latest.slice(5, 7);
  const { first, last } = birthYearRange(s);
  if (!Number.isInteger(birthYear) || birthYear < first || birthYear > last) {
    throw new RangeError(`Birth year must be ${first}–${last}, got ${birthYear}`);
  }

  let multiple = 1;
  for (let year = latestYear; year > birthYear; year--) {
    const found = rateAt(s, `${year}-${month}-01`);
    if (found === undefined) throw new Error(`No rate for ${year}-${month}`);
    multiple *= 1 + found.rate / 100;
  }

  const dates = [...new Set([...s.cpi.keys(), ...s.rpi.keys()])].filter((ds) => ds >= `${birthYear}-01-01` && ds <= latest).sort();
  const points = dates.map((ds) => ({ ds, ...(rateAt(s, ds) as { rate: number; measure: Measure }) }));
  const values = points.map((p) => p.rate);
  const rpiMonths = points.filter((p) => p.measure === "RPI").length;
  const peak = points.reduce((best, p) => (p.rate > best.rate ? p : best));
  const cpiValues = values.slice(rpiMonths);

  const overlap = [...s.cpi].filter(([ds]) => s.rpi.has(ds)).map(([ds, cpi]) => (s.rpi.get(ds) as number) - cpi);

  const ages = AGES.flatMap((age) => {
    const year = birthYear + age;
    if (year >= latestYear) return [];
    const inYear = points.filter((p) => p.ds.startsWith(`${year}-`));
    if (inYear.length === 0) return [];
    return [{ age, year, rate: inYear.reduce((a, p) => a + p.rate, 0) / inYear.length, measure: inYear[0].measure }];
  });

  return {
    birthYear,
    baseLabel: formatMonth(`${birthYear}-${month}-01`),
    latestLabel: formatMonth(latest),
    multiple,
    dates,
    values,
    rpiMonths,
    peak: { ds: peak.ds, rate: peak.rate, measure: peak.measure },
    monthsAboveTarget: cpiValues.filter((v) => v > STRIPE_TARGET).length,
    cpiMonths: cpiValues.length,
    rpiPremium: overlap.length ? overlap.reduce((a, b) => a + b, 0) / overlap.length : null,
    ages,
  };
}
