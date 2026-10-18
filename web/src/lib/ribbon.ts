import { divisionColor } from "./colors";
import { divisionsSorted, seriesFor } from "./data";

export interface RibbonCell {
  coicop: string;
  name: string;
  light: string;
  dark: string;
  /** The leader's percentage-point contribution that month. */
  ppt: number;
}

export interface RibbonTally extends Omit<RibbonCell, "ppt"> {
  months: number;
}

/** For each month, the division contributing most to the headline rate, or
 * null where ONS publishes no division contributions (before Nov 2003). */
export function leadingDivisions(dates: string[]): (RibbonCell | null)[] {
  const divisions = divisionsSorted().map((d) => ({
    coicop: d.coicop as string,
    name: d.division_name as string,
    light: divisionColor(d.coicop as string, "light"),
    dark: divisionColor(d.coicop as string, "dark"),
    byDate: new Map(seriesFor(d.unique_id).map((p) => [p.ds, p.y])),
  }));

  return dates.map((ds) => {
    let leader: RibbonCell | null = null;
    for (const { byDate, ...division } of divisions) {
      const ppt = byDate.get(ds);
      if (ppt === undefined) return null;
      if (leader === null || ppt > leader.ppt) leader = { ...division, ppt };
    }
    return leader;
  });
}

/** The divisions that led at least one month, most months first. */
export function ribbonLegend(cells: (RibbonCell | null)[]): RibbonTally[] {
  const tally = new Map<string, RibbonTally>();
  for (const cell of cells) {
    if (!cell) continue;
    const entry = tally.get(cell.coicop);
    if (entry) entry.months++;
    else tally.set(cell.coicop, { coicop: cell.coicop, name: cell.name, light: cell.light, dark: cell.dark, months: 1 });
  }
  return [...tally.values()].sort((a, b) => b.months - a.months);
}
