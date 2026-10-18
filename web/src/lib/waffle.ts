import { divisionColor } from "./colors";
import { seriesFor, weightsSorted } from "./data";

export interface WaffleDivision {
  coicop: string;
  name: string;
  light: string;
  dark: string;
}

export interface WaffleData {
  years: number[];
  divisions: WaffleDivision[];
  /** `[year][division]` CPI basket weight, per mille of household spending. */
  weights: number[][];
}

export function buildWaffleData(): WaffleData {
  const sources = weightsSorted();
  const byDivision = sources.map((s) => new Map(seriesFor(s.unique_id).map((p) => [Number(p.ds.slice(0, 4)), p.y])));
  const years = [...byDivision[0].keys()].sort((a, b) => a - b);
  return {
    years,
    divisions: sources.map((s) => ({
      coicop: s.coicop as string,
      name: s.division_name as string,
      light: divisionColor(s.coicop as string, "light"),
      dark: divisionColor(s.coicop as string, "dark"),
    })),
    weights: years.map((year) =>
      byDivision.map((m, i) => {
        const weight = m.get(year);
        if (weight === undefined) throw new Error(`${sources[i].unique_id} has no weight for ${year}`);
        return weight;
      }),
    ),
  };
}
