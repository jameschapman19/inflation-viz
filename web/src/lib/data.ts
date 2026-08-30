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
