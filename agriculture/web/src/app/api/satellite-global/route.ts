import { loadGlobal } from '@/lib/satelliteServer';

// Always rendered at request time; the CDN cache headers below do the caching, so an empty store
// (404) is never kept and a newly published file is served within minutes.
export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await loadGlobal({ fresh: true });
  if (!data) return Response.json({ error: 'No satellite data published yet' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return Response.json(data, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } });
}
