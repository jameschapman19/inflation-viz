import type { RibbonCell as KitCell, RibbonLegendEntry } from "@/kit/Ribbon";
import { formatMonth } from "./format";
import type { RibbonCell, RibbonTally } from "./ribbon";

const color = (c: { light: string; dark: string }) => `light-dark(${c.light}, ${c.dark})`;

/** Leader cells in the shape the shared ribbon draws. */
export function toKitCells(cells: (RibbonCell | null)[], dates: string[]): (KitCell | null)[] {
  return cells.map((cell, i) =>
    cell ? { color: color(cell), title: `${formatMonth(dates[i])}: ${cell.name} (${cell.ppt.toFixed(2)}ppt)` } : null,
  );
}

export function toKitLegend(tally: RibbonTally[]): RibbonLegendEntry[] {
  return tally.map((t) => ({ id: t.coicop, color: color(t), label: t.name, note: `${t.months} ${t.months === 1 ? "month" : "months"}` }));
}
