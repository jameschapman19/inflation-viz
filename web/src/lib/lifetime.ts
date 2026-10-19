import { seriesFor } from "./data";
import { formatMonth } from "./format";
import { STRIPE_TARGET } from "./stripeColor";

/** ONS's CPI 12-month rate starts in January 1989, so that is the earliest
 * birth year this can answer for. */
export const FIRST_BIRTH_YEAR = 1989;
const AGES = [10, 18, 25, 30, 40];

export interface AgeRate {
  age: number;
  year: number;
  /** Mean of the 12-month rates published for that calendar year. */
  rate: number;
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
  peak: { ds: string; rate: number };
  monthsAboveTarget: number;
  ages: AgeRate[];
}

function cpiByDate(): { byDate: Map<string, number>; latest: string } {
  const points = seriesFor("GB.CPI");
  return { byDate: new Map(points.map((p) => [p.ds, p.y])), latest: points[points.length - 1].ds };
}

/** Last birth year with at least one full year of prices to compare. */
export function lastBirthYear(): number {
  return Number(cpiByDate().latest.slice(0, 4)) - 1;
}

/**
 * Prices since the same calendar month of `birthYear`, chained from the
 * published 12-month rates at 12-month steps back from the latest month —
 * each rate compares exactly one pair of months, so the product is exact
 * apart from the rates being published to one decimal (about ±1% over a
 * lifetime).
 */
export function lifetimeFor(birthYear: number): Lifetime {
  const { byDate, latest } = cpiByDate();
  const latestYear = Number(latest.slice(0, 4));
  const month = latest.slice(5, 7);
  if (!Number.isInteger(birthYear) || birthYear < FIRST_BIRTH_YEAR || birthYear >= latestYear) {
    throw new RangeError(`Birth year must be ${FIRST_BIRTH_YEAR}–${latestYear - 1}, got ${birthYear}`);
  }

  let multiple = 1;
  for (let year = latestYear; year > birthYear; year--) {
    const rate = byDate.get(`${year}-${month}-01`);
    if (rate === undefined) throw new Error(`No CPI rate for ${year}-${month}`);
    multiple *= 1 + rate / 100;
  }

  const months = [...byDate.keys()].filter((ds) => ds >= `${birthYear}-01-01`).sort();
  const values = months.map((ds) => byDate.get(ds) as number);
  const peakIndex = values.indexOf(Math.max(...values));

  const ages = AGES.flatMap((age) => {
    const year = birthYear + age;
    if (year >= latestYear) return [];
    const rates = months.filter((ds) => ds.startsWith(`${year}-`)).map((ds) => byDate.get(ds) as number);
    return [{ age, year, rate: rates.reduce((a, b) => a + b, 0) / rates.length }];
  });

  return {
    birthYear,
    baseLabel: formatMonth(`${birthYear}-${month}-01`),
    latestLabel: formatMonth(latest),
    multiple,
    dates: months,
    values,
    peak: { ds: months[peakIndex], rate: values[peakIndex] },
    monthsAboveTarget: values.filter((v) => v > STRIPE_TARGET).length,
    ages,
  };
}
