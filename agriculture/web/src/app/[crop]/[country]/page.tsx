import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ExplorerPage from '@/components/ExplorerPage';
import { CROPS, isCrop } from '@/lib/crops';
import { pagePaths, pageMetadata, resolveSlug } from '@/lib/server/page-data';

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await Promise.all(CROPS.map(async crop => (await pagePaths(crop)).map(({ slug }) => ({ crop, country: slug }))))).flat();
}

type Params = { params: Promise<{ crop: string; country: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { crop, country } = await params;
  const id = isCrop(crop) ? await resolveSlug(crop, country) : null;
  return isCrop(crop) && id ? pageMetadata(crop, id) : {};
}

export default async function CountryPage({ params }: Params) {
  const { crop, country } = await params;
  const id = isCrop(crop) ? await resolveSlug(crop, country) : null;
  if (!isCrop(crop) || !id) notFound();
  return <ExplorerPage crop={crop} country={id} />;
}
