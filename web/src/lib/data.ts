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

export type InflationBand = "near-target" | "elevated" | "high";

/** Bands a 12-month rate against the Bank of England's 2% CPI inflation
 * target — the same near/elevated/high framing used in MPC commentary.
 * Applied to CPIH too since it moves on the same scale, even though the
 * formal remit target is CPI specifically.
 */
export function bandForRate(value: number): InflationBand {
  if (value <= 2.5) return "near-target";
  if (value <= 5) return "elevated";
  return "high";
}

export interface HeadlineStat {
  name: string;
  value: number;
  period: string;
  sourceUrl: string;
  nextRelease: string | null;
  deltaFromPreviousMonth: number | null;
  band: InflationBand;
}

function rateStatFor(source: SeriesSource): HeadlineStat | undefined {
  const points = seriesFor(source.unique_id);
  const latest = points[points.length - 1];
  if (!latest) return undefined;
  const previous = points[points.length - 2];
  return {
    name: source.name,
    value: latest.y,
    period: latest.ds,
    sourceUrl: source.source_url,
    nextRelease: provenanceFor(source.unique_id)?.next_release_date ?? null,
    deltaFromPreviousMonth: previous ? latest.y - previous.y : null,
    band: bandForRate(latest.y),
  };
}

export function headlineStats(): HeadlineStat[] {
  return registry.headline
    .map(rateStatFor)
    .filter((s): s is HeadlineStat => s !== undefined);
}

const RPI_UNIQUE_ID = "GB.RPI";

/** RPI's 12-month rate — a legacy measure ONS still publishes (rail fares,
 * some student loans and index-linked gilts still reference it), banded
 * the same way as CPI/CPIH even though it isn't itself the MPC's target.
 * Structurally runs above CPI (the "formula effect"), so it lands in a
 * higher band more easily — that's an honest signal, not a bug. Returns
 * undefined until this series has data in series.json, same "recent
 * registry addition" gate as realWageGrowth().
 */
export function rpiStat(): HeadlineStat | undefined {
  const source = registry.context.find((s) => s.unique_id === RPI_UNIQUE_ID);
  return source ? rateStatFor(source) : undefined;
}

/** "+0.3pt" / "-0.2pt" / "No change" — used next to a stat's headline value. */
export function formatDelta(delta: number): string {
  if (delta === 0) return "No change";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}pt`;
}

export interface ContextStat {
  value: number;
  period: string;
  sourceUrl: string;
  deltaFromPreviousMonth: number | null;
  /** null inside the dead zone around zero — real pay is genuinely
   * treading water, not meaningfully rising or falling, so it gets no
   * color signal rather than a forced red/green call. */
  band: "rising" | "falling" | null;
}

const REAL_WAGE_GROWTH_UNIQUE_ID = "GB.WAGE.REAL";

/** Real (CPI-deflated) regular pay growth — ONS's own calculation (Average
 * Weekly Earnings, real terms), not derived here from nominal pay minus
 * CPI. Returns undefined until this series has data in series.json — it's
 * a recent addition to the registry, so it only starts appearing after
 * the next scheduled ONS refresh.
 */
export function realWageGrowth(): ContextStat | undefined {
  const source = registry.context.find((s) => s.unique_id === REAL_WAGE_GROWTH_UNIQUE_ID);
  if (!source) return undefined;

  const points = seriesFor(source.unique_id);
  const latest = points[points.length - 1];
  if (!latest) return undefined;
  const previous = points[points.length - 2];

  return {
    value: latest.y,
    period: latest.ds,
    sourceUrl: source.source_url,
    deltaFromPreviousMonth: previous ? latest.y - previous.y : null,
    band: latest.y > 0.2 ? "rising" : latest.y < -0.2 ? "falling" : null,
  };
}

export interface LevelStat {
  value: number;
  period: string;
  sourceUrl: string;
  deltaFromPreviousMonth: number | null;
}

const BANK_RATE_UNIQUE_ID = "GB.BOE.RATE";

/** The Bank of England's policy rate — the tool being used to bring
 * inflation back to target, shown unbanded (no "good/bad" color): unlike
 * a 12-month rate, a policy rate level has no target of its own to be
 * near or far from. Returns undefined until this series has data in
 * series.json (see boe.ts's fetcher — a different provider from every
 * ONS series, so it lands in registry.boe, not registry.context).
 */
export function bankRate(): LevelStat | undefined {
  const source = registry.boe.find((s) => s.unique_id === BANK_RATE_UNIQUE_ID);
  if (!source) return undefined;

  const points = seriesFor(source.unique_id);
  const latest = points[points.length - 1];
  if (!latest) return undefined;
  const previous = points[points.length - 2];

  return {
    value: latest.y,
    period: latest.ds,
    sourceUrl: source.source_url,
    deltaFromPreviousMonth: previous ? latest.y - previous.y : null,
  };
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
