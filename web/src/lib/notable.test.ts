import assert from "node:assert/strict";
import test from "node:test";
import { notableFacts } from "./notable.ts";

const months = (rates: number[], start = "2020-01-01") =>
  rates.map((y, i) => {
    const total = Number(start.slice(0, 4)) * 12 + Number(start.slice(5, 7)) - 1 + i;
    return { ds: `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`, y };
  });

test("a long run above target is reported with the month it began after", () => {
  // Two months at target, then ten above.
  const out = notableFacts(months([2.0, 1.9, ...Array(10).fill(3.0)]));
  assert.equal(out[0].text, "UK inflation has been above the 2% target for 10 months in a row, last at or below it in Feb 2020.");
  assert.equal(out[0].short, "Above the 2% target for 10 months running");
});

test("a short run says nothing", () => {
  assert.deepEqual(notableFacts(months([2.0, 1.9, 3.0, 3.1, 2.9, 3.0])).filter((n) => n.text.includes("target")), []);
});

test("a long run at or below target is reported too", () => {
  const out = notableFacts(months([3.0, ...Array(7).fill(1.5)]));
  assert.match(out[0].text, /at or below the 2% target for 7 months in a row, last above it in Jan 2020/);
});

test("a series that has always been on one side has no 'last' month", () => {
  const out = notableFacts(months(Array(8).fill(3.0)));
  assert.equal(out[0].text, "UK inflation has been above the 2% target for 8 months in a row.");
});

test("'highest since' needs the last equal reading to be a year back", () => {
  // 4.0 in Jan 2020, then 14 months below 3, then 3.5: the highest since Jan 2020.
  const rates = [4.0, ...Array(14).fill(2.5), 3.5];
  const high = notableFacts(months(rates)).find((n) => n.text.includes("highest"));
  assert.equal(high?.text, "3.5% is the highest rate since Jan 2020.");
  // Too recent: only 5 months back.
  assert.equal(notableFacts(months([4.0, 2.5, 2.5, 2.5, 2.5, 3.5])).find((n) => n.text.includes("highest")), undefined);
});

test("a reading above everything in the series is the highest since it began", () => {
  const out = notableFacts(months([1.0, 1.5, 2.0, 5.0]));
  assert.equal(out.find((n) => n.text.includes("highest"))?.text, "5.0% is the highest rate since the series began in 2020.");
});

test("'lowest since' mirrors it", () => {
  const rates = [0.5, ...Array(14).fill(2.5), 1.0];
  assert.equal(notableFacts(months(rates)).find((n) => n.text.includes("lowest"))?.text, "1.0% is the lowest rate since Jan 2020.");
});
