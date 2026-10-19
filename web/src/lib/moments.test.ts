import assert from "node:assert/strict";
import test from "node:test";
import { extremes } from "./moments.ts";

test("finds the highest and lowest values as global indices", () => {
  // `values[0]` is global index 10.
  assert.deepEqual(extremes([3, 9, 1, 5], 10, 13), { peak: 11 + 0, low: 12 });
});

test("can stop before projected months", () => {
  const values = [2, 4, 3, 100];
  assert.deepEqual(extremes(values, 0, 2), { peak: 1, low: 0 });
  assert.deepEqual(extremes(values, 0, 3), { peak: 3, low: 0 });
});

test("the first of equal values wins and a single point is both", () => {
  assert.deepEqual(extremes([5, 5, 5], 0, 2), { peak: 0, low: 0 });
  assert.deepEqual(extremes([7], 4, 4), { peak: 4, low: 4 });
});
