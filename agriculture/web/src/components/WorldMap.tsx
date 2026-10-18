'use client';
import { useMemo, useState } from 'react';
import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import type { CropData, Manifest, Metric } from '@/lib/types';
import { compact, metricValue, number } from '@/lib/data';
export type Geography = FeatureCollection<Geometry, { id: string; name: string }>;
const scales = {
  production: { thresholds: [1e5, 1e6, 1e7, 5e7], colors: ['#534629', '#826336', '#b18042', '#dda750', '#ffcf75'], labels: ['<100K', '100K–1M', '1–10M', '10–50M', '50M+'], unit: 'tonnes' },
  yield: { thresholds: [2, 4, 6, 8], colors: ['#244f50', '#337770', '#4ba494', '#74cbbb', '#aff0d7'], labels: ['<2', '2–4', '4–6', '6–8', '8+'], unit: 'tonnes / hectare' },
  change: { thresholds: [-20, -5, 5, 20], colors: ['#d79256', '#8f6751', '#5a6770', '#448f95', '#79ccd0'], labels: ['<−20%', '−20 to −5%', '−5 to +5%', '+5 to +20%', '>+20%'], unit: 'change from prior five-year mean' },
};
export default function WorldMap({ geography, data, manifest, year, metric, selected, onSelect }: { geography: Geography; data: CropData; manifest: Manifest; year: number; metric: Metric; selected: string; onSelect: (iso: string) => void }) {
  const [hover, setHover] = useState<{ id: string; name: string; x: number; y: number } | null>(null);
  const paths = useMemo(() => {
    const projection = geoNaturalEarth1().fitExtent([[20, 15], [980, 485]], geography);
    const path = geoPath(projection);
    return { countries: geography.features.map(f => ({ id: f.properties.id, name: f.properties.name, d: path(f) ?? '' })), grid: path(geoGraticule10()) ?? '' };
  }, [geography]);
  const scale = scales[metric];
  const color = (iso: string) => { const v = metricValue(data, iso, year, metric); if (v == null) return '#293b46'; const i = scale.thresholds.findIndex(t => v < t); return scale.colors[i === -1 ? 4 : i]; };
  const hoverValue = hover ? metricValue(data, hover.id, year, metric) : null;
  return <div className="map-surface">
    <svg viewBox="0 0 1000 510" className="world-map" aria-label={`${manifest.commodities[data.commodity].name} ${metric} by country, ${year}`} role="group" onPointerLeave={() => setHover(null)}>
      <path d={paths.grid} fill="none" stroke="#203744" strokeWidth=".6"/>
      {paths.countries.map(country => <path key={country.id} d={country.d} fill={color(country.id)} stroke={selected === country.id ? '#f3f7f8' : '#0c1e29'} strokeWidth={selected === country.id ? 1.7 : .55} className={`country-shape ${selected === country.id ? 'selected' : ''}`} role="button" tabIndex={selected === country.id ? 0 : -1} aria-label={`${country.name}, ${metricValue(data, country.id, year, metric) == null ? 'no data' : metric === 'production' ? compact(metricValue(data, country.id, year, metric)) : number(metricValue(data, country.id, year, metric)!)}; select country`} aria-pressed={selected === country.id} onClick={() => onSelect(country.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(country.id); } }} onPointerMove={e => { const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect(); setHover({ id: country.id, name: country.name, x: (e.clientX - box.left) / box.width * 100, y: (e.clientY - box.top) / box.height * 100 }); }}><title>{country.name}</title></path>)}
    </svg>
    {hover && <div className="map-tooltip" style={{ left: `${Math.min(hover.x, 72)}%`, top: `${Math.min(hover.y, 78)}%` }}><strong>{hover.name}</strong><span>{hoverValue == null ? 'No reported observation' : metric === 'production' ? compact(hoverValue) : metric === 'yield' ? `${number(hoverValue, 2)} t / ha` : `${hoverValue > 0 ? '+' : ''}${number(hoverValue)}%`}</span><small>{year}</small></div>}
    <div className="map-legend"><div className="legend-title">{scale.unit}</div><div className="legend-items">{scale.colors.map((color, i) => <span key={color}><i style={{ background: color }}/>{scale.labels[i]}</span>)}<span><i style={{ background: '#293b46' }}/>Unavailable</span></div></div>
    <div className="map-attribution">Boundaries: <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">Natural Earth</a> · Country selection also available in the profile menu</div>
  </div>;
}
