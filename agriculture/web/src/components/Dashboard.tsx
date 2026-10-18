'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe2, Database, Download, Info, Wheat, Sprout, Leaf, ChevronDown, RotateCcw, TrendingUp } from 'lucide-react';
import WorldMap, { type Geography } from './WorldMap';
import Chart from './Chart';
import SourceDialog from './SourceDialog';
import { changeFromBaseline, compact, coverage, number, period, releaseDate } from '@/lib/data';
import type { Crop, CropData, Forecast, Manifest } from '@/lib/types';
const crops: Crop[] = ['wheat', 'maize', 'rice'];
const cropIcons = { wheat: Wheat, maize: Sprout, rice: Leaf };
export default function Dashboard() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [geography, setGeography] = useState<Geography | null>(null);
  const [data, setData] = useState<CropData | null>(null);
  const [crop, setCrop] = useState<Crop>('wheat');
  const [year, setYear] = useState<number | null>(null);
  const [country, setCountry] = useState('CHN');
  const [metric, setMetric] = useState<'production' | 'yield' | 'change'>('production');
  const [source, setSource] = useState<'faostat' | 'worldbank' | null>(null);
  const [range, setRange] = useState(5);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [showForecast, setShowForecast] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(true);
  function selectCrop(nextCrop: Crop) {
    if (nextCrop === crop) return;
    setPending(true);
    setCrop(nextCrop);
  }
  useEffect(() => {
    let cancelled = false;
    const read = (url: string) => fetch(url).then(response => { if (!response.ok) throw new Error('A data file could not be loaded.'); return response.json(); });
    Promise.all([read('/data/manifest.json'), read('/data/geography.geojson')]).then(([m, g]) => { if (!cancelled) { setManifest(m); setGeography(g); } }).catch(e => { if (!cancelled) setError(e.message); });
    read('/data/forecast.json').then(f => { if (!cancelled) setForecast(f); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/data/${crop}.json`, { signal: controller.signal }).then(r => { if (!r.ok) throw new Error('Crop observations could not be loaded.'); return r.json(); }).then((d: CropData) => { setData(d); setYear(previous => previous && d.years.includes(previous) ? previous : d.years.at(-1)!); setPending(false); }).catch(e => { if (e.name !== 'AbortError') { setError(e.message); setPending(false); } });
    return () => controller.abort();
  }, [crop]);
  const header = <header className="site-header"><Link href="/" className="brand"><span className="brand-mark" aria-hidden="true"/><span>Agriculture <strong>Radar</strong></span></Link><nav aria-label="Main navigation"><Link href="/" className="active">Explore</Link><Link href="/satellite/">Satellite</Link><Link href="/methodology/">Methodology</Link></nav><span className="header-note">FAOSTAT · World Bank</span></header>;
  if (error) return <>{header}<main className="state-page"><Database size={30}/><h1>Data could not be loaded</h1><p>{error}</p><button className="button" onClick={() => window.location.reload()}><RotateCcw size={16}/> Retry</button></main></>;
  if (!manifest || !geography || !data || data.commodity !== crop || year == null) return <>{header}<main className="state-page" aria-busy="true"><Globe2 size={36} className="loading-globe"/><h1>Loading crop observations</h1><p>Production, yields, and benchmark prices</p></main></>;
  const commodity = manifest.commodities[crop];
  const observation = data.countries[country]?.[String(year)];
  const total = coverage(data, year);
  const history = data.countries[country] ?? {};
  const change = changeFromBaseline(history, year);
  const latestPrice = data.prices.at(-1)!;
  const pricePrevious = data.prices.find(p => p.date === `${Number(latestPrice.date.slice(0, 4)) - 1}${latestPrice.date.slice(4)}`);
  const priceChange = pricePrevious ? (latestPrice.value / pricePrevious.value - 1) * 100 : null;
  const selectedName = manifest.countries[country]?.name ?? geography.features.find(f => f.properties.id === country)?.properties.name ?? country;
  const countryHistory = Object.entries(history).filter(([, o]) => o.production != null).map(([y, o]) => ({ date: `${y}-01-01`, value: o.production! })).sort((a, b) => a.date.localeCompare(b.date));
  const pricePoints = data.prices.filter(p => range === 0 || new Date(p.date).getTime() >= new Date(latestPrice.date).getTime() - range * 365.25 * 86400000);
  const rankings = Object.entries(data.countries).filter(([, h]) => h[String(year)]?.production != null).sort((a, b) => b[1][String(year)].production! - a[1][String(year)].production!);
  const forecastSeries = forecast?.series?.[crop];
  const future = forecastSeries && forecast
    ? forecast.points.flatMap(p => p.unique_id === crop && p.lo != null && p.hi != null ? [{ date: p.ds, point: p.yhat, lo: p.lo, hi: p.hi }] : [])
    : [];
  const countryOptions = Object.values(manifest.countries).sort((a, b) => a.name.localeCompare(b.name));
  return <>{header}<main className="dashboard">
    <div className="explorer-heading"><div><span className="eyebrow">Crop explorer</span><h1>Global crop production</h1></div><a className="button download-button" href={`/data/downloads/${crop}-production.csv`} download><Download size={16}/> Download observations</a></div>
    <section className="control-bar" aria-label="Map controls"><div className="crop-tabs" aria-label="Crop">{crops.map(c => { const Icon = cropIcons[c]; return <button key={c} onClick={() => selectCrop(c)} className={crop === c ? 'crop-tab selected' : 'crop-tab'} aria-pressed={crop === c}><Icon size={18}/>{manifest.commodities[c].name}</button>; })}</div><div className="map-selectors"><label>Map layer<div className="select-wrap"><select aria-label="Map layer" value={metric} onChange={e => setMetric(e.target.value as typeof metric)}><option value="production">Production</option><option value="yield">Yield</option><option value="change">Production change</option></select><ChevronDown size={14}/></div></label><label>Reference year<div className="select-wrap"><select aria-label="Reference year" value={year} onChange={e => setYear(Number(e.target.value))}>{[...data.years].reverse().map(y => <option key={y} value={y}>{y}</option>)}</select><ChevronDown size={14}/></div></label></div></section>
    <div className="explorer-grid" aria-busy={pending}><section className={`map-card ${pending ? 'pending' : ''}`} aria-label="Global production map">
      <div className="map-heading"><div><span className="eyebrow">{commodity.name} · {year}</span><h2>{metric === 'production' ? 'Where it grows' : metric === 'yield' ? 'Yield across countries' : 'How production is changing'}</h2><p>{metric === 'change' ? `Compared with mean production in ${year - 5}–${year - 1}` : commodity.production_basis}</p></div><button className="source-button" onClick={() => setSource('faostat')}><Database size={15}/> Source</button></div>
      <div className="map-stats"><div><span>Covered production</span><strong>{compact(total.total)}</strong></div><div><span>Countries & territories reporting</span><strong>{total.countries}</strong></div><div><span>Dataset published</span><strong className="date-stat">{releaseDate(manifest.releases.faostat.published_at)}</strong></div></div>
      <WorldMap geography={geography} data={data} manifest={manifest} metric={metric} year={year} selected={country} onSelect={setCountry}/>
      <div className="coverage-note"><Info size={14}/><span>Totals cover reported countries and territories; regional aggregates are excluded. {metric === 'change' && 'All five baseline years are required.'}</span></div>
    </section>
    <aside className={`country-card ${pending ? 'pending' : ''}`} aria-label="Country profile"><span className="eyebrow">Country profile</span><label className="country-picker"><span className="sr-only">Country</span><select aria-label="Country" value={country} onChange={e => setCountry(e.target.value)}>{!manifest.countries[country] && <option value={country}>{selectedName}</option>}{countryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><ChevronDown size={18}/></label><div className="country-subline"><span>{commodity.name} · {year}</span><button className="text-link" onClick={() => setSource('faostat')}>View source <Database size={13}/></button></div>
      {observation ? <><div className="country-primary"><span>Production</span><strong>{compact(observation.production)}</strong><span className="observation-flag">{manifest.flags[observation.flags.production] ?? 'Provider observation'}</span></div><div className="country-metrics"><div><span>Harvested area</span><strong>{compact(observation.area, 'ha')}</strong></div><div><span>Yield</span><strong>{observation.yield == null ? 'Unavailable' : `${number(observation.yield, 2)} t/ha`}</strong></div><div><span>Share of covered production</span><strong>{observation.production != null && total.total > 0 ? `${number(observation.production / total.total * 100, 2)}%` : 'Unavailable'}</strong></div><div><span>Vs. prior five-year mean</span><strong className={change != null && change > 0 ? 'teal-text' : ''}>{change == null ? 'Unavailable' : `${change > 0 ? '+' : ''}${number(change)}%`}</strong></div></div></> : <div className="empty-observation"><Database size={25}/><h3>No reported observation</h3><p>{commodity.name} data is unavailable for {selectedName} in {year}. Missing values are not treated as zero.</p></div>}
      <div className="country-history"><h3>Production history <span>tonnes</span></h3><Chart points={countryHistory} unit="t" annual color="var(--amber)" label={`${selectedName} ${commodity.name} production history in tonnes`} height={195}/></div><p className="country-note">{crop === 'rice' ? 'Paddy production and milled-rice benchmark prices use different product definitions.' : 'Annual production is reported by calendar year. The latest available year is 2024.'}</p>
    </aside></div>
    <div className="lower-grid"><section className="price-card"><div className="section-heading"><div><span className="eyebrow">Traded benchmark · {period(latestPrice.date)}</span><h2>{commodity.benchmark_name}</h2></div><button className="source-button" onClick={() => setSource('worldbank')}><Database size={15}/> Source</button></div><div className="price-toolbar"><div className="price-value"><strong>${number(latestPrice.value, 2)}</strong><span>/ tonne</span>{priceChange != null && <span className="price-change">{priceChange > 0 ? '+' : ''}{number(priceChange)}% year on year</span>}</div><div className="chart-ranges" aria-label="Price history period">{[5, 10, 0].map(n => <button key={n} className={range === n ? 'selected' : ''} aria-pressed={range === n} onClick={() => setRange(n)}>{n ? `${n}Y` : 'All'}</button>)}</div></div>
      <Chart points={pricePoints} unit="USD / t" color="var(--teal)" label={`${commodity.benchmark_name} monthly nominal USD per tonne`} future={showForecast ? future : []} height={210}/>
      <div className="price-footer"><span>Monthly · Nominal USD · Published {releaseDate(manifest.releases.worldbank.published_at)}</span><a href={`/data/downloads/${crop}-prices.csv`} download><Download size={14}/> CSV</a></div>
      {future.length > 0 ? <div className="forecast-strip"><label><input type="checkbox" checked={showForecast} onChange={e => setShowForecast(e.target.checked)}/><TrendingUp size={16}/><span>Show experimental {forecast!.horizonMonths}-month forecast</span></label><span className="forecast-badge">{forecast!.level}% nominal band</span>{showForecast && <p>{forecastSeries?.intervalStatus === 'undercovered_in_recent_evaluation' && <strong>Recent evaluation fell below nominal interval coverage. Treat this band as illustrative. </strong>}Revised-history evaluation · Issued {releaseDate(forecast!.generatedAt)} · Forecasts are benchmark prices, not crop yields or retail food prices. <Link href="/methodology/#forecasts">Validation details</Link></p>}</div> : <div className="forecast-unavailable">No published forecast is available for this benchmark.</div>}
    </section><section className="ranking-card"><div className="section-heading"><div><span className="eyebrow">{commodity.name} · {year}</span><h2>Leading producers</h2></div><span className="ranking-unit">Share of covered total</span></div><ol className="producer-list">{rankings.slice(0, 6).map(([iso, h], i) => { const share = total.total > 0 ? h[String(year)].production! / total.total * 100 : 0; return <li key={iso}><button onClick={() => setCountry(iso)} className={country === iso ? 'selected' : ''}><span className="producer-rank">{String(i + 1).padStart(2, '0')}</span><span className="producer-name">{manifest.countries[iso]?.name ?? iso}<span className="producer-bar"><i style={{ width: `${Math.max(1, share / (rankings[0][1][String(year)].production! / total.total * 100) * 100)}%` }}/></span></span><span className="producer-value">{compact(h[String(year)].production)}<small>{number(share, 1)}%</small></span></button></li>; })}</ol></section></div>
    <footer className="site-footer"><span><Database size={14}/> Snapshot {releaseDate(manifest.generated_at)} · Each layer keeps its own reference period</span><Link href="/methodology/">Sources & methodology</Link></footer>
  </main>{source && <SourceDialog manifest={manifest} provider={source} crop={crop} country={country} year={year} observation={observation} onClose={() => setSource(null)}/>}</>;
}
