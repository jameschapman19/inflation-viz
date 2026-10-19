import { formatMonth } from "./format.ts";
import { STRIPE_TARGET } from "./stripeColor.ts";

export interface Notable {
  /** Full sentence for the page. */
  text: string;
  /** One short line for a share card. */
  short: string;
}

/** Shortest run that is worth calling a streak. */
const MIN_STREAK = 6;
/** A rate has to be this many months from its last equal-or-better reading to be "the highest since". */
const MIN_GAP = 12;

type Point = { ds: string; y: number };

/**
 * Statements about the latest CPI reading that are clearly true of the data,
 * and nothing otherwise: an empty list is a normal answer. `points` must be
 * monthly and sorted by date.
 */
export function notableFacts(points: Point[]): Notable[] {
  const found: Notable[] = [];
  const last = points.length - 1;
  const latest = points[last];

  // How long the rate has been on one side of the target.
  const above = latest.y > STRIPE_TARGET;
  let run = 0;
  while (run <= last && points[last - run].y > STRIPE_TARGET === above) run++;
  if (run >= MIN_STREAK) {
    const side = above ? "above" : "at or below";
    const lastOther = run <= last ? formatMonth(points[last - run].ds) : null;
    found.push({
      text: `UK inflation has been ${side} the ${STRIPE_TARGET}% target for ${run} months in a row${lastOther ? `, last ${above ? "at or below" : "above"} it in ${lastOther}` : ""}.`,
      short: `${above ? "Above" : "At or below"} the ${STRIPE_TARGET}% target for ${run} months running`,
    });
  }

  // Highest (or lowest) reading for a long time: how far back one has to go to find one as extreme.
  for (const direction of ["highest", "lowest"] as const) {
    const beats = (other: number) => (direction === "highest" ? other >= latest.y : other <= latest.y);
    let back = last - 1;
    while (back >= 0 && !beats(points[back].y)) back--;
    if (back < 0) {
      found.push({ text: `${latest.y.toFixed(1)}% is the ${direction} rate since the series began in ${points[0].ds.slice(0, 4)}.`, short: `${direction[0].toUpperCase()}${direction.slice(1)} rate since ${points[0].ds.slice(0, 4)}` });
    } else if (last - back >= MIN_GAP) {
      const since = formatMonth(points[back].ds);
      found.push({ text: `${latest.y.toFixed(1)}% is the ${direction} rate since ${since}.`, short: `${direction[0].toUpperCase()}${direction.slice(1)} rate since ${since}` });
    }
  }
  return found;
}
