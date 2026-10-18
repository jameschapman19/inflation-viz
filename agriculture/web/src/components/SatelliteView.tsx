'use client';
import { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import Link from 'next/link';
import { ChevronDown, Database, Satellite } from 'lucide-react';
import { headlines as makeHeadlines } from '@/lib/headlines';
import { anomalies, bySeason, dayOfYear, envelope, segments, windowKeys } from '@/lib/satellite';
import SatelliteMap, { type Mode } from './SatelliteMap';
import type { Geography } from './WorldMap';
import { number, releaseDate } from '@/lib/data';
import type { SatelliteExport } from '@/lib/types';

const WIDTH = 760, HEIGHT = 300, LEFT = 44, RIGHT = 16, TOP = 14, BOTTOM = 262;
const STALE_DAYS = 7;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function SatelliteView({ scope }: { scope: 'regional' | 'global' }) {
  const [geography, setGeography] = useState<Geography | null>(null);
  const [data, setData] = useState<SatelliteExport | null | 'missing'>(null);
  const [region, setRegion] = useState('');
  const [hover, setHover] = useState<{ season: number; index: number } | null>(null);
  const [mode, setMode] = useState<Mode>('ndvi');
  const [season, setSeason] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [now] = useState(() => Date.now());
  const stepCount = data && data !== 'missing' ? windowKeys(data).length : 0;
  useEffect(() => {
    if (!playing || !stepCount) return;
    const timer = setInterval(() => setStep(s => (s + 1) % stepCount), 700);
    return () => clearInterval(timer);
  }, [playing, stepCount]);
  useEffect(() => {
    fetch(scope === 'global' ? '/api/satellite-global' : '/data/satellite.json').then(r => (r.ok ? r.json() : 'missing')).then((d: SatelliteExport | 'missing') => { setData(d); if (d !== 'missing') { setRegion((d.regions.find(r => d.observations.some(o => o.region === r.id)) ?? d.regions[0]).id); setSeason(Math.max(...d.observations.map(o => Number(o.windowStart.slice(0, 4))))); } }).catch(() => setData('missing'));
  }, [scope]);
  useEffect(() => {
    if (scope === 'global') fetch('/data/geography.geojson').then(r => r.json()).then(setGeography).catch(() => setGeography(null));
  }, [scope]);
  const header = <header className="site-header"><Link href="/" className="brand"><span className="brand-mark" aria-hidden="true"/><span>Agriculture <strong>Radar</strong></span></Link><nav aria-label="Main navigation"><Link href="/">Explore</Link><Link href="/satellite/" className="active">Satellite</Link><Link href="/methodology/">Methodology</Link></nav><span className="header-note">Satellite · experimental</span></header>;
  if (data === null) return <>{header}<main className="state-page" aria-busy="true"><Satellite size={32}/><h1>Loading satellite observations</h1></main></>;
  if (data === 'missing') return <>{header}<main className="state-page"><Satellite size={32}/><h1>No satellite data published yet</h1><p>Satellite vegetation summaries appear here once a validated extraction has been published. Nothing is shown in the meantime rather than placeholder values.</p></main></>;

  const keys = windowKeys(data);
  const allYears = [...new Set(data.observations.map(o => Number(o.windowStart.slice(0, 4))))].sort((a, b) => b - a);
  const mapSeason = season ?? allYears[0];
  const world = scope === 'global';
  const hasMap = world ? geography != null : data.regions.some(r => r.geometry);
  const noun = world ? 'country' : 'region';
  const seasons = bySeason(data, region);
  const years = [...seasons.keys()].sort((a, b) => a - b);
  const current = years.at(-1)!;
  const normal = years.length > 4 ? envelope(seasons, current) : null;
  const ranked = world ? anomalies(data, mapSeason, keys[step]) : [];
  const claims = world ? makeHeadlines(data) : [];
  const asOf = data.dataAsOf ?? null;
  const ageDays = asOf ? Math.floor((now - Date.parse(asOf)) / 86400000) : null;
  const stale = ageDays != null && ageDays > STALE_DAYS;
  const mapProvisional = data.observations.some(o => o.provisional && o.windowStart === `${mapSeason}-${keys[step]}`);
  const all = data.observations.filter(o => o.region === region);
  const start = Math.min(...all.map(o => dayOfYear(o.windowStart))), end = Math.max(...all.map(o => dayOfYear(o.windowStart))) + data.windowDays;
  const x = (day: number) => LEFT + (day - start) / (end - start) * (WIDTH - LEFT - RIGHT);
  const y = (v: number) => BOTTOM - Math.max(0, Math.min(1, v)) * (BOTTOM - TOP);
  const path = (rows: typeof all) => rows.map((o, i) => `${i ? 'L' : 'M'}${x(dayOfYear(o.windowStart) + data.windowDays / 2)},${y(o.ndvi)}`).join(' ');
  const windows = [...new Set(all.map(o => o.windowStart.slice(5)))].sort();
  const lookup = new Map(all.map(o => [o.windowStart, o]));
  const shown = hover ? seasons.get(hover.season)![hover.index] : null;
  const name = data.regions.find(r => r.id === region)!.name;
  const latest = seasons.get(current)!.at(-1)!;
  const cell = (WIDTH - LEFT - RIGHT) / windows.length;

  return <>{header}<main className="dashboard satellite">
    <div className="explorer-heading"><div><span className="eyebrow">Satellite observations · experimental</span><h1>{world ? 'Vegetation worldwide' : 'Vegetation through the season'}</h1><div className="crop-tabs sat-scope" aria-label="Scope"><Link href="/satellite/" className={world ? 'crop-tab' : 'crop-tab selected'}>Regional pilot</Link><Link href="/satellite/global/" className={world ? 'crop-tab selected' : 'crop-tab'}>Global</Link></div></div>
      <div className="select-wrap sat-select"><select aria-label={noun} value={region} onChange={e => { setRegion(e.target.value); setHover(null); }}>{[...data.regions].sort((a, b) => a.name.localeCompare(b.name)).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select><ChevronDown size={14}/></div></div>
    {asOf && <div className={stale ? 'notice sat-fresh stale' : 'sat-fresh'} role={stale ? 'status' : undefined}>Data as of {releaseDate(asOf)}{ageDays != null ? ` (${ageDays} day${ageDays === 1 ? '' : 's'} ago)` : ''}. {stale ? 'Updates have paused, so these values may be out of date. ' : ''}The newest window is provisional until it completes and reads slightly low, because it is built from fewer days.</div>}
    {claims.length > 0 && <section className="map-card sat-card" aria-label="Headlines">
      <div className="section-heading"><div><span className="eyebrow">Latest window · records only</span><h2>What stands out</h2></div></div>
      <ul className="sat-headlines">{claims.slice(0, 5).map(h => <li key={h.id}><Link href={`/satellite/insight/${h.id}/`}>{h.text}</Link><span>{h.anomaly > 0 ? '+' : ''}{number(h.anomaly, 2)} NDVI vs normal</span></li>)}</ul>
      <div className="coverage-note"><span>A headline appears only when a country beats every earlier season for the same window by a clear margin, with enough clear observations. It describes cropland vegetation, not yield.</span></div>
    </section>}
    {hasMap && <section className="map-card sat-card" aria-label={`${world ? 'Global' : 'Regional'} NDVI map`}>
      <div className="section-heading"><div><span className="eyebrow">{mapSeason} · window starting {releaseDate(`${mapSeason}-${keys[step]}`)}{mapProvisional ? ' · provisional' : ''}</span><h2>{mode === 'ndvi' ? `Vegetation by ${noun}` : 'Where vegetation is ahead of or behind normal'}</h2></div></div>
      <div className="sat-controls">
        <div className="crop-tabs" aria-label="Map mode">{(['ndvi', 'anomaly'] as const).map(m => <button key={m} className={mode === m ? 'crop-tab selected' : 'crop-tab'} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === 'ndvi' ? 'NDVI' : 'Anomaly'}</button>)}</div>
        <div className="select-wrap"><select aria-label="Season" value={mapSeason} onChange={e => setSeason(Number(e.target.value))}>{allYears.map(y => <option key={y} value={y}>{y}</option>)}</select><ChevronDown size={14}/></div>
        <button className="button" onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pause' : 'Play through the season'}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button>
        <input type="range" className="sat-slider" min={0} max={keys.length - 1} value={step} aria-label="Window of the season" onChange={e => { setPlaying(false); setStep(Number(e.target.value)); }}/>
      </div>
      <SatelliteMap data={data} geography={world ? geography ?? undefined : undefined} season={mapSeason} windowKey={keys[step]} mode={mode} selected={region} onSelect={id => { if (data.regions.some(r => r.id === id && data.observations.some(o => o.region === id))) { setRegion(id); setHover(null); } }}/>
      <div className="coverage-note"><span>{mode === 'anomaly' ? 'Compared with the mean of the same window in earlier seasons; needs at least two. ' : ''}Grey areas have no published observation in this window. Click a {noun} to inspect it below.</span></div>
    </section>}
    {world && ranked.length > 0 && <section className="map-card sat-card" aria-label="Largest anomalies">
      <div className="section-heading"><div><span className="eyebrow">Window starting {releaseDate(`${mapSeason}-${keys[step]}`)}</span><h2>Furthest from normal</h2></div></div>
      <div className="sat-rank">{([['Ahead of normal', ranked.slice(0, 5)], ['Behind normal', ranked.slice(-5).reverse()]] as const).map(([title, rows]) => <div key={title}><h3>{title}</h3><ol>{rows.map(r => <li key={r.id}><button className={region === r.id ? 'selected' : ''} onClick={() => setRegion(r.id)}><span>{r.name}</span><strong>{r.anomaly > 0 ? '+' : ''}{number(r.anomaly, 2)}</strong></button></li>)}</ol></div>)}</div>
    </section>}
    <section className="map-card sat-card" aria-label="NDVI by season">
      <div className="section-heading"><div><span className="eyebrow">{name} · {current} vs earlier seasons</span><h2>NDVI by {data.windowDays >= 28 ? 'month' : `${data.windowDays}-day window`}</h2></div></div>
      <div className="map-stats"><div><span>Latest window</span><strong>{releaseDate(latest.windowStart)}</strong></div><div><span>Latest NDVI</span><strong>{number(latest.ndvi, 2)}</strong></div><div><span>Clear pixels in latest window</span><strong>{number(latest.validFraction * 100, 0)}%</strong></div></div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`NDVI by window for ${name}, ${years.join(', ')}`} className="sat-chart" onPointerLeave={() => setHover(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map(v => <g key={v}><line x1={LEFT} x2={WIDTH - RIGHT} y1={y(v)} y2={y(v)} stroke="var(--radar-grid)" strokeDasharray="3 4"/><text x={LEFT - 8} y={y(v) + 4} textAnchor="end" className="axis">{number(v, 2)}</text></g>)}
        {MONTHS.map((m, i) => { const day = dayOfYear(`${current}-${String(i + 1).padStart(2, '0')}-01`); return day >= start && day <= end ? <text key={m} x={x(day)} y={HEIGHT - 8} className="axis">{m}</text> : null; })}
        {normal && <g><polygon points={[...normal.map(n => `${x(dayOfYear(`${current}-${n.key}`) + data.windowDays / 2)},${y(n.hi)}`), ...[...normal].reverse().map(n => `${x(dayOfYear(`${current}-${n.key}`) + data.windowDays / 2)},${y(n.lo)}`)].join(' ')} fill="var(--muted)" fillOpacity=".18"/><path d={normal.map((n, i) => `${i ? 'L' : 'M'}${x(dayOfYear(`${current}-${n.key}`) + data.windowDays / 2)},${y(n.mean)}`).join(' ')} fill="none" stroke="var(--muted)" strokeWidth="1.6" strokeDasharray="4 3"/></g>}
        {!normal && years.slice(0, -1).map(year => segments(seasons.get(year)!, data.windowDays).map((s, i) => <path key={`${year}-${i}`} d={path(s)} fill="none" stroke="var(--muted)" strokeOpacity=".45" strokeWidth="1.4"/>))}
        {segments(seasons.get(current)!, data.windowDays).map((s, i) => <path key={`c-${i}`} d={path(s)} fill="none" stroke="var(--teal)" strokeWidth="2.6" strokeLinejoin="round"/>)}
        {years.flatMap(year => seasons.get(year)!.map((o, index) => <circle key={`${year}-${o.windowStart}`} cx={x(dayOfYear(o.windowStart) + data.windowDays / 2)} cy={y(o.ndvi)} r={year === current ? 4 : 7} fill={year === current ? 'var(--teal)' : 'transparent'} fillOpacity={year === current ? 1 : 0} onPointerEnter={() => setHover({ season: year, index })}/>))}
        {shown && <circle cx={x(dayOfYear(shown.windowStart) + data.windowDays / 2)} cy={y(shown.ndvi)} r="5" fill="none" stroke="#dce7ed" strokeWidth="2"/>}
      </svg>
      <div className="chart-reading" aria-live="polite">{shown ? <>{hover!.season} · {releaseDate(shown.windowStart)} <strong>NDVI {number(shown.ndvi, 2)}</strong>{shown.provisional ? ' (provisional)' : ''} · {number(shown.validFraction * 100, 0)}% clear · {shown.nObservations} scene{shown.nObservations === 1 ? '' : 's'}</> : <span><span className="sat-key"><i className="current"/>{current}</span><span className="sat-key"><i/>{normal ? `range of ${years.length - 1} earlier seasons (dashed: mean)` : 'earlier seasons'}</span> Gaps are windows without a sufficiently clear scene, not low vegetation.</span>}</div>
    </section>
    <section className="map-card sat-card" aria-label="Observation coverage">
      <div className="section-heading"><div><span className="eyebrow">{name} · coverage</span><h2>How much of each window was observed</h2></div></div>
      <svg viewBox={`0 0 ${WIDTH} ${years.length * 26 + 30}`} role="img" aria-label="Clear-pixel fraction by season and window" className="sat-chart">
        {years.map((year, row) => <g key={year}><text x={LEFT - 8} y={row * 26 + 18} textAnchor="end" className="axis">{year}</text>{windows.map((w, col) => { const o = lookup.get(`${year}-${w}`); return <rect key={w} x={LEFT + col * cell + 1} y={row * 26 + 4} width={Math.max(1, cell - 2)} height="20" rx="3" fill={o ? 'var(--teal)' : 'none'} fillOpacity={o ? 0.15 + 0.85 * o.validFraction : 0} stroke={o ? 'none' : 'var(--radar-grid)'} strokeDasharray={o ? undefined : '2 3'}><title>{o ? `${year} ${w}: ${number(o.validFraction * 100, 0)}% clear` : `${year} ${w}: no clear scene`}</title></rect>; })}</g>)}
      </svg>
      <div className="coverage-note"><span>Darker cells have more clear pixels; dashed cells have no usable scene.</span></div>
    </section>
    <div className="notice"><p><strong>Experimental.</strong> Values are mean NDVI over {data.cropMask ? `the ${data.cropMask} crop mask within` : 'the whole of'} each {noun}{data.cropMask ? '' : ', so they describe all vegetation and land cover, not wheat specifically'}. Cloud, shadow and snow pixels are excluded; a window appears only when enough clear pixels remain. Crop classification and yield estimates are not yet published. <Link href="/methodology/#satellite">Methodology</Link></p></div>
    <footer className="site-footer"><span><Database size={14}/> {data.source} · Vintage {data.vintage} · Generated {releaseDate(data.generatedAt)}</span><Link href="/methodology/#satellite">Sources & methodology</Link></footer>
  </main></>;
}
