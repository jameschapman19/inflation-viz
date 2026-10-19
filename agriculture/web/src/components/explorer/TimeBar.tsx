'use client';
import { Pause, Play } from 'lucide-react';
import { useMemo } from 'react';
import { StripeScrubber } from '@/kit/StripeScrubber';
import { StripeTicks } from '@/kit/StripeStrip';
import { CellRibbon, RibbonLegend } from '@/kit/Ribbon';
import { leaders, leaderTally, worldStripes } from '@/lib/crops';
import { compact, number } from '@/lib/data';
import { harvestColor } from '@/lib/harvest';
import { CATEGORICAL, OTHER_COLOR, colorFor } from '@/lib/palette';
import type { CropData, Manifest } from '@/lib/types';

type Props = {
  data: CropData | null;
  years: number[];
  year: number;
  playing: boolean;
  manifest: Manifest;
  cropName: string;
  onPlay: () => void;
  onYear: (year: number) => void;
};

/** Replay control: world harvest stripes as the scrubber track, with the country that led each year beneath. */
export default function TimeBar({ data, years, year, playing, manifest, cropName, onPlay, onYear }: Props) {
  const stripes = useMemo(() => (data ? worldStripes(data) : null), [data]);
  const lead = useMemo(() => (data ? leaders(data) : null), [data]);
  const tally = useMemo(() => (lead ? leaderTally(lead) : []), [lead]);
  const order = tally.map(t => t.id);
  const nameOf = (id: string) => manifest.countries[id]?.name ?? id;
  const index = years.indexOf(year);
  const ticks = years.map(y => (y % 10 === 0 ? String(y) : null));
  const shown = tally.slice(0, CATEGORICAL.length);
  const others = tally.slice(CATEGORICAL.length);

  return (
    <section className="time-bar" aria-label="Replay through the years">
      <div className="time-heading">
        <div>
          <span className="eyebrow">{cropName} · {years[0]}–{years[years.length - 1]}</span>
          <h2>Replay the harvests</h2>
        </div>
        <p>World production against its prior five-year mean, one stripe per year: <span className="fall">orange</span> falls, <span className="rise">teal</span> rises. Drag to move the map through time.</p>
      </div>
      {stripes && lead ? (
        <>
          <div className="time-controls">
            <button type="button" className="play-button" onClick={onPlay} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause size={16} /> : <Play size={16} />}
              {playing ? 'Pause' : index >= years.length - 1 ? 'Replay' : 'Play'}
            </button>
            <div className="time-track">
              <StripeScrubber
                label="Year"
                values={stripes}
                fill={harvestColor}
                from={0}
                to={years.length - 1}
                index={index}
                bigStep={10}
                describe={i => `${years[i]}${stripes[i] == null ? '' : ` · ${stripes[i]! > 0 ? '+' : ''}${number(stripes[i]!)}% vs prior five years`}`}
                onSeek={i => onYear(years[i])}
                onCommit={i => onYear(years[i])}
              />
              <StripeTicks labels={ticks} />
            </div>
          </div>
          <div className="time-ribbon">
            <span className="ribbon-label">Largest producer</span>
            <CellRibbon
              label={`The largest ${cropName.toLowerCase()} producer in each year`}
              cells={lead.map((l, i) => (l ? { color: colorFor(order, l.id), title: `${years[i]}: ${nameOf(l.id)} (${compact(l.production)})` } : null))}
            />
            <RibbonLegend
              entries={[
                ...shown.map((t, i) => ({ id: t.id, color: CATEGORICAL[i], label: nameOf(t.id), note: `${t.years} ${t.years === 1 ? 'year' : 'years'}` })),
                ...(others.length ? [{ id: 'other', color: OTHER_COLOR, label: 'Other', note: `${others.reduce((s, t) => s + t.years, 0)} years` }] : []),
              ]}
            />
          </div>
        </>
      ) : (
        <div className="time-skeleton" aria-busy="true">Loading the full history…</div>
      )}
    </section>
  );
}
