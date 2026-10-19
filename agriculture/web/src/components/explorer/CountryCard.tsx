'use client';
import { ChevronDown, Database } from 'lucide-react';
import Chart from '../Chart';
import { StripeStrip, StripeTicks } from '@/kit/StripeStrip';
import type { CountryProfile, CountryRef } from '@/lib/crops';
import { compact, number } from '@/lib/data';
import { HARVEST_LIMIT, harvestColor } from '@/lib/harvest';
import type { Manifest } from '@/lib/types';

type Props = {
  manifest: Manifest;
  cropName: string;
  isRice: boolean;
  countries: CountryRef[];
  selected: string;
  name: string;
  year: number;
  years: number[];
  profile: CountryProfile | null;
  stripes: (number | null)[] | null;
  onSelect: (id: string) => void;
  onSource: () => void;
};

const KEY_STEPS = 8;
const keyGradient = `linear-gradient(to right, ${Array.from({ length: KEY_STEPS + 1 }, (_, i) => {
  const change = -HARVEST_LIMIT + (2 * HARVEST_LIMIT * i) / KEY_STEPS;
  return `${harvestColor(change)} ${(i / KEY_STEPS) * 100}%`;
}).join(', ')})`;

export default function CountryCard({ manifest, cropName, isRice, countries, selected, name, year, years, profile, stripes, onSelect, onSource }: Props) {
  const observation = profile?.observation;
  const flag = observation?.flags.production;
  return (
    <aside className={`country-card ${profile ? '' : 'pending'}`} aria-label="Country profile">
      <span className="eyebrow">Country profile</span>
      <label className="country-picker">
        <span className="sr-only">Country</span>
        <select aria-label="Country" value={selected} onChange={e => onSelect(e.target.value)}>
          {!countries.some(c => c.id === selected) && <option value={selected}>{name}</option>}
          {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <ChevronDown size={18} />
      </label>
      <div className="country-subline"><span>{cropName} · {year}</span><button className="text-link" onClick={onSource}>View source <Database size={13} /></button></div>

      {!profile ? <div className="country-skeleton" aria-busy="true">Loading {name}…</div> : observation ? (
        <>
          <div className="country-primary">
            <span>Production</span>
            <strong>{compact(observation.production)}</strong>
            <span className="observation-flag">{(flag && manifest.flags[flag]) ?? 'Provider observation'}</span>
            {profile.rank && <span className="rank-line">#{profile.rank} of {profile.of} reporting countries</span>}
          </div>
          <div className="country-metrics">
            <div><span>Harvested area</span><strong>{compact(observation.area, 'ha')}</strong></div>
            <div><span>Yield</span><strong>{observation.yield == null ? 'Unavailable' : `${number(observation.yield, 2)} t/ha`}</strong></div>
            <div><span>Share of covered production</span><strong>{profile.share == null ? 'Unavailable' : `${number(profile.share, 2)}%`}</strong></div>
            <div><span>Vs. prior five-year mean</span><strong className={profile.change != null && profile.change > 0 ? 'teal-text' : ''}>{profile.change == null ? 'Unavailable' : `${profile.change > 0 ? '+' : ''}${number(profile.change)}%`}</strong></div>
          </div>
        </>
      ) : (
        <div className="empty-observation"><Database size={25} /><h3>No reported observation</h3><p>{cropName} data is unavailable for {name} in {year}. Missing values are not treated as zero.</p></div>
      )}

      <div className="country-history">
        <h3>Production history <span>tonnes</span></h3>
        <Chart points={profile?.history ?? []} unit="t" annual color="var(--amber)" label={`${name} ${cropName} production history in tonnes`} height={195} />
      </div>
      {stripes && stripes.some(v => v !== null) && (
        <div className="country-stripes">
          <h3>Harvest stripes <span>vs prior five-year mean</span></h3>
          <StripeStrip values={stripes} fill={harvestColor} label={`${name} ${cropName} production against its five-year mean, one stripe per year`} />
          <StripeTicks labels={years.map(y => (y % 10 === 0 ? String(y) : null))} />
          <div className="harvest-key" aria-hidden="true">
            <i style={{ background: keyGradient }} />
            <span>−{HARVEST_LIMIT}% or less</span><span>no change</span><span>+{HARVEST_LIMIT}% or more</span>
          </div>
        </div>
      )}
      <p className="country-note">{isRice ? 'Paddy production and milled-rice benchmark prices use different product definitions.' : `Annual production is reported by calendar year. The latest available year is ${years[years.length - 1]}.`}</p>
    </aside>
  );
}
