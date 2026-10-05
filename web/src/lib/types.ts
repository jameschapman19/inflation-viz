export interface SeriesSource {
  unique_id: string;
  name: string;
  cdid: string;
  dataset: string;
  source_name: string;
  source_url: string;
  api_url: string;
  license: string;
  cadence: string;
  unit: string;
  division_name: string | null;
  coicop: string | null;
  parent_coicop: string | null;
}

export interface ReferenceTableSource {
  key: string;
  name: string;
  source_name: string;
  source_url: string;
  license: string;
  cadence: string;
  notes: string;
}

export interface Registry {
  headline: SeriesSource[];
  divisions: SeriesSource[];
  weights: SeriesSource[];
  subdivisions: SeriesSource[];
  subdivisionWeights: SeriesSource[];
  external: ReferenceTableSource[];
  /** Additional ONS series added for context — some alternative inflation
   * measures (RPI), some outside CPI entirely (real wage growth) — see
   * sources.yaml's `context:` section. */
  context: SeriesSource[];
  /** Bank of England series (currently just Bank Rate) — a different
   * provider, fetched via boe.py rather than the ONS pipeline. Same
   * SeriesSource shape; `dataset` is "iadb" rather than an ONS dataset. */
  boe: SeriesSource[];
}

export interface SeriesPoint {
  unique_id: string;
  ds: string;
  y: number;
}

export interface ProvenanceRecord {
  unique_id: string;
  source_name: string;
  source_url: string;
  cdid: string;
  license: string;
  release_date: string;
  fetched_at: string;
  next_release_date: string | null;
}

export interface Meta {
  generatedAt: string;
  latestVintage: string | null;
}

export type { ForecastBand, ForecastPoint } from "./radarForecast";
export type ForecastExport = Omit<import("./radarForecast").ForecastExport, "totalUniqueId"> & {
  totalUniqueId: string;
};
