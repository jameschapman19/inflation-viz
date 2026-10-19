import assert from 'node:assert/strict';
import test from 'node:test';
import { leaderChange, overtakeText } from './notable.ts';
import type { CropData } from './types.ts';

const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const build = (series: Record<string, (number | null)[]>): CropData => ({
  commodity: 'rice',
  years,
  countries: Object.fromEntries(
    Object.entries(series).map(([id, values]) => [id, Object.fromEntries(years.flatMap((y, i) => (values[i] == null ? [] : [[String(y), { production: values[i]! * 1e6, flags: {} }]])))]),
  ),
  prices: [],
});
const name = (id: string) => ({ IND: 'India', CHN: 'China' })[id] ?? id;
const mt = (t: number) => `${(t / 1e6).toFixed(1)}M t`;

test('a recent change of leader is reported with both latest figures', () => {
  const data = build({ CHN: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10], IND: [5, 5, 5, 5, 5, 5, 5, 5, 11, 12] });
  const change = leaderChange(data)!;
  assert.equal(change.year, 2023);
  assert.equal(change.to, 'IND');
  assert.equal(change.from, 'CHN');
  assert.equal(overtakeText(change, 'Rice', name, mt).text, "India overtook China as the world's largest rice producer in 2023 (12.0M t to 10.0M t in 2024).");
});

test('a change longer ago than the window is not news', () => {
  const data = build({ CHN: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10], IND: [5, 11, 11, 11, 11, 11, 11, 11, 11, 11] });
  // India has led since 2016: 8 years before the latest data.
  assert.equal(leaderChange(data), null);
});

test('a leader that simply stops reporting is not an overtake', () => {
  const data = build({ CHN: [10, 10, 10, 10, 10, 10, 10, 10, null, null], IND: [5, 5, 5, 5, 5, 5, 5, 5, 6, 6] });
  assert.equal(leaderChange(data), null);
});

test('no change of leader gives nothing', () => {
  assert.equal(leaderChange(build({ CHN: Array(10).fill(10), IND: Array(10).fill(5) })), null);
});

test('figures are left out when a country has no latest-year production', () => {
  const data = build({ CHN: [10, 10, 10, 10, 10, 10, 10, 10, 10, null], IND: [5, 5, 5, 5, 5, 5, 5, 5, 11, 12] });
  const text = overtakeText(leaderChange(data)!, 'Rice', name, mt).text;
  assert.equal(text, "India overtook China as the world's largest rice producer in 2023.");
});
