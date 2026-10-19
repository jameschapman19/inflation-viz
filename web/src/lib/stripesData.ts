import { seriesFor } from "./data";

export interface StripesData {
  /** First of each month, ISO date strings. */
  dates: string[];
  /** CPI 12-month rate, %. */
  values: number[];
}

/** Every month of the headline CPI rate ONS publishes, oldest first. */
export function cpiStripes(): StripesData {
  const points = seriesFor("GB.CPI");
  return { dates: points.map((p) => p.ds), values: points.map((p) => p.y) };
}
