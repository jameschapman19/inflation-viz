import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_RULES, headlines, windowLabel } from './headlines.ts';
import type { SatelliteExport } from './types.ts';

// Seven earlier Junes per country at the given NDVIs, then 2025.
function data(current: Record<string, number>, earlier: Record<string, number[]>, over: Partial<SatelliteExport> = {}): SatelliteExport {
  const observations = Object.entries(current).flatMap(([region, ndvi]) => [
    { region, windowStart: '2025-06-01', ndvi, validFraction: 0.9, nObservations: 12 },
    ...(earlier[region] ?? []).map((v, i) => ({ region, windowStart: `${2024 - i}-06-01`, ndvi: v, validFraction: 0.9, nObservations: 12 })),
  ]);
  return { schemaVersion: 1, status: 'experimental', source: 's', vintage: 'v', generatedAt: '2026-01-01T00:00:00Z', windowDays: 30, cropMask: 'cropland', regions: Object.keys(current).map(id => ({ id, name: id.toUpperCase() })), observations, ...over };
}
const base = [0.5, 0.52, 0.48, 0.51, 0.49, 0.5, 0.52];
const many = (n: number, ...special: [string, number][]) => ({ ...Object.fromEntries(Array.from({ length: n }, (_, i) => [`c${i}`, 0.5])), ...Object.fromEntries(special) });
const history = (extra: string[]) => ({ ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`c${i}`, base])), ...Object.fromEntries(extra.map(id => [id, base])) });
const rules = { ...DEFAULT_RULES, minRegions: 5 };

test('fires only for records outside the earlier spread', () => {
  const out = headlines(data(many(12, ['hi', 0.7], ['lo', 0.3], ['mid', 0.53]), history(['hi', 'lo', 'mid'])), rules);
  assert.deepEqual(out.map(h => [h.id, h.kind]).sort(), [['hi', 'record_high'], ['lo', 'record_low']]);
  assert.match(out.find(h => h.id === 'hi')!.text, /HI's cropland vegetation is the greenest for June in 8 years/);
});

test('ranks by how far outside normal, in standard deviations', () => {
  const out = headlines(data(many(12, ['a', 0.62], ['b', 0.75]), history(['a', 'b'])), rules);
  assert.deepEqual(out.map(h => h.id), ['b', 'a']);
});

test('needs enough earlier seasons', () => {
  const short = { ...history(['x']), x: base.slice(0, 4) };
  assert.equal(headlines(data(many(12, ['x', 0.8]), short), rules).length, 0);
});

test('ignores poorly observed windows', () => {
  const d = data(many(12, ['x', 0.8]), history(['x']));
  d.observations = d.observations.map(o => (o.region === 'x' && o.windowStart === '2025-06-01' ? { ...o, validFraction: 0.2 } : o));
  assert.equal(headlines(d, rules).length, 0);
});

test('never headlines whole-land-cover data', () => {
  assert.equal(headlines(data(many(12, ['x', 0.8]), history(['x'])), rules).length > 0, true);
  assert.deepEqual(headlines(data(many(12, ['x', 0.8]), history(['x']), { cropMask: null }), rules), []);
});

test('needs enough regions reporting in the latest window', () => {
  assert.deepEqual(headlines(data({ x: 0.8 }, { x: base })), []);
});

test('labels windows', () => {
  assert.equal(windowLabel('2025-06-01', 30), 'June');
  assert.equal(windowLabel('2025-06-15', 10), 'mid June');
});

test('provisional windows never produce headlines', () => {
  const d = data(many(12, ['x', 0.8]), history(['x']));
  d.observations = d.observations.map(o => (o.windowStart === '2025-06-01' ? { ...o, provisional: true } : o));
  assert.deepEqual(headlines(d, rules), []);
});
