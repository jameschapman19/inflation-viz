import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ExplorerPage from '@/components/ExplorerPage';
import { CROPS, isCrop } from '@/lib/crops';
import { defaultCountry, pageMetadata } from '@/lib/server/page-data';

export const dynamicParams = false;

export function generateStaticParams() {
  return CROPS.map(crop => ({ crop }));
}

export async function generateMetadata({ params }: { params: Promise<{ crop: string }> }): Promise<Metadata> {
  const { crop } = await params;
  return isCrop(crop) ? pageMetadata(crop, await defaultCountry(crop)) : {};
}

export default async function CropPage({ params }: { params: Promise<{ crop: string }> }) {
  const { crop } = await params;
  if (!isCrop(crop)) notFound();
  return <ExplorerPage crop={crop} country={await defaultCountry(crop)} />;
}
