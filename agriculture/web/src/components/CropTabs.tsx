'use client';
import Link from 'next/link';
import { Leaf, Sprout, Wheat } from 'lucide-react';
import { useEmbedSearch } from '@/kit/embedSearch';
import { CROPS } from '@/lib/crops';
import type { Crop } from '@/lib/types';

const ICONS = { wheat: Wheat, maize: Sprout, rice: Leaf };

/** The crop switcher: links keep `?embed=1`, so an embedded page stays embedded. */
export default function CropTabs({ current, hrefs, names, icons = true }: { current: Crop; hrefs: Record<Crop, string>; names: Record<Crop, string>; icons?: boolean }) {
  const embed = useEmbedSearch();
  return (
    <div className="crop-tabs" aria-label="Crop">
      {CROPS.map(c => {
        const Icon = ICONS[c];
        return (
          <Link key={c} href={`${hrefs[c]}${embed}`} className={current === c ? 'crop-tab selected' : 'crop-tab'} aria-current={current === c ? 'page' : undefined}>
            {icons && <Icon size={18} />}{names[c]}
          </Link>
        );
      })}
    </div>
  );
}
