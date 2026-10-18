import type { Crop } from '@/lib/types';
import { explorerProps } from '@/lib/server/page-data';
import Explorer from './Explorer';

/** Server wrapper: loads the crop and hands the explorer its server-rendered starting state. */
export default async function ExplorerPage({ crop, country }: { crop: Crop; country: string }) {
  return <Explorer {...await explorerProps(crop, country)} />;
}
