import type { Metadata } from 'next';
import ExplorerPage from '@/components/ExplorerPage';
import { defaultCountry, pageMetadata } from '@/lib/server/page-data';

// The home page is the wheat explorer for its largest producer; /wheat is the same page, so say so.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata('wheat', await defaultCountry('wheat'));
}

export default async function Home() {
  return <ExplorerPage crop="wheat" country={await defaultCountry('wheat')} />;
}
