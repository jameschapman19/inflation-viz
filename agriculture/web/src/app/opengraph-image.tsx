import { ImageResponse } from 'next/og';
import { Sparkline } from '@/components/og/Sparkline';
import { OgCard } from '@/kit/og';
import { CROPS, worldTotals } from '@/lib/crops';
import { leaderChange, overtakeText } from '@/lib/notable';
import { compact, number } from '@/lib/data';
import { TEAL, TEAL_FILL, priceSummary, toSeries } from '@/lib/og';
import { loadCrop, loadManifest } from '@/lib/server/load';

export const alt = 'Agriculture Radar: world wheat, maize and rice production and benchmark prices';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// The fallback preview for every page without its own image; rebuilt with the data.
export default async function Image() {
  const [manifest, ...crops] = await Promise.all([loadManifest(), ...CROPS.map(loadCrop)]);
  // The first crop whose largest producer has recently changed, if any.
  const headline = crops
    .map((data, i) => ({ change: leaderChange(data), crop: manifest.commodities[CROPS[i]].name }))
    .find(c => c.change !== null);
  const subtitle = headline?.change ? overtakeText(headline.change, headline.crop, id => manifest.countries[id]?.name ?? id, t => compact(t)).short : undefined;
  return new ImageResponse(
    (
      <OgCard
        eyebrow="Agriculture Radar"
        hero={<span style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.05 }}>{"Where the world's food is grown"}</span>}
        subtitle={subtitle}
        footerLeft="FAOSTAT production · World Bank benchmark prices"
        footerRight="Every number links to its source"
      >
        <div style={{ display: 'flex', width: '100%', gap: 24 }}>
          {crops.map((data, i) => {
            const year = data.years[data.years.length - 1];
            const price = priceSummary(data.prices);
            return (
              <div key={data.commodity} style={{ display: 'flex', flexDirection: 'column', flex: 1, background: '#232725', borderRadius: 18, padding: 24 }}>
                <div style={{ display: 'flex', fontSize: 28, color: '#c3c2b7' }}>{manifest.commodities[CROPS[i]].name} · {year}</div>
                <div style={{ display: 'flex', fontSize: 46, fontWeight: 700, marginTop: 4 }}>{compact(worldTotals(data, year).production)}</div>
                <div style={{ display: 'flex', fontSize: 24, color: '#c3c2b7', marginTop: 4 }}>
                  ${number(price.value, 0)}/t{price.yearOnYear != null ? ` · ${price.yearOnYear > 0 ? '+' : ''}${number(price.yearOnYear, 0)}% y/y` : ''}
                </div>
                <div style={{ display: 'flex', marginTop: 'auto' }}>
                  <Sparkline points={toSeries(data.prices.slice(-60))} width={290} height={80} color={TEAL} fill={TEAL_FILL} />
                </div>
              </div>
            );
          })}
        </div>
      </OgCard>
    ),
    size,
  );
}
