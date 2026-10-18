import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FeatureCollection, Geometry } from 'geojson';
import type { Crop, CropData, Forecast, Manifest } from '../types.ts';

// The pipeline writes these files into public/data; pages read the same files
// the browser later fetches, so what is server-rendered and what is
// interactive always come from one vintage.
const dataDir = path.join(process.cwd(), 'public', 'data');
const cache = new Map<string, Promise<unknown>>();

function read<T>(file: string): Promise<T> {
  let found = cache.get(file) as Promise<T> | undefined;
  if (!found) {
    found = readFile(path.join(dataDir, file), 'utf8').then(text => JSON.parse(text) as T);
    cache.set(file, found);
  }
  return found;
}

export const loadManifest = () => read<Manifest>('manifest.json');
export const loadCrop = (crop: Crop) => read<CropData>(`${crop}.json`);
// A crop's price forecast is optional: no file means none published. Any other failure is real.
export const loadForecast = () =>
  read<Forecast>('forecast.json').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
export const loadGeography = () => read<FeatureCollection<Geometry, { id: string; name: string }>>('geography.geojson');
