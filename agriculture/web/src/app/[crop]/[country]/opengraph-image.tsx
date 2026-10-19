import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { Sparkline } from '@/components/og/Sparkline';
import { OgCard } from '@/kit/og';
import { CROPS, countryStripes, isCrop, profileFor } from '@/lib/crops';
import { compact, number } from '@/lib/data';
import { harvestColor } from '@/lib/harvest';
import { AMBER, AMBER_FILL, toSeries } from '@/lib/og';
import { loadCrop, loadManifest } from '@/lib/server/load';
import { pagePaths, resolveSlug } from '@/lib/server/page-data';

export const alt = "A country's crop production history and its rank among producers";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await Promise.all(CROPS.map(async crop => (await pagePaths(crop)).map(({ slug }) => ({ crop, country: slug }))))).flat();
}

export default async function Image({ params }: { params: Promise<{ crop: string; country: string }> }) {
  const { crop, country } = await params;
  const id = isCrop(crop) ? await resolveSlug(crop, country) : null;
  if (!isCrop(crop) || !id) notFound();
  const [manifest, data] = await Promise.all([loadManifest(), loadCrop(crop)]);
  const year = data.years[data.years.length - 1];
  const profile = profileFor(data, id, year);
  const production = profile.observation?.production;
  const facts = [
    profile.rank ? `#${profile.rank} of ${profile.of}` : null,
    profile.share != null ? `${number(profile.share, 1)}% of world` : null,
    profile.change != null ? `${profile.change > 0 ? '+' : ''}${number(profile.change, 0)}% vs prior 5-yr mean` : null,
  ].filter((f): f is string => f !== null);
  // Start the stripes where the country's own history starts, so they line up with the line above.
  const first = Math.max(0, data.years.findIndex(y => data.countries[id][String(y)]?.production != null));
  const stripes = countryStripes(data, id).slice(first);
  const stripeYears = data.years.slice(first);
  return new ImageResponse(
    (
      <OgCard
        eyebrow={`${manifest.commodities[crop].name} · ${year}`}
        hero={
          <>
            <span style={{ fontSize: 116, fontWeight: 700, lineHeight: 1 }}>{production != null ? compact(production) : '—'}</span>
            <span style={{ fontSize: manifest.countries[id].name.length > 22 ? 34 : 48, marginLeft: 28, color: '#c3c2b7' }}>{manifest.countries[id].name}</span>
          </>
        }
        subtitle={facts.join(' · ')}
        footerLeft={`Production ${stripeYears[0]}–${year} · stripes: change vs prior five-year mean`}
        footerRight="Agriculture Radar · FAOSTAT"
      >
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', justifyContent: 'space-between' }}>
          <Sparkline points={toSeries(profile.history)} width={1088} height={130} color={AMBER} fill={AMBER_FILL} />
          <div style={{ display: 'flex', height: 32, marginTop: 14 }}>
            {stripes.map((value, i) => (
              <div key={stripeYears[i]} style={{ display: 'flex', flex: 1, background: value == null ? 'transparent' : harvestColor(value) }} />
            ))}
          </div>
        </div>
      </OgCard>
    ),
    size,
  );
}
