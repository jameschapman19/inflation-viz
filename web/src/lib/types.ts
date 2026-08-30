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
  external: ReferenceTableSource[];
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
