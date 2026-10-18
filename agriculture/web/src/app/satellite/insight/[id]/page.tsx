import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { headlines } from '@/lib/headlines';
import { loadGlobal } from '@/lib/satelliteServer';
import { number, releaseDate } from '@/lib/data';

export const dynamicParams = true;
export const revalidate = 900;
// Pages are rendered on demand and cached, so a new headline gets its page without a deploy.
export async function generateStaticParams() {
  return [];
}
async function find(id: string) {
  const data = await loadGlobal();
  const headline = data && headlines(data).find(h => h.id === id);
  return data && headline ? { data, headline } : null;
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const found = await find((await params).id);
  return found ? { title: `${found.headline.text} · Agriculture Radar`, description: `NDVI ${number(found.headline.ndvi, 2)} against a normal ${number(found.headline.normal, 2)}. Source: ${found.data.source}.` } : {};
}
export default async function Insight({ params }: { params: Promise<{ id: string }> }) {
  const found = await find((await params).id);
  if (!found) notFound();
  const { data, headline: h } = found;
  return <main className="dashboard satellite"><span className="eyebrow">Satellite insight · experimental</span><h1>{h.text}</h1>
    <p className="insight-figures">NDVI <strong>{number(h.ndvi, 2)}</strong> against a normal of <strong>{number(h.normal, 2)}</strong> ({h.anomaly > 0 ? '+' : ''}{number(h.anomaly, 2)}, {number(Math.abs(h.z), 1)} standard deviations from the {h.seasons - 1} earlier seasons)</p>
    <div className="notice"><p>This describes vegetation greenness in the {data.cropMask}, not yield or harvest size. Window starting {releaseDate(h.windowStart)}. Source: {data.source}, vintage {data.vintage}. A claim appears only when the value beats every earlier season and sits well outside their spread. <Link href="/methodology/#satellite">Methodology</Link></p></div>
    <p><Link className="button" href="/satellite/global/">Explore the global map</Link></p></main>;
}
