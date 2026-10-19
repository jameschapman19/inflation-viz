import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { OgCard } from '@/kit/og';
import { bornFacts } from '@/lib/born';
import { CROPS, isCrop } from '@/lib/crops';
import { compact, number } from '@/lib/data';
import { harvestColor } from '@/lib/harvest';
import { loadCrop, loadManifest } from '@/lib/server/load';

export const alt = 'How much more of a crop the world grows than in a birth year';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await Promise.all(CROPS.map(async crop => (await loadCrop(crop)).years.slice(0, -1).map(year => ({ crop, year: String(year) }))))).flat();
}

export default async function Image({ params }: { params: Promise<{ crop: string; year: string }> }) {
  const { crop, year } = await params;
  if (!isCrop(crop)) notFound();
  const [manifest, data] = await Promise.all([loadManifest(), loadCrop(crop)]);
  const born = Number(year);
  if (!data.years.slice(0, -1).includes(born)) notFound();
  const facts = bornFacts(data, born);
  const name = manifest.commodities[crop].name;
  return new ImageResponse(
    (
      <OgCard
        eyebrow={`Born in ${facts.year}`}
        hero={
          <>
            <span style={{ fontSize: 150, fontWeight: 700, lineHeight: 1 }}>{number(facts.productionMultiple, 1)}×</span>
            <span style={{ fontSize: 40, marginLeft: 28, color: '#c3c2b7' }}>the world {name.toLowerCase()} harvest</span>
          </>
        }
        subtitle={`${compact(facts.then.production)} in ${facts.year} → ${compact(facts.now.production)} in ${facts.latest}${facts.yieldMultiple != null ? ` · yield ${number(facts.yieldMultiple, 1)}×` : ''}`}
        footerLeft="One stripe per harvest · orange: below trend, teal: above"
        footerRight="Agriculture Radar · FAOSTAT"
      >
        {facts.stripes.map((value, i) => (
          <div key={facts.stripeYears[i]} style={{ display: 'flex', flex: 1, background: value == null ? 'transparent' : harvestColor(value) }} />
        ))}
      </OgCard>
    ),
    size,
  );
}
