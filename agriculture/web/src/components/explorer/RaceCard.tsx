'use client';
import { useMemo } from 'react';
import { everInTop, ranked, type Ranked } from '@/lib/crops';
import { compact, number } from '@/lib/data';
import type { CropData, Manifest } from '@/lib/types';

const SHOWN = 10;
const ROW = 46;

type Props = {
  data: CropData | null;
  /** Server-rendered top ten for the latest year, used until the full data arrives. */
  initialTop: Ranked[];
  initialYear: number;
  /** Server-rendered covered total for the latest year. */
  initialTotal: number;
  year: number;
  cropName: string;
  manifest: Manifest;
  selected: string;
  onSelect: (id: string) => void;
};

/**
 * The leading producers for the selected year. Rows are keyed by country and
 * positioned by rank, so scrubbing or playing the years makes countries slide
 * past each other. Every country that ever reaches the top ten keeps a row;
 * those outside it fade out below the list.
 */
export default function RaceCard({ data, initialTop, initialYear, initialTotal, year, cropName, manifest, selected, onSelect }: Props) {
  const ids = useMemo(() => (data ? everInTop(data, SHOWN) : initialTop.map(r => r.id)), [data, initialTop]);
  const current = useMemo(() => (data ? ranked(data, year) : year === initialYear ? initialTop : []), [data, year, initialYear, initialTop]);
  const total = useMemo(() => (data ? current.reduce((sum, r) => sum + r.production, 0) : year === initialYear ? initialTotal : 0), [data, current, year, initialYear, initialTotal]);
  const top = current.slice(0, SHOWN);
  const rankOf = new Map(top.map((r, i) => [r.id, i]));
  const production = new Map(top.map(r => [r.id, r.production]));
  const lead = top[0]?.production ?? 1;

  return (
    <section className="ranking-card">
      <div className="section-heading">
        <div><span className="eyebrow">{cropName} · {year}</span><h2>Leading producers</h2></div>
        <span className="ranking-unit">Production, tonnes</span>
      </div>
      {/* Rows are positioned by rank with transforms, so their DOM order is not the visible order:
          the animated list is hidden from assistive tech, which gets the ranking as text instead. */}
      <p className="sr-only">
        Leading {cropName.toLowerCase()} producers in {year}: {top.map((r, i) => `${i + 1}. ${manifest.countries[r.id]?.name ?? r.id}, ${compact(r.production)}`).join('; ')}.
      </p>
      <ol className="race-list" style={{ height: SHOWN * ROW }} aria-hidden="true">
        {ids.map(id => {
          const place = rankOf.get(id);
          const visible = place !== undefined;
          const value = production.get(id) ?? 0;
          return (
            <li
              key={id}
              className="race-row"
              style={{ transform: `translateY(${(visible ? place : SHOWN) * ROW}px)`, opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
            >
              <button type="button" tabIndex={-1} className={selected === id ? 'selected' : ''} onClick={() => onSelect(id)}>
                <span className="producer-rank">{String((place ?? SHOWN) + 1).padStart(2, '0')}</span>
                <span className="producer-name">
                  {manifest.countries[id]?.name ?? id}
                  <span className="producer-bar"><i style={{ width: `${Math.max(1, (value / lead) * 100)}%` }} /></span>
                </span>
                <span className="producer-value">{compact(value)}{total > 0 && <small>{number((value / total) * 100, 1)}%</small>}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
