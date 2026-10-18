import type { CropData, Metric, Observation } from './types';
export function changeFromBaseline(history: Record<string, Observation>, year: number): number | null {
  const current = history[String(year)]?.production;
  const prior = Array.from({ length: 5 }, (_, i) => history[String(year - i - 1)]?.production);
  if (current == null || prior.some(x => x == null)) return null;
  const mean = (prior as number[]).reduce((a, b) => a + b, 0) / 5;
  return mean > 0 ? (current / mean - 1) * 100 : null;
}
export function metricValue(data: CropData, country: string, year: number, metric: Metric): number | null {
  const history = data.countries[country];
  if (!history) return null;
  return metric === 'change' ? changeFromBaseline(history, year) : history[String(year)]?.[metric] ?? null;
}
export function coverage(data: CropData, year: number) {
  const observations = Object.entries(data.countries).filter(([, h]) => h[String(year)]?.production != null);
  return { countries: observations.length, total: observations.reduce((sum, [, h]) => sum + h[String(year)].production!, 0) };
}
export const number = (n: number, digits = 1) => new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(n);
export function compact(n: number | null | undefined, unit = 't') {
  if (n == null) return 'Unavailable';
  if (n >= 1e9) return `${number(n / 1e9, 2)}B ${unit}`;
  if (n >= 1e6) return `${number(n / 1e6, 2)}M ${unit}`;
  if (n >= 1e3) return `${number(n / 1e3, 1)}K ${unit}`;
  return `${number(n)} ${unit}`;
}
export function period(date: string, long = false) { return new Date(date + (date.length === 10 ? 'T12:00:00Z' : '')).toLocaleDateString('en', { month: long ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' }); }
export function releaseDate(date: string | null) { return date ? new Date(date.length === 10 ? `${date}T12:00:00Z` : date).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Publication date unavailable'; }
