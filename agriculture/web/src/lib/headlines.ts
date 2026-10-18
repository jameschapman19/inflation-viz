import type { SatelliteExport, SatelliteObservation } from './types';

export type Rules = { minEarlierSeasons: number; minValidFraction: number; minAnomaly: number; minZ: number; minRegions: number; requireCropMask: boolean };
export const DEFAULT_RULES: Rules = { minEarlierSeasons: 5, minValidFraction: 0.5, minAnomaly: 0.05, minZ: 2, minRegions: 10, requireCropMask: true };
export type Headline = { id: string; name: string; kind: 'record_high' | 'record_low'; windowStart: string; windowDays: number; ndvi: number; normal: number; anomaly: number; z: number; seasons: number; text: string };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function windowLabel(windowStart: string, windowDays: number) {
  const month = MONTHS[Number(windowStart.slice(5, 7)) - 1];
  if (windowDays >= 28) return month;
  const day = Number(windowStart.slice(8, 10));
  return `${day <= 10 ? 'early' : day <= 20 ? 'mid' : 'late'} ${month}`;
}

/**
 * Record anomalies in the latest window. A claim fires only when the country has enough clear
 * earlier seasons for the same window, the new value beats every one of them, and it sits well
 * outside their spread. Whole-land-cover data never produces headlines: NDVI over forest and desert
 * says little about crops.
 */
export function headlines(data: SatelliteExport, rules: Rules = DEFAULT_RULES): Headline[] {
  if (rules.requireCropMask && !data.cropMask) return [];
  // Provisional windows are built from fewer days, so their composites read low; claims need complete ones.
  const clear = data.observations.filter(o => !o.provisional && o.validFraction >= rules.minValidFraction);
  const counts = new Map<string, number>();
  for (const o of clear) counts.set(o.windowStart, (counts.get(o.windowStart) ?? 0) + 1);
  const latest = [...counts].filter(([, n]) => n >= rules.minRegions).map(([w]) => w).sort().at(-1);
  if (!latest) return [];
  const key = latest.slice(5), year = Number(latest.slice(0, 4));
  const names = new Map(data.regions.map(r => [r.id, r.name]));
  const byRegion = new Map<string, SatelliteObservation[]>();
  for (const o of clear) if (o.windowStart.slice(5) === key) byRegion.set(o.region, [...(byRegion.get(o.region) ?? []), o]);
  const found: Headline[] = [];
  for (const [id, rows] of byRegion) {
    const current = rows.find(o => o.windowStart === latest);
    const earlier = rows.filter(o => Number(o.windowStart.slice(0, 4)) < year);
    if (!current || earlier.length < rules.minEarlierSeasons) continue;
    const values = earlier.map(o => o.ndvi);
    const normal = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.max(0.01, Math.sqrt(values.reduce((t, v) => t + (v - normal) ** 2, 0) / (values.length - 1)));
    const anomaly = current.ndvi - normal, z = anomaly / sd;
    const high = current.ndvi > Math.max(...values), low = current.ndvi < Math.min(...values);
    if (!(high || low) || Math.abs(anomaly) < rules.minAnomaly || Math.abs(z) < rules.minZ) continue;
    const name = names.get(id) ?? id;
    const when = windowLabel(latest, data.windowDays), span = earlier.length + 1;
    found.push({
      id, name, kind: high ? 'record_high' : 'record_low', windowStart: latest, windowDays: data.windowDays, ndvi: current.ndvi, normal, anomaly, z, seasons: span,
      text: `${name}'s ${data.cropMask} vegetation is the ${high ? 'greenest' : 'least green'} for ${when} in ${span} years of satellite data.`,
    });
  }
  return found.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
}
