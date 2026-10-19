import type { SeriesSource } from "./types";

/** Longest lead, in months, that the analysis and the lag slider cover. */
export const MAX_LAG = 24;

export interface FoodWindow {
  key: "all" | "early" | "late";
  label: string;
  profile: (number | null)[];
  best: { lag: number; r: number } | null;
}

export interface FoodPair {
  id: string;
  label: string;
  commodityName: string;
  benchmark: string;
  cpiName: string;
  cpiSource: SeriesSource;
  /** Monthly, from the first CPI month to `MAX_LAG` months past the latest commodity price. */
  dates: string[];
  /** UK CPI 12-month rate, % (null where not published). */
  cpi: (number | null)[];
  /** Commodity 12-month price change, %, NOT shifted: the chart shifts it by the chosen lag. */
  commodity: (number | null)[];
  lastCpi: string;
  lastCommodity: string;
  windows: FoodWindow[];
}

export interface FoodData {
  vintage: string;
  source: string;
  sourceUrl: string;
  pairs: FoodPair[];
}

