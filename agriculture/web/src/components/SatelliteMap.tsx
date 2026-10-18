'use client';
import { useMemo, useState } from 'react';
import { geoMercator, geoNaturalEarth1, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { baseline, d3Winding } from '@/lib/satellite';
import { number } from '@/lib/data';
import type { SatelliteExport } from '@/lib/types';
import type { Geography } from './WorldMap';

export type Mode = 'ndvi' | 'anomaly';
const NDVI = { thresholds: [0.2, 0.35, 0.5, 0.65], colors: ['#4a3f2a', '#6f6a35', '#8fa043', '#58b36a', '#1f8f55'], labels: ['<0.20', '0.20–0.35', '0.35–0.50', '0.50–0.65', '0.65+'] };
const ANOMALY = { thresholds: [-0.15, -0.05, 0.05, 0.15], colors: ['#d79256', '#8f6751', '#5a6770', '#448f95', '#79ccd0'], labels: ['< −0.15', '−0.15 to −0.05', '±0.05', '+0.05 to +0.15', '> +0.15'] };
const NONE = '#293b46';

export default function SatelliteMap({ data, geography, season, windowKey, mode, selected, onSelect }: { data: SatelliteExport; geography?: Geography; season: number; windowKey: string; mode: Mode; selected: string; onSelect: (id: string) => void }) {
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const world = geography != null;
  const shapes = useMemo(() => {
    if (geography) {
      const path = geoPath(geoNaturalEarth1().fitExtent([[10, 10], [990, 500]], geography));
      return geography.features.filter(f => f.properties.id !== '-99').map(f => ({ id: f.properties.id, name: f.properties.name, d: path(f) ?? '' }));
    }
    const features = data.regions.filter(r => r.geometry).map(r => ({ type: 'Feature', properties: { id: r.id, name: r.name }, geometry: d3Winding(r.geometry!) }) as Feature<Geometry, { id: string; name: string }>);
    const collection: FeatureCollection = { type: 'FeatureCollection', features };
    const path = geoPath(geoMercator().fitExtent([[16, 16], [584, 444]], collection));
    return features.map(f => ({ id: f.properties.id, name: f.properties.name, d: path(f) ?? '' }));
  }, [data.regions, geography]);
  const scale = mode === 'ndvi' ? NDVI : ANOMALY;
  const value = (id: string) => {
    const o = data.observations.find(x => x.region === id && x.windowStart === `${season}-${windowKey}`);
    if (!o) return null;
    if (mode === 'ndvi') return o.ndvi;
    if (o.provisional) return null; // built from fewer days, so it reads low against complete windows
    const base = baseline(data, id, windowKey, season);
    return base == null ? null : o.ndvi - base;
  };
  const fill = (id: string) => { const v = value(id); if (v == null) return NONE; const i = scale.thresholds.findIndex(t => v < t); return scale.colors[i === -1 ? 4 : i]; };
  const text = (id: string) => { const v = value(id); return v == null ? (mode === 'anomaly' ? 'No anomaly yet: the window is provisional, has no clear scene, or has fewer than two earlier seasons' : 'No clear scene in this window') : mode === 'ndvi' ? `NDVI ${number(v, 2)}` : `${v > 0 ? '+' : ''}${number(v, 2)} vs earlier seasons`; };
  const hovered = hover ? shapes.find(s => s.id === hover.id) : null;
  return <div className="map-surface">
    <svg viewBox={world ? '0 0 1000 510' : '0 0 600 460'} className="sat-map" role="group" aria-label={`${mode === 'ndvi' ? 'NDVI' : 'NDVI anomaly'} by region, window starting ${season}-${windowKey}`} onPointerLeave={() => setHover(null)}>
      {shapes.map(s => <path key={s.id} d={s.d} fill={fill(s.id)} stroke={selected === s.id ? '#f3f7f8' : '#0c1e29'} strokeWidth={selected === s.id ? 2 : 0.7} role="button" tabIndex={0} aria-pressed={selected === s.id} aria-label={`${s.name}: ${text(s.id)}`} className="country-shape" onClick={() => onSelect(s.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s.id); } }} onPointerMove={e => { const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect(); setHover({ id: s.id, x: (e.clientX - box.left) / box.width * 100, y: (e.clientY - box.top) / box.height * 100 }); }}/>)}
    </svg>
    {hover && hovered && <div className="map-tooltip" style={{ left: `${Math.min(hover.x, 65)}%`, top: `${Math.min(hover.y, 80)}%` }}><strong>{hovered.name}</strong><span>{text(hovered.id)}</span></div>}
    <div className="map-legend"><div className="legend-title">{mode === 'ndvi' ? 'NDVI' : 'NDVI anomaly vs earlier seasons'}</div><div className="legend-items">{scale.colors.map((c, i) => <span key={c}><i style={{ background: c }}/>{scale.labels[i]}</span>)}<span><i style={{ background: NONE }}/>Unavailable</span></div></div>
  </div>;
}
