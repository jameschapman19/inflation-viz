import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import BirthPicker from '@/components/BirthPicker';
import CropTabs from '@/components/CropTabs';
import { EmbedCode } from '@/kit/EmbedCode';
import { StripeStrip, StripeTicks } from '@/kit/StripeStrip';
import { bornFacts } from '@/lib/born';
import { CROPS, isCrop } from '@/lib/crops';
import { compact, number } from '@/lib/data';
import { HARVEST_LIMIT, harvestColor } from '@/lib/harvest';
import type { Crop } from '@/lib/types';
import { loadCrop, loadManifest } from '@/lib/server/load';

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await Promise.all(CROPS.map(async crop => (await loadCrop(crop)).years.slice(0, -1).map(year => ({ crop, year: String(year) }))))).flat();
}

type Params = { params: Promise<{ crop: string; year: string }> };

async function load({ params }: Params) {
  const { crop, year } = await params;
  if (!isCrop(crop)) notFound();
  const data = await loadCrop(crop);
  const born = Number(year);
  if (!data.years.slice(0, -1).includes(born)) notFound();
  return { crop, data, facts: bornFacts(data, born), manifest: await loadManifest() };
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { crop, facts, manifest } = await load(props);
  const name = manifest.commodities[crop].name;
  return {
    title: `${name} since ${facts.year}: ${number(facts.productionMultiple, 1)}× the harvest · Agriculture Radar`,
    description: `Covered world ${name.toLowerCase()} production has risen from ${compact(facts.then.production)} in ${facts.year} to ${compact(facts.now.production)} in ${facts.latest}.`,
  };
}

export default async function BornPage(props: Params) {
  const { crop, data, facts, manifest } = await load(props);
  const name = manifest.commodities[crop].name;
  const nameOf = (id: string) => manifest.countries[id]?.name ?? id;
  const { then, now } = facts;
  return (
    <main className="dashboard born">
      <div className="explorer-heading">
        <div>
          <span className="eyebrow">Since you were born</span>
          <h1>{name} since {facts.year}</h1>
        </div>
      </div>
      <section className="control-bar" aria-label="Choose crop and year">
        <CropTabs
          current={crop}
          icons={false}
          hrefs={Object.fromEntries(CROPS.map(c => [c, `/born/${c}/${facts.year}`])) as Record<Crop, string>}
          names={Object.fromEntries(CROPS.map(c => [c, manifest.commodities[c].name])) as Record<Crop, string>}
        />
        <BirthPicker crop={crop} years={data.years.slice(0, -1)} current={facts.year} />
      </section>

      <p className="born-lede">
        In {facts.year} the countries that report grew <b>{compact(then.production)}</b> of {name.toLowerCase()}. In {facts.latest} they grew <b>{compact(now.production)}</b>:
        {' '}<b>{number(facts.productionMultiple, 1)}×</b> as much.
      </p>

      <section className="fact-grid">
        <div className="fact">
          <span>Covered production</span>
          <strong>{number(facts.productionMultiple, 1)}×</strong>
          <small>{compact(then.production)} → {compact(now.production)} · {then.countries} → {now.countries} countries reporting</small>
        </div>
        <div className="fact">
          <span>World yield</span>
          <strong>{facts.yieldMultiple == null ? '—' : `${number(facts.yieldMultiple, 1)}×`}</strong>
          <small>{then.yield != null && now.yield != null ? `${number(then.yield, 2)} → ${number(now.yield, 2)} t/ha` : 'Not available for both years'}</small>
        </div>
        <div className="fact">
          <span>Benchmark price, nominal</span>
          <strong>{facts.priceMultiple == null ? '—' : `${number(facts.priceMultiple, 1)}×`}</strong>
          <small>{facts.priceThen != null ? `$${number(facts.priceThen, 0)} → $${number(facts.priceNow, 0)} per tonne` : 'No price history for that year'} · not adjusted for inflation</small>
        </div>
      </section>

      <section className="map-card born-stripes">
        <div className="section-heading">
          <div><span className="eyebrow">{facts.year}–{facts.latest}</span><h2>Every harvest since, against its five-year mean</h2></div>
        </div>
        <StripeStrip values={facts.stripes} fill={harvestColor} label={`World ${name.toLowerCase()} production against its prior five-year mean, one stripe per year since ${facts.year}`} />
        <StripeTicks labels={facts.stripeYears.map(y => (y % (facts.stripeYears.length > 30 ? 10 : 5) === 0 ? String(y) : null))} />
        <p className="muted">Orange: a fall against the prior five years; teal: a rise (grey at no change, full colour at ±{HARVEST_LIMIT}%). The first five years of the series have no baseline.</p>
      </section>

      <section className="born-lists">
        <div className="map-card">
          <span className="eyebrow">Largest producers</span>
          <h2>{facts.year}</h2>
          <ol>{facts.topThen.map(r => <li key={r.id}><span>{nameOf(r.id)}</span><b>{compact(r.production)}</b></li>)}</ol>
        </div>
        <div className="map-card">
          <span className="eyebrow">Largest producers</span>
          <h2>{facts.latest}</h2>
          <ol>{facts.topNow.map(r => <li key={r.id}><span>{nameOf(r.id)}</span><b>{compact(r.production)}</b></li>)}</ol>
        </div>
      </section>

      <p className="muted born-note">
        Totals cover countries and territories that report production, which are more numerous now than in {facts.year}, so the multiple mixes real growth with wider coverage.
        Prices are the World Bank {manifest.commodities[crop].benchmark_name} benchmark in nominal US dollars. Source: FAOSTAT, World Bank. <Link href={`/${crop}`}>Explore the {name.toLowerCase()} map</Link>.
      </p>
      <EmbedCode path={`/born/${crop}/${facts.year}`} height={1000} title={`${name} since ${facts.year}`} />
    </main>
  );
}
