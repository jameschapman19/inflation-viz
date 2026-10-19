import assert from "node:assert/strict";
import test from "node:test";
import { birthYearRange, lifetimeFrom, type Sources } from "./lifetimeCore.ts";

const key = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}-01`;
const fill = (from: number, to: number, rate: (y: number, m: number) => number) => {
  const out = new Map<string, number>();
  for (let y = from; y <= to; y++) for (let m = 1; m <= 12; m++) out.set(key(y, m), rate(y, m));
  return out;
};

// CPI from 1990, a flat 2%; RPI from 1985, a flat 3%; both to Aug 2000.
const s: Sources = { cpi: fill(1990, 2000, () => 2), rpi: fill(1985, 2000, () => 3) };
for (const m of [9, 10, 11, 12]) {
  s.cpi.delete(key(2000, m));
  s.rpi.delete(key(2000, m));
}

test("the birth-year range runs from the first unbroken year to the last full one", () => {
  // Latest month is Aug 2000, so the last birth year is 1999. Rates exist for Aug 1985 onwards.
  assert.deepEqual(birthYearRange(s), { first: 1984, last: 1999 });
});

test("the multiple chains one 12-month rate per year, preferring CPI where both exist", () => {
  // Born 1992: rates for 1993..2000 are CPI (2%) → 8 steps.
  const life = lifetimeFrom(s, 1992);
  assert.ok(Math.abs(life.multiple - 1.02 ** 8) < 1e-9);
  assert.equal(life.rpiMonths, 0);
});

test("before CPI exists the chain uses RPI, and says how many months do", () => {
  // Born 1987: 1988, 1989 are RPI (3%), 1990..2000 are CPI (2%).
  const life = lifetimeFrom(s, 1987);
  assert.ok(Math.abs(life.multiple - 1.03 ** 2 * 1.02 ** 11) < 1e-9);
  assert.equal(life.rpiMonths, 36); // Jan 1987 .. Dec 1989
  assert.equal(life.dates[0], "1987-01-01");
  assert.equal(life.values[0], 3);
  assert.equal(life.values[36], 2);
});

test("the above-target share is counted over CPI months only", () => {
  const rising: Sources = { cpi: fill(1990, 2000, (y) => (y >= 1996 ? 3 : 1)), rpi: fill(1985, 2000, () => 9) };
  const life = lifetimeFrom(rising, 1987);
  // RPI months (9%) must not count as "above target".
  assert.equal(life.cpiMonths, life.values.length - life.rpiMonths);
  assert.equal(life.monthsAboveTarget, life.cpiMonths - fill(1990, 1995, () => 0).size);
});

test("the worst month names its measure", () => {
  const spike: Sources = { cpi: fill(1990, 2000, () => 2), rpi: fill(1985, 2000, (y, m) => (y === 1988 && m === 6 ? 20 : 3)) };
  const life = lifetimeFrom(spike, 1987);
  assert.deepEqual(life.peak, { ds: "1988-06-01", rate: 20, measure: "RPI" });
});

test("RPI's premium over CPI is the mean gap where both exist", () => {
  assert.ok(Math.abs(lifetimeFrom(s, 1992).rpiPremium! - 1) < 1e-9);
});

test("ages carry the measure of the year they describe", () => {
  const old: Sources = { cpi: fill(1989, 2000, () => 2), rpi: fill(1946, 2000, () => 5) };
  for (const m of [9, 10, 11, 12]) {
    old.cpi.delete(key(2000, m));
    old.rpi.delete(key(2000, m));
  }
  const ages = lifetimeFrom(old, 1950).ages;
  assert.deepEqual(
    ages.map((a) => [a.age, a.year, a.rate, a.measure]),
    [
      [10, 1960, 5, "RPI"],
      [18, 1968, 5, "RPI"],
      [25, 1975, 5, "RPI"],
      [30, 1980, 5, "RPI"],
      [40, 1990, 2, "CPI"],
    ],
  );
});

test("years outside the range are rejected", () => {
  assert.throws(() => lifetimeFrom(s, 1983), RangeError);
  assert.throws(() => lifetimeFrom(s, 2000), RangeError);
});
