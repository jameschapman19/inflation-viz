import assert from 'node:assert/strict';
import test from 'node:test';
import { countryRefs, countryStripes, countryTrendDeviation, everInTop, extrapolate, leaders, leaderTally, meanPrice, producers, profileFor, ranked, slugify, trendDeviation, worldStripes, worldTrendDeviation, worldTotals } from './crops.ts';
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

test('producers lists countries that report in the latest year', () => {
  assert.deepEqual(producers(data).sort(), ['AAA', 'BBB', 'CCC']);
  const former = { ...data, countries: { ...data.countries, DDD: { '2018': { production: 5, flags: {} } } } };
  assert.deepEqual(producers(former).sort(), ['AAA', 'BBB', 'CCC']);
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

// Fifteen years: AAA grows by exactly 10 a year; BBB follows the same line but has a bad 2014; CCC only reports the last three years.
const longYears = Array.from({ length: 15 }, (_, i) => 2000 + i);
const longData: CropData = {
  commodity: 'wheat',
  years: longYears,
  countries: {
    AAA: Object.fromEntries(longYears.map((y, i) => [String(y), { production: 100 + 10 * i, flags: {} }])),
    BBB: Object.fromEntries(longYears.map((y, i) => [String(y), { production: y === 2014 ? 100 : 200 + 20 * i, flags: {} }])),
    CCC: Object.fromEntries([2012, 2013, 2014].map(y => [String(y), { production: 1000, flags: {} }])),
  },
  prices: [],
};

test('extrapolate continues a straight line exactly', () => {
  assert.ok(Math.abs(extrapolate([10, 20, 30, 40]) - 50) < 1e-9);
  assert.ok(Math.abs(extrapolate([5, 5, 5]) - 5) < 1e-9);
});

test('trendDeviation is zero on trend, signed off it, and null without a full window or a positive trend', () => {
  assert.ok(Math.abs(trendDeviation([10, 20, 30], 40)!) < 1e-9);
  assert.ok(Math.abs(trendDeviation([10, 20, 30], 36)! - (36 / 40 - 1) * 100) < 1e-9);
  assert.ok(trendDeviation([10, 20, 30], 44)! > 0);
  assert.equal(trendDeviation([10, null, 30], 40), null);
  assert.equal(trendDeviation([10, 20, 30], null), null);
  assert.equal(trendDeviation([30, 20, 10], 5), null); // the line has gone negative: no meaningful percentage
});

test('countryTrendDeviation needs ten prior years', () => {
  assert.equal(countryTrendDeviation(longData.countries.AAA, 2009), null);
  assert.ok(Math.abs(countryTrendDeviation(longData.countries.AAA, 2012)!) < 1e-9);
  assert.ok(countryTrendDeviation(longData.countries.BBB, 2014)! < -50);
});

test('worldTrendDeviation uses only countries that report the full window', () => {
  // CCC has no history before 2012, so it must not move the world figure.
  const withoutC = worldTrendDeviation({ ...longData, countries: { AAA: longData.countries.AAA, BBB: longData.countries.BBB } }, 2014);
  assert.equal(worldTrendDeviation(longData, 2014), withoutC);
  assert.ok(withoutC! < 0);
  assert.equal(worldTrendDeviation(longData, 2005), null);
});

test('stripes are aligned to the years and null where nothing can be measured', () => {
  const world = worldStripes(longData);
  assert.equal(world.length, longYears.length);
  assert.deepEqual(world.slice(0, 10), Array(10).fill(null));
  assert.ok(world[14]! < 0);
  assert.equal(countryStripes(longData, 'CCC').every(v => v === null), true);
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

test('bornFacts compares a birth year with the latest year', async () => {
  const { bornFacts } = await import('./born.ts');
  const facts = bornFacts(data, 2019);
  assert.equal(facts.then.production, 110 + 290);
  assert.equal(facts.now.production, 510);
  assert.ok(Math.abs(facts.productionMultiple - 510 / 400) < 1e-9);
  assert.equal(facts.yieldMultiple, 1);
  assert.deepEqual(facts.topThen.map(r => r.id), ['BBB', 'AAA']);
  assert.deepEqual(facts.topNow.map(r => r.id), ['BBB', 'AAA', 'CCC']);
  assert.deepEqual(facts.stripeYears, [2019, 2020, 2021, 2022, 2023, 2024]);
  assert.equal(facts.priceThen, null);
  assert.equal(facts.priceMultiple, null);
  assert.equal(facts.priceNow, (100 + 200 + 400) / 3);
});

test('bornFacts rejects years without a comparison', async () => {
  const { bornFacts } = await import('./born.ts');
  assert.throws(() => bornFacts(data, 2024), RangeError);
  assert.throws(() => bornFacts(data, 1950), RangeError);
});
