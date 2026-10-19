import assert from "node:assert/strict";
import test from "node:test";
import { bestLag, correlationAtLag, lagProfile, shiftMonth, yearOnYear, type Monthly } from "./lagCorr.ts";

const months = (n: number, start = "2000-01-01") => Array.from({ length: n }, (_, i) => shiftMonth(start, i));
const series = (values: number[], start = "2000-01-01"): Monthly => new Map(months(values.length, start).map((ds, i) => [ds, values[i]]));

test("shiftMonth crosses year boundaries both ways", () => {
  assert.equal(shiftMonth("2020-11-01", 3), "2021-02-01");
  assert.equal(shiftMonth("2021-02-01", -3), "2020-11-01");
  assert.equal(shiftMonth("2020-01-01", -12), "2019-01-01");
  assert.equal(shiftMonth("2020-01-01", 0), "2020-01-01");
});

test("yearOnYear compares with the same month a year earlier", () => {
  const prices = months(14).map((date, i) => ({ date, value: 100 + i }));
  const out = yearOnYear(prices);
  assert.equal(out.size, 2);
  assert.ok(Math.abs(out.get("2001-01-01")! - (112 / 100 - 1) * 100) < 1e-9);
  assert.equal(out.has("2000-12-01"), false);
});

test("a series that follows another by k months peaks at lag k", () => {
  // A noisy-looking deterministic signal, then the same signal 5 months later.
  const signal = Array.from({ length: 120 }, (_, i) => Math.sin(i / 3) * 5 + Math.sin(i / 7) * 3);
  const lead = series(signal);
  const follow: Monthly = new Map();
  months(120).forEach((ds, i) => {
    if (i >= 5) follow.set(ds, signal[i - 5]);
  });
  const profile = lagProfile(lead, follow, 12, "2000-01-01", "2020-01-01");
  assert.equal(bestLag(profile)!.lag, 5);
  assert.ok(bestLag(profile)!.r > 0.99);
});

test("correlation is restricted to the requested window", () => {
  const a = series(Array.from({ length: 60 }, (_, i) => i));
  const b = series(Array.from({ length: 60 }, (_, i) => (i < 30 ? i : 60 - i)));
  const early = correlationAtLag(a, b, 0, "2000-01-01", "2002-07-01")!;
  const late = correlationAtLag(a, b, 0, "2002-07-01", "2005-01-01")!;
  assert.ok(early > 0.99);
  assert.ok(late < -0.99);
});

test("too few overlapping months, or a constant series, gives null", () => {
  const short = series([1, 2, 3, 4, 5]);
  assert.equal(correlationAtLag(short, short, 0, "2000-01-01", "2030-01-01"), null);
  const flat = series(Array(40).fill(3));
  assert.equal(correlationAtLag(flat, series(Array.from({ length: 40 }, (_, i) => i)), 0, "2000-01-01", "2030-01-01"), null);
  assert.equal(bestLag([{ lag: 0, r: null }]), null);
});
