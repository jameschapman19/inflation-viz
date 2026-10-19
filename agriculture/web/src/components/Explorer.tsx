'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Database, Download, RotateCcw } from 'lucide-react';
import { EmbedCode } from '@/kit/EmbedCode';
import { Notable } from '@/kit/Notable';
import { setHash, useHash } from '@/kit/hash';
import { countryStripes, profileFor } from '@/lib/crops';
import { coverage, releaseDate } from '@/lib/data';
import type { ExplorerProps } from '@/lib/server/page-data';
import type { CropData, Metric } from '@/lib/types';
import { parseView, viewHash, type View } from '@/lib/view';
import CropTabs from './CropTabs';
import CountryCard from './explorer/CountryCard';
import MapCard from './explorer/MapCard';
import PriceCard from './explorer/PriceCard';
import RaceCard from './explorer/RaceCard';
import TimeBar from './explorer/TimeBar';
import SourceDialog from './SourceDialog';
import type { Geography } from './WorldMap';

const STEP_MS = 450;

/**
 * The crop explorer. The server renders the entry country's profile, the
 * latest-year leaders and the price chart, so the page is meaningful (and
 * shareable) before any script runs. The shared crop file then loads once in
 * the browser to power the map, the replay and instant country switching,
 * which updates the URL in place.
 */
