import commodityPrices from "@/data/commodity-prices.json";
import { registry, seriesFor } from "./data";
import { bestLag, lagProfile, shiftMonth, yearOnYear, type Monthly } from "./lagCorr";
import { MAX_LAG, type FoodData, type FoodPair, type FoodWindow } from "./foodTypes";

type Crop = "wheat" | "maize" | "rice";

interface PairSpec {
  id: string;
  label: string;
  crop: Crop;
  coicop: string;
}

// Wheat is the input to bread and to bread-and-cereals; rice is the only other
// crop with its own CPI class. Maize has no UK CPI counterpart.
const PAIRS: PairSpec[] = [
  { id: "bread", label: "Wheat → bread", crop: "wheat", coicop: "01.1.1.3" },
  { id: "cereals", label: "Wheat → bread and cereals", crop: "wheat", coicop: "01.1.1" },
  { id: "rice", label: "Rice → rice", crop: "rice", coicop: "01.1.1.1" },
];

const year = (ds: string) => ds.slice(0, 4);

function buildPair(spec: PairSpec): FoodPair {
  const cpiSource = registry.subdivisions.find((s) => s.coicop === spec.coicop);
  if (!cpiSource) throw new Error(`No CPI series for ${spec.coicop}`);
  const cpiPoints = seriesFor(cpiSource.unique_id);
  const cpi: Monthly = new Map(cpiPoints.map((p) => [p.ds, p.y]));
  const info = commodityPrices.commodities[spec.crop];
  const commodity = yearOnYear(info.prices);

  const firstCpi = cpiPoints[0].ds;
  const lastCpi = cpiPoints[cpiPoints.length - 1].ds;
  const lastCommodity = info.prices[info.prices.length - 1].date;
  const lastDate = shiftMonth(lastCommodity, MAX_LAG);

  const dates: string[] = [];
  for (let ds = firstCpi; ds <= lastDate; ds = shiftMonth(ds, 1)) dates.push(ds);

  // The two periods are the halves of the sample, fixed by the data's own
  // span rather than chosen to flatter a story.
  const midpoint = cpiPoints[Math.floor(cpiPoints.length / 2)].ds;
  const end = shiftMonth(lastCpi, 1);
  const window = (key: FoodWindow["key"], label: string, from: string, to: string): FoodWindow => {
    const profile = lagProfile(commodity, cpi, MAX_LAG, from, to);
    return { key, label, profile: profile.map((p) => p.r), best: bestLag(profile) };
  };

  return {
    id: spec.id,
    label: spec.label,
    commodityName: info.name,
    benchmark: info.benchmark,
    cpiName: cpiSource.division_name ?? cpiSource.name,
    cpiSource,
    dates,
    cpi: dates.map((ds) => cpi.get(ds) ?? null),
    commodity: dates.map((ds) => commodity.get(ds) ?? null),
    lastCpi,
    lastCommodity,
    windows: [
      window("all", `${year(firstCpi)}–${year(lastCpi)}`, firstCpi, end),
      window("early", `${year(firstCpi)}–${year(midpoint)}`, firstCpi, midpoint),
      window("late", `${year(midpoint)}–${year(lastCpi)}`, midpoint, end),
    ],
  };
}

export function buildFoodData(): FoodData {
  return {
    vintage: commodityPrices.vintage,
    source: commodityPrices.source,
    sourceUrl: commodityPrices.sourceUrl,
    pairs: PAIRS.map(buildPair),
  };
}
