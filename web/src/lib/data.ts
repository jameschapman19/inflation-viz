import provenanceData from "@/data/provenance.json";
import registryData from "@/data/registry.json";
import seriesData from "@/data/series.json";
import metaData from "@/data/meta.json";
import forecastData from "@/data/forecast.json";
import type {
  ForecastExport,
  ForecastPoint,
  Meta,
  ProvenanceRecord,
  Registry,
  SeriesPoint,
  SeriesSource,
} from "./types";

export const registry = registryData as Registry;
export const series = seriesData as SeriesPoint[];
export const provenance = provenanceData as ProvenanceRecord[];
export const meta = metaData as Meta;
export const forecast = forecastData as ForecastExport;

/** Whether a real forecast run has been published — false on a fresh
 * checkout or before inflation-forecast's first publish, in which case
 * `forecast` is the empty placeholder `export_forecast()` writes.
 */
export function hasForecast(): boolean {
  return forecast.points.length > 0;
}

/** A single series' forecast points, sorted by date — either one of the 12
 * divisions (only present when covered by that run, see
 * `forecast.coverage`) or the reconciled total (`forecast.totalUniqueId`).
 */
export function forecastFor(uniqueId: string): ForecastPoint[] {
  return forecast.points
    .filter((row) => row.unique_id === uniqueId)
    .sort((a, b) => a.ds.localeCompare(b.ds));
}

/** Whether the reconciled total's own conformal prediction bands are
 * present — false before the first run that computed them (`compute_fan`
 * defaults on, but earlier published runs predate the feature and a
 * `compute_fan=False` run can still opt out), in which case the headline
 * chart's fan silently has nothing to draw.
 */
export function hasHeadlineFan(): boolean {
  return forecastFor(forecast.totalUniqueId).some((p) => !!p.bands && p.bands.length > 0);
}

export function seriesFor(uniqueId: string): SeriesPoint[] {
  return series.filter((row) => row.unique_id === uniqueId).sort((a, b) => a.ds.localeCompare(b.ds));
}

export function latestPointFor(uniqueId: string): SeriesPoint | undefined {
  const points = seriesFor(uniqueId);
  return points[points.length - 1];
}

export function provenanceFor(uniqueId: string): ProvenanceRecord | undefined {
  return provenance.find((row) => row.unique_id === uniqueId);
}

function sortByCoicop<T extends { coicop: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.coicop ?? "").localeCompare(b.coicop ?? ""));
}

export function divisionsSorted(): SeriesSource[] {
  return sortByCoicop(registry.divisions);
}

export function weightsSorted(): SeriesSource[] {
  return sortByCoicop(registry.weights);
}

export function divisionByCoicop(coicop: string): SeriesSource | undefined {
  return registry.divisions.find((d) => d.coicop === coicop);
}

export function divisionCoicopByName(name: string): string | undefined {
  return registry.divisions.find((d) => d.division_name === name)?.coicop ?? undefined;
}

export function weightByCoicop(coicop: string): SeriesSource | undefined {
  return registry.weights.find((w) => w.coicop === coicop);
}

export function subdivisionsSorted(): SeriesSource[] {
  return sortByCoicop(registry.subdivisions);
}

export function subdivisionWeightsSorted(): SeriesSource[] {
  return sortByCoicop(registry.subdivisionWeights);
}

export function subdivisionByCoicop(coicop: string): SeriesSource | undefined {
  return registry.subdivisions.find((s) => s.coicop === coicop);
}

export function subdivisionWeightByCoicop(coicop: string): SeriesSource | undefined {
  return registry.subdivisionWeights.find((w) => w.coicop === coicop);
}

/** Sub-divisions whose immediate parent is the given division/group COICOP
 * code — used to list a division's own sub-categories (e.g. "07" ->
 * 07.1/07.2/07.3) or a group's nested classes (e.g. "07.2" -> 07.2.2).
 */
export function subdivisionsUnder(parentCoicop: string): SeriesSource[] {
  return subdivisionsSorted().filter((s) => s.parent_coicop === parentCoicop);
}

export interface ChildSeries {
  coicop: string;
  name: string;
  uniqueId: string;
}

function toChildSeries(s: SeriesSource): ChildSeries {
  return { coicop: s.coicop as string, name: s.division_name ?? s.name, uniqueId: s.unique_id };
}

/** The 12 divisions, as drillable children of the "all items" root — their
 * own ppt contribution to headline CPI (the series the top-level
 * contributors chart stacks).
 */
export function topLevelContributionChildren(): ChildSeries[] {
  return divisionsSorted()
    .filter((d) => d.coicop !== null)
    .map(toChildSeries);
}

/** The 12 divisions' own basket weights, as drillable children of the "all
 * items" root — stacks validly (weights are additive shares of one total),
 * unlike rates.
 */
export function topLevelWeightChildren(): ChildSeries[] {
  return weightsSorted()
    .filter((w) => w.coicop !== null)
    .map(toChildSeries);
}

/** A division or subdivision's direct sub-categories' own 12-month rates —
 * NOT additive (each is an independent rate of change, not a
 * pre-weighted contribution), so these are compared as separate lines,
 * never stacked.
 */
export function childRateSeriesOf(parentCoicop: string): ChildSeries[] {
  return subdivisionsUnder(parentCoicop).map(toChildSeries);
}

/** A division or subdivision's direct sub-categories' own basket weights —
 * additive, so these stack validly.
 */
export function childWeightSeriesOf(parentCoicop: string): ChildSeries[] {
  return subdivisionWeightsSorted()
    .filter((w) => w.parent_coicop === parentCoicop)
    .map(toChildSeries);
}

export interface HeadlineStat {
  name: string;
  value: number;
  period: string;
  sourceUrl: string;
  nextRelease: string | null;
}

export function headlineStats(): HeadlineStat[] {
  return registry.headline
    .map((source) => {
      const latest = latestPointFor(source.unique_id);
      if (!latest) return null;
      return {
        name: source.name,
        value: latest.y,
        period: latest.ds,
        sourceUrl: source.source_url,
        nextRelease: provenanceFor(source.unique_id)?.next_release_date ?? null,
      };
    })
    .filter((s): s is HeadlineStat => s !== null);
}

export interface WeightRow {
  coicop: string;
  divisionName: string;
  weightPerMille: number;
  cdid: string;
  sourceUrl: string;
}

/** Each division's most recent basket-weight observation. Weight series
 * live in the same fetched `series` data as everything else
 * (registry.weights, unique_ids GB.W01..GB.W12) — nothing extra to load.
 */
export function latestWeights(): WeightRow[] {
  return weightsSorted()
    .map((source) => {
      const latest = latestPointFor(source.unique_id);
      if (!latest || !source.coicop || !source.division_name) return null;
      return {
        coicop: source.coicop,
        divisionName: source.division_name,
        weightPerMille: latest.y,
        cdid: source.cdid,
        sourceUrl: source.source_url,
      };
    })
    .filter((w): w is WeightRow => w !== null);
}
