import assert from 'node:assert/strict';
import test from 'node:test';
import { countryRefs, countryStripes, everInTop, leaders, leaderTally, meanPrice, producers, profileFor, ranked, slugify, worldChange, worldTotals } from './crops.ts';
import { harvestColor } from './harvest.ts';
import { colorFor } from './palette.ts';
import type { CropData, Manifest } from './types.ts';

// Three countries over seven years. AAA grows steadily; BBB falls then recovers; CCC reports only the last two years.
const years = [2018, 2019, 2020, 2021, 2022, 2023, 2024];
const series: Record<string, (number | null)[]> = {
  AAA: [100, 110, 120, 130, 140, 150, 160],
  BBB: [300, 290, 280, 270, 260, 250, 300],
  CCC: [null, null, null, null, null, 40, 50],
};
const data: CropData = {
  commodity: 'wheat',
  years,
  countries: Object.fromEntries(
    Object.entries(series).map(([id, values]) => [
      id,
      Object.fromEntries(years.flatMap((y, i) => (values[i] == null ? [] : [[String(y), { production: values[i]!, area: values[i]! / 2, yield: 2, flags: {} }]]))),
    ]),
  ),
  prices: [
    { date: '2018-01-01', value: 100 },
    { date: '2018-07-01', value: 200 },
    { date: '2024-01-01', value: 400 },
  ],
};

test('slugify strips accents, punctuation and ampersands', () => {
  assert.equal(slugify("Côte d'Ivoire"), 'cote-d-ivoire');
  assert.equal(slugify('Russian Federation'), 'russian-federation');
  assert.equal(slugify('Trinidad & Tobago'), 'trinidad-and-tobago');
});

test('countryRefs sorts by name and rejects duplicate slugs', () => {
  const country = (id: string, name: string) => [id, { id, name, provider_name: name, m49: '', provider_area_code: '' }] as const;
  const ok = { countries: Object.fromEntries([country('B', 'Bolivia'), country('A', 'Albania')]) } as Pick<Manifest, 'countries'>;
  assert.deepEqual(countryRefs(ok).map(c => c.slug), ['albania', 'bolivia']);
  const clash = { countries: Object.fromEntries([country('X', 'Côte'), country('Y', 'Cote')]) } as Pick<Manifest, 'countries'>;
  assert.throws(() => countryRefs(clash), /share the URL slug/);
});

test('ranked orders by production and skips countries without a report', () => {
  assert.deepEqual(ranked(data, 2024).map(r => r.id), ['BBB', 'AAA', 'CCC']);
  assert.deepEqual(ranked(data, 2018).map(r => r.id), ['BBB', 'AAA']);
});

test('producers lists countries with any production', () => {
  assert.deepEqual(producers(data).sort(), ['AAA', 'BBB', 'CCC']);
});

test('profileFor gives rank, share, change and history', () => {
  const p = profileFor(data, 'AAA', 2024);
  assert.equal(p.rank, 2);
  assert.equal(p.of, 3);
  assert.ok(Math.abs(p.share! - (160 / 510) * 100) < 1e-9);
  assert.ok(Math.abs(p.change! - (160 / 130 - 1) * 100) < 1e-9); // baseline 2019–2023 mean = 130
  assert.equal(p.history.length, 7);
  assert.equal(profileFor(data, 'CCC', 2018).rank, null);
  assert.equal(profileFor(data, 'ZZZ', 2024).observation, null);
});

test('worldChange uses only countries that report the full window', () => {
  // CCC lacks a five-year baseline, so it must not inflate the 2024 change.
  const baseline = 130 + (290 + 280 + 270 + 260 + 250) / 5; // AAA mean(110..150) + BBB mean(290..250)
  assert.ok(Math.abs(worldChange(data, 2024)! - ((160 + 300) / baseline - 1) * 100) < 1e-9);
  assert.equal(worldChange(data, 2019), null);
});

test('countryStripes is null until five prior years exist', () => {
  const stripes = countryStripes(data, 'AAA');
  assert.deepEqual(stripes.slice(0, 5), [null, null, null, null, null]);
  assert.ok(stripes[5] != null && stripes[6] != null);
});

test('leaders and tally follow the largest producer each year', () => {
  const all = leaders(data);
  assert.deepEqual(all.map(l => l?.id), ['BBB', 'BBB', 'BBB', 'BBB', 'BBB', 'BBB', 'BBB']);
  assert.deepEqual(leaderTally(all), [{ id: 'BBB', years: 7 }]);
});

test('everInTop keeps one row per country that ever made the cut', () => {
  assert.deepEqual(everInTop(data, 1), ['BBB']);
  assert.deepEqual(everInTop(data, 2).sort(), ['AAA', 'BBB']);
});

test('worldTotals needs production and area together', () => {
  const t = worldTotals(data, 2024);
  assert.equal(t.production, 510);
  assert.equal(t.area, 255);
  assert.equal(t.yield, 2);
  assert.equal(t.countries, 3);
});

test('meanPrice averages the months of a year', () => {
  assert.equal(meanPrice(data.prices, 2018), 150);
  assert.equal(meanPrice(data.prices, 2020), null);
});

test('harvestColor is grey at zero and reaches the poles at the limit', () => {
  assert.equal(harvestColor(0), '#5a6770');
  assert.equal(harvestColor(20), '#79ccd0');
  assert.equal(harvestColor(-50), '#d79256');
  assert.notEqual(harvestColor(3), harvestColor(-3));
});

test('colorFor assigns by order and folds the rest into Other', () => {
  const order = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
  assert.notEqual(colorFor(order, 'a'), colorFor(order, 'b'));
  assert.equal(colorFor(order, 'i'), colorFor(order, 'zzz'));
});
