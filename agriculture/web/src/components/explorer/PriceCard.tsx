'use client';
import { Database, Download, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import Chart from '../Chart';
import { productUrl } from '@/kit/products';
import { number, period, releaseDate } from '@/lib/data';
import type { Crop, Forecast, Manifest, Point } from '@/lib/types';

type Props = {
  crop: Crop;
  manifest: Manifest;
  prices: Point[];
  forecast: Forecast | null;
  onSource: () => void;
};

const RANGES = [5, 10, 0];
const YEAR_MS = 365.25 * 86400000;

export default function PriceCard({ crop, manifest, prices, forecast, onSource }: Props) {
  const [range, setRange] = useState(5);
  const [showForecast, setShowForecast] = useState(false);
  const commodity = manifest.commodities[crop];
  const latest = prices[prices.length - 1];
  const yearAgo = prices.find(p => p.date === `${Number(latest.date.slice(0, 4)) - 1}${latest.date.slice(4)}`);
  const yearOnYear = yearAgo ? (latest.value / yearAgo.value - 1) * 100 : null;
  const visible = prices.filter(p => range === 0 || new Date(p.date).getTime() >= new Date(latest.date).getTime() - range * YEAR_MS);
  const series = forecast?.series?.[crop];
  const future = forecast
    ? forecast.points.flatMap(p => (p.unique_id === crop && p.lo != null && p.hi != null ? [{ date: p.ds, point: p.yhat, lo: p.lo, hi: p.hi }] : []))
    : [];

  return (
    <section className="price-card">
      <div className="section-heading">
        <div><span className="eyebrow">Traded benchmark · {period(latest.date)}</span><h2>{commodity.benchmark_name}</h2></div>
        <button className="source-button" onClick={onSource}><Database size={15} /> Source</button>
      </div>
      <div className="price-toolbar">
        <div className="price-value">
          <strong>${number(latest.value, 2)}</strong><span>/ tonne</span>
          {yearOnYear != null && <span className="price-change">{yearOnYear > 0 ? '+' : ''}{number(yearOnYear)}% year on year</span>}
        </div>
        <div className="chart-ranges" aria-label="Price history period">
          {RANGES.map(n => <button key={n} className={range === n ? 'selected' : ''} aria-pressed={range === n} onClick={() => setRange(n)}>{n ? `${n}Y` : 'All'}</button>)}
        </div>
      </div>
      <Chart points={visible} unit="USD / t" color="var(--teal)" label={`${commodity.benchmark_name} monthly nominal USD per tonne`} future={showForecast ? future : []} height={210} />
      <div className="price-footer">
        <span>Monthly · Nominal USD · Published {releaseDate(manifest.releases.worldbank.published_at)}</span>
        <a href={`/data/downloads/${crop}-prices.csv`} download><Download size={14} /> CSV</a>
      </div>
      {(crop === 'wheat' || crop === 'rice') && (
        <p className="price-link embed-hide">
          How does this reach UK shelves? <a href={productUrl('inflation', '/food')}>See it against UK {crop === 'wheat' ? 'bread' : 'rice'} inflation →</a>
        </p>
      )}
      {forecast && future.length > 0 ? (
        <div className="forecast-strip">
          <label><input type="checkbox" checked={showForecast} onChange={e => setShowForecast(e.target.checked)} /><TrendingUp size={16} /><span>Show experimental {forecast.horizonMonths}-month forecast</span></label>
          <span className="forecast-badge">{forecast.level}% nominal band</span>
          {showForecast && (
            <p>
              {series?.intervalStatus === 'undercovered_in_recent_evaluation' && <strong>Recent evaluation fell below nominal interval coverage. Treat this band as illustrative. </strong>}
              Revised-history evaluation · Issued {releaseDate(forecast.generatedAt)} · Forecasts are benchmark prices, not crop yields or retail food prices. <Link href="/methodology/#forecasts">Validation details</Link>
            </p>
          )}
        </div>
      ) : (
        <div className="forecast-unavailable">No published forecast is available for this benchmark.</div>
      )}
    </section>
  );
}