export default function Explorer({ crop, country: entryCountry, manifest, countries, forecast, notable, initial }: ExplorerProps) {
  const [country, setCountry] = useState(entryCountry);
  const [data, setData] = useState<CropData | null>(null);
  const [geography, setGeography] = useState<Geography | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [source, setSource] = useState<'faostat' | 'worldbank' | null>(null);

  const { years } = initial;
  const latest = years[years.length - 1];
  const view = parseView(useHash(), years);
  const index = years.indexOf(view.year);
  const isPlaying = playing && index < years.length - 1;

  useEffect(() => {
    const controller = new AbortController();
    const get = <T,>(url: string) =>
      fetch(url, { signal: controller.signal }).then(response => {
        if (!response.ok) throw new Error(`${url} could not be loaded.`);
        return response.json() as Promise<T>;
      });
    Promise.all([get<CropData>(`/data/${crop}.json`), get<Geography>('/data/geography.geojson')])
      .then(([cropData, geo]) => {
        setData(cropData);
        setGeography(geo);
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, [crop, attempt]);

  const commit = useCallback((next: View) => setHash(viewHash(next, latest)), [latest]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setTimeout(() => {
      commit({ layer: view.layer, year: years[index + 1] });
      if (index + 1 >= years.length - 1) setPlaying(false);
    }, STEP_MS);
    return () => clearTimeout(id);
  }, [isPlaying, index, view.layer, years, commit]);

  const commodity = manifest.commodities[crop];
  const geoName = (id: string) => geography?.features.find(f => f.properties.id === id)?.properties.name;
  const nameOf = (id: string) => manifest.countries[id]?.name ?? geoName(id) ?? id;

  const profile = useMemo(() => {
    if (data) return profileFor(data, country, view.year);
    return country === entryCountry && view.year === initial.year ? initial.profile : null;
  }, [data, country, view.year, entryCountry, initial]);
  const totals = data ? coverage(data, view.year) : view.year === initial.year ? initial.totals : null;
  const stripes = useMemo(() => (data ? countryStripes(data, country) : country === entryCountry ? initial.stripes : null), [data, country, entryCountry, initial]);

  // Only countries that report this crop have a page of their own.
  const pathFor = (id: string) => {
    const ref = countries.find(c => c.id === id);
    return ref ? `/${crop}/${ref.slug}` : `/${crop}`;
  };

  function selectCountry(id: string) {
    setCountry(id);
    const path = pathFor(id);
    window.history.replaceState(null, '', `${path}${window.location.search}${window.location.hash}`);
    document.title = `${nameOf(id)} ${commodity.name.toLowerCase()} production · Agriculture Radar`;
  }

  function togglePlay() {
    if (isPlaying) return setPlaying(false);
    if (index >= years.length - 1) commit({ layer: view.layer, year: years[0] });
    setPlaying(true);
  }

  if (error) {
    return (
      <main className="state-page">
        <Database size={30} /><h1>Data could not be loaded</h1><p>{error}</p>
        <button className="button" onClick={() => { setError(''); setAttempt(a => a + 1); }}><RotateCcw size={16} /> Retry</button>
      </main>
    );
  }

  const observation = profile?.observation ?? undefined;

  return (
    <>
      <main className="dashboard">
        <div className="explorer-heading">
          <div>
            <span className="eyebrow">Crop explorer</span>
            <h1>{nameOf(country)} {commodity.name.toLowerCase()} production</h1>
          </div>
          <a className="button download-button embed-hide" href={`/data/downloads/${crop}-production.csv`} download><Download size={16} /> Download observations</a>
        </div>

        <Notable items={notable ? [notable] : []} />

        <section className="control-bar" aria-label="Map controls">
          <CropTabs
            current={crop}
            hrefs={{ wheat: '/wheat', maize: '/maize', rice: '/rice' }}
            names={{ wheat: manifest.commodities.wheat.name, maize: manifest.commodities.maize.name, rice: manifest.commodities.rice.name }}
          />
          <div className="map-selectors">
            <label>Map layer
              <div className="select-wrap">
                <select aria-label="Map layer" value={view.layer} onChange={e => commit({ layer: e.target.value as Metric, year: view.year })}>
                  <option value="production">Production</option><option value="yield">Yield</option><option value="change">Production change</option>
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
            <label>Reference year
              <div className="select-wrap">
                <select aria-label="Reference year" value={view.year} onChange={e => { setPlaying(false); commit({ layer: view.layer, year: Number(e.target.value) }); }}>
                  {[...years].reverse().map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
          </div>
        </section>

        <TimeBar
          data={data}
          years={years}
          year={view.year}
          playing={isPlaying}
          manifest={manifest}
          cropName={commodity.name}
          onPlay={togglePlay}
          onYear={year => { setPlaying(false); commit({ layer: view.layer, year }); }}
        />

        <div className="explorer-grid">
          <MapCard
            manifest={manifest}
            cropName={commodity.name}
            productionBasis={commodity.production_basis}
            layer={view.layer}
            year={view.year}
            totals={totals}
            data={data}
            geography={geography}
            selected={country}
            onSelect={selectCountry}
            onSource={() => setSource('faostat')}
          />
          <CountryCard
            manifest={manifest}
            cropName={commodity.name}
            isRice={crop === 'rice'}
            countries={countries}
            selected={country}
            name={nameOf(country)}
            year={view.year}
            years={years}
            profile={profile}
            stripes={stripes}
            onSelect={selectCountry}
            onSource={() => setSource('faostat')}
          />
        </div>

        <div className="lower-grid">
          <PriceCard crop={crop} manifest={manifest} prices={initial.prices} forecast={forecast} onSource={() => setSource('worldbank')} />
          <RaceCard
            data={data}
            initialTop={initial.top}
            initialYear={initial.year}
            initialTotal={initial.totals.total}
            year={view.year}
            cropName={commodity.name}
            manifest={manifest}
            selected={country}
            onSelect={selectCountry}
          />
        </div>

        <EmbedCode path={pathFor(country)} height={1400} title={`${commodity.name} explorer`} />
        <footer className="site-footer">
          <span><Database size={14} /> Snapshot {releaseDate(manifest.generated_at)} · Each layer keeps its own reference period</span>
          <Link href="/methodology/">Sources & methodology</Link>
        </footer>
      </main>
      {source && <SourceDialog manifest={manifest} provider={source} crop={crop} country={country} year={view.year} observation={observation} onClose={() => setSource(null)} />}
    </>
  );
}
