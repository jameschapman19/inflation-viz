'use client';
import { Database, Globe2, Info } from 'lucide-react';
import WorldMap, { type Geography } from '../WorldMap';
import { releaseDate, compact } from '@/lib/data';
import type { Metric } from '@/lib/types';
import type { CropData, Manifest } from '@/lib/types';

type Props = {
  manifest: Manifest;
  cropName: string;
  productionBasis: string;
  layer: Metric;
  year: number;
  totals: { total: number; countries: number } | null;
  data: CropData | null;
  geography: Geography | null;
  selected: string;
  onSelect: (id: string) => void;
  onSource: () => void;
};

const HEADINGS: Record<Metric, string> = {
  production: 'Where it grows',
  yield: 'Yield across countries',
  change: 'How production is changing',
};

export default function MapCard({ manifest, cropName, productionBasis, layer, year, totals, data, geography, selected, onSelect, onSource }: Props) {
  return (
    <section className="map-card" aria-label="Global production map">
      <div className="map-heading">
        <div>
          <span className="eyebrow">{cropName} · {year}</span>
          <h2>{HEADINGS[layer]}</h2>
          <p>{layer === 'change' ? `Compared with mean production in ${year - 5}–${year - 1}` : productionBasis}</p>
        </div>
        <button className="source-button" onClick={onSource}><Database size={15} /> Source</button>
      </div>
      <div className="map-stats">
        <div><span>Covered production</span><strong>{totals ? compact(totals.total) : '…'}</strong></div>
        <div><span>Countries & territories reporting</span><strong>{totals ? totals.countries : '…'}</strong></div>
        <div><span>Dataset published</span><strong className="date-stat">{releaseDate(manifest.releases.faostat.published_at)}</strong></div>
      </div>
      {data && geography ? (
        <WorldMap geography={geography} data={data} manifest={manifest} metric={layer} year={year} selected={selected} onSelect={onSelect} />
      ) : (
        <div className="map-surface map-skeleton" aria-busy="true"><Globe2 size={34} className="loading-globe" /><span>Loading the map…</span></div>
      )}
      <div className="coverage-note">
        <Info size={14} />
        <span>Totals cover reported countries and territories; regional aggregates are excluded. {layer === 'change' && 'All five baseline years are required.'}</span>
      </div>
    </section>
  );
}
