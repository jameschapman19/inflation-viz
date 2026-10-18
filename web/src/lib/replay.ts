import type { DivisionColor } from "./colors";
import { divisionColor } from "./colors";
import type { InflationBand } from "./data";
import {
  bandForRate,
  divisionsSorted,
  forecast,
  forecastFor,
  hasForecast,
  seriesFor,
} from "./data";

export interface ReplayDivision {
  coicop: string;
  name: string;
  color: DivisionColor;
}

/** Everything the replay scrubber needs, as plain arrays indexed by month —
 * built on the server so the client never imports the full series file. */
export interface ReplayData {
  divisions: ReplayDivision[];
  /** First of each month, ISO date strings, actuals followed by projections. */
  dates: string[];
  /** Headline 12-month CPI rate (ONS actual, or the projected total). */
  headline: number[];
  /** `[month][division]` ppt contribution to the headline, in `divisions` order. */
  contributions: number[][];
  bands: InflationBand[];
  /** Index of the first projected month, or null when no forecast is published. */
  projectedFrom: number | null;
}

function valueAt(byDate: Map<string, number>, ds: string, what: string): number {
  const value = byDate.get(ds);
  if (value === undefined) throw new Error(`${what} has no value for ${ds}`);
  return value;
}

export function buildReplayData(): ReplayData {
  const divisions = divisionsSorted().map((d) => {
    if (!d.coicop || !d.division_name) throw new Error(`${d.unique_id} is missing coicop or name`);
    return {
      uniqueId: d.unique_id,
      info: { coicop: d.coicop, name: d.division_name, color: { light: divisionColor(d.coicop, "light"), dark: divisionColor(d.coicop, "dark") } },
    };
  });

  const contributionByDivision = divisions.map((d) => new Map(seriesFor(d.uniqueId).map((p) => [p.ds, p.y])));
  const headlineActual = new Map(seriesFor("GB.CPI").map((p) => [p.ds, p.y]));

  // Contributions are published from a later start than the headline, and
  // every division must be present for a month to be drawable.
  const dates = [...headlineActual.keys()]
    .filter((ds) => contributionByDivision.every((m) => m.has(ds)))
    .sort();
  const headline = dates.map((ds) => valueAt(headlineActual, ds, "GB.CPI"));
  const contributions = dates.map((ds) => contributionByDivision.map((m, i) => valueAt(m, ds, divisions[i].uniqueId)));

  let projectedFrom: number | null = null;
  if (hasForecast() && forecast.coverage.missing.length === 0) {
    const total = new Map(forecastFor(forecast.totalUniqueId).map((p) => [p.ds, p.yhat]));
    const perDivision = divisions.map((d) => new Map(forecastFor(d.uniqueId).map((p) => [p.ds, p.yhat])));
    projectedFrom = dates.length;
    for (const ds of [...total.keys()].sort()) {
      dates.push(ds);
      headline.push(valueAt(total, ds, forecast.totalUniqueId as string));
      contributions.push(perDivision.map((m, i) => valueAt(m, ds, divisions[i].uniqueId)));
    }
  }

  return {
    divisions: divisions.map((d) => d.info),
    dates,
    headline,
    contributions,
    bands: headline.map(bandForRate),
    projectedFrom,
  };
}
