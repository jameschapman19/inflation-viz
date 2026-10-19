import type { Metadata } from 'next';
import Link from 'next/link';
import BirthPicker from '@/components/BirthPicker';
import { CROPS } from '@/lib/crops';
import { loadCrop, loadManifest } from '@/lib/server/load';

export const metadata: Metadata = {
  title: 'The harvest since you were born · Agriculture Radar',
  description: 'How much more wheat, maize and rice the world grows than the year you were born, and what led it then and now.',
};

export default async function BornIndex() {
  const [manifest, ...crops] = await Promise.all([loadManifest(), ...CROPS.map(loadCrop)]);
  return (
    <main className="dashboard born">
      <div className="explorer-heading">
        <div>
          <span className="eyebrow">Since you were born</span>
          <h1>The harvest in your lifetime</h1>
        </div>
      </div>
      <p className="born-lede">Pick a crop and a birth year to see how much more the world grows now, how yields and prices have moved, and who led the harvest then and now.</p>
      {crops.map((data, i) => {
        const years = data.years.slice(0, -1);
        return (
          <section className="born-crop" key={CROPS[i]}>
            <div className="section-heading">
              <h2>{manifest.commodities[CROPS[i]].name}</h2>
              <BirthPicker crop={CROPS[i]} years={years} />
            </div>
            <ul className="year-grid">
              {years.map(y => <li key={y}><Link href={`/born/${CROPS[i]}/${y}`}>{y}</Link></li>)}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
