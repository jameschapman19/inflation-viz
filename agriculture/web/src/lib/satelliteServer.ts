import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SatelliteExport } from './types';

const REVALIDATE_SECONDS = 300;

/**
 * The published global file. In production it comes from the object store named by
 * SATELLITE_DATA_BASE_URL, refreshed by the data pipeline with no deploy, and is cached for a few
 * minutes (`fresh` skips that cache; the API route uses it and lets the CDN cache instead, so a first
 * publish is never hidden behind a cached 404). Without that variable (local development) it reads public/data/satellite-global.json.
 * Returns null while nothing has been published; any other failure throws rather than hiding data.
 */
export async function loadGlobal(options: { fresh?: boolean } = {}): Promise<SatelliteExport | null> {
  const base = process.env.SATELLITE_DATA_BASE_URL;
  if (!base) {
    try {
      return JSON.parse(await readFile(join(process.cwd(), 'public/data/satellite-global.json'), 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }
  const response = await fetch(`${base.replace(/\/$/, '')}/global/latest.json`, options.fresh ? { cache: 'no-store' } : { next: { revalidate: REVALIDATE_SECONDS } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Satellite data store returned ${response.status}`);
  const data = await response.json();
  if (data.schemaVersion !== 1) throw new Error(`Unsupported satellite data schema ${data.schemaVersion}`);
  return data;
}
