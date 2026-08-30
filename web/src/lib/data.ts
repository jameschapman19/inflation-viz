import provenanceData from "@/data/provenance.json";
import registryData from "@/data/registry.json";
import seriesData from "@/data/series.json";
import metaData from "@/data/meta.json";
import type { Meta, ProvenanceRecord, Registry, SeriesPoint, SeriesSource } from "./types";

export const registry = registryData as Registry;
export const series = seriesData as SeriesPoint[];
export const provenance = provenanceData as ProvenanceRecord[];
export const meta = metaData as Meta;

export function seriesFor(uniqueId: string): SeriesPoint[] {
  return series.filter((row) => row.unique_id === uniqueId).sort((a, b) => a.ds.localeCompare(b.ds));
}

export function provenanceFor(uniqueId: string): ProvenanceRecord | undefined {
  return provenance.find((row) => row.unique_id === uniqueId);
}

export function divisionsSorted(): SeriesSource[] {
  return [...registry.divisions].sort((a, b) => (a.coicop ?? "").localeCompare(b.coicop ?? ""));
}

export function weightsSorted(): SeriesSource[] {
  return [...registry.weights].sort((a, b) => (a.coicop ?? "").localeCompare(b.coicop ?? ""));
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
  return [...registry.subdivisions].sort((a, b) => (a.coicop ?? "").localeCompare(b.coicop ?? ""));
}

export function subdivisionWeightsSorted(): SeriesSource[] {
  return [...registry.subdivisionWeights].sort((a, b) => (a.coicop ?? "").localeCompare(b.coicop ?? ""));
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

/** All sub-divisions anywhere below the given 2-digit division, regardless
 * of depth — e.g. "07" also picks up 07.2.2, nested under the 07.2 group.
 */
export function subdivisionsUnderDivision(coicop: string): SeriesSource[] {
  return subdivisionsSorted().filter((s) => (s.coicop ?? "").startsWith(`${coicop}.`));
}

export interface ChildSeries {
  coicop: string;
  name: string;
  uniqueId: string;
}

/** The 12 divisions, as drillable children of the "all items" root — their
 * own ppt contribution to headline CPI (the series the top-level
 * contributors chart stacks).
 */
export function topLevelContributionChildren(): ChildSeries[] {
  return divisionsSorted()
    .filter((d): d is SeriesSource & { coicop: string } => Boolean(d.coicop))
    .map((d) => ({ coicop: d.coicop, name: d.division_name ?? d.name, uniqueId: d.unique_id }));
}

/** The 12 divisions' own basket weights, as drillable children of the "all
 * items" root — stacks validly (weights are additive shares of one total),
 * unlike rates.
 */
export function topLevelWeightChildren(): ChildSeries[] {
  return weightsSorted()
    .filter((w): w is SeriesSource & { coicop: string } => Boolean(w.coicop))
    .map((w) => ({ coicop: w.coicop, name: w.division_name ?? w.name, uniqueId: w.unique_id }));
}

/** A division or subdivision's direct sub-categories' own 12-month rates —
 * NOT additive (each is an independent rate of change, not a
 * pre-weighted contribution), so these are compared as separate lines,
 * never stacked.
 */
export function childRateSeriesOf(parentCoicop: string): ChildSeries[] {
  return subdivisionsUnder(parentCoicop).map((s) => ({
    coicop: s.coicop as string,
    name: s.division_name ?? s.name,
    uniqueId: s.unique_id,
  }));
}

/** A division or subdivision's direct sub-categories' own basket weights —
 * additive, so these stack validly.
 */
export function childWeightSeriesOf(parentCoicop: string): ChildSeries[] {
  return [...registry.subdivisionWeights]
    .filter((w) => w.parent_coicop === parentCoicop)
    .sort((a, b) => (a.coicop ?? "").localeCompare(b.coicop ?? ""))
    .map((w) => ({ coicop: w.coicop as string, name: w.division_name ?? w.name, uniqueId: w.unique_id }));
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
      const points = seriesFor(source.unique_id);
      if (points.length === 0) return null;
      const latest = points[points.length - 1];
      const prov = provenanceFor(source.unique_id);
      return {
        name: source.name,
        value: latest.y,
        period: latest.ds,
        sourceUrl: source.source_url,
        nextRelease: prov?.next_release_date ?? null,
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
      const points = seriesFor(source.unique_id);
      if (points.length === 0 || !source.coicop || !source.division_name) return null;
      const latest = points[points.length - 1];
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
