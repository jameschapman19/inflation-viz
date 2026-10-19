import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { Sparkline } from '@/components/og/Sparkline';
import { OgCard } from '@/kit/og';
import { CROPS, isCrop, ranked, worldTotals } from '@/lib/crops';
import { compact, number } from '@/lib/data';
import { AMBER, TEAL, TEAL_FILL, priceSummary, toSeries } from '@/lib/og';
import { loadCrop, loadManifest } from '@/lib/server/load';

export const alt = 'World production of the crop, its largest producers and its benchmark price';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamicParams = false;

export function generateStaticParams() {
  return CROPS.map(crop => ({ crop }));
}

export default async function Image({ params }: { params: Promise<{ crop: string }> }) {
  const { crop } = await params;
  if (!isCrop(crop)) notFound();
  const [manifest, data] = await Promise.all([loadManifest(), loadCrop(crop)]);
  const year = data.years[data.years.length - 1];
  const top = ranked(data, year).slice(0, 5);
  const total = ranked(data, year).reduce((sum, r) => sum + r.production, 0);
  const price = priceSummary(data.prices);
  return new ImageResponse(
    (
      <OgCard
        eyebrow={`${manifest.commodities[crop].name} · world production ${year}`}
        hero={<span style={{ fontSize: 120, fontWeight: 700, lineHeight: 1 }}>{compact(worldTotals(data, year).production)}</span>}
        subtitle={`${manifest.commodities[crop].benchmark_name}: $${number(price.value, 0)}/t${price.yearOnYear != null ? ` (${price.yearOnYear > 0 ? '+' : ''}${number(price.yearOnYear, 0)}% on a year ago)` : ''}`}
        footerLeft="FAOSTAT production · World Bank benchmark prices"
        footerRight="Agriculture Radar"
      >
        <div style={{ display: 'flex', width: '100%', gap: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
            {top.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', fontSize: 26 }}>
                <div style={{ display: 'flex', width: 285, whiteSpace: 'nowrap' }}>{manifest.countries[r.id].name}</div>
                <div style={{ display: 'flex', height: 14, borderRadius: 7, background: AMBER, width: `${(r.production / top[0].production) * 150}px` }} />
                <div style={{ display: 'flex', marginLeft: 14, color: '#c3c2b7' }}>{number((r.production / total) * 100, 0)}%</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Sparkline points={toSeries(data.prices.slice(-120))} width={440} height={200} color={TEAL} fill={TEAL_FILL} />
          </div>
        </div>
      </OgCard>
    ),
    size,
  );
}
