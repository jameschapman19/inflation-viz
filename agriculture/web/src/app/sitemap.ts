import type { MetadataRoute } from 'next';
import { CROPS } from '@/lib/crops';
import { SITE_URL } from '@/lib/site';
import { loadCrop, loadManifest } from '@/lib/server/load';
import { pagePaths } from '@/lib/server/page-data';

const PAGES = ['/', '/born', '/methodology', '/satellite', '/satellite/global'];

// Every page the site builds: the crop and country pages and the birth-year pages are the long tail.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date((await loadManifest()).generated_at);
  const perCrop = await Promise.all(
    CROPS.map(async crop => [
      `/${crop}`,
      ...(await pagePaths(crop)).map(({ slug }) => `/${crop}/${slug}`),
      ...(await loadCrop(crop)).years.slice(0, -1).map(year => `/born/${crop}/${year}`),
    ]),
  );
  return [...PAGES, ...perCrop.flat()].map(path => ({ url: `${SITE_URL}${path}`, lastModified }));
}
