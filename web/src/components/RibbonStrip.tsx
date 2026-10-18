import type { RibbonCell, RibbonLegendEntry } from "@/lib/ribbon";
import { formatMonth } from "@/lib/format";

/** A strip aligned with the headline stripes: each month is coloured by the
 * division that contributed most. Months without division data are left
 * empty. Pure markup, so it renders on the server. */
export function RibbonStrip({ cells, dates }: { cells: (RibbonCell | null)[]; dates: string[] }) {
  return (
    <svg
      className="ribbon-svg"
      viewBox={`0 0 ${cells.length} 1`}
      preserveAspectRatio="none"
      role="img"
      aria-label="The division contributing most to inflation each month"
    >
      {cells.map((cell, i) =>
        cell ? (
          <rect key={i} x={i} width={1.02} height={1} shapeRendering="crispEdges" style={{ fill: `light-dark(${cell.light}, ${cell.dark})` }}>
            <title>{`${formatMonth(dates[i])}: ${cell.name} (${cell.ppt.toFixed(2)}ppt)`}</title>
          </rect>
        ) : null,
      )}
    </svg>
  );
}

export function RibbonLegend({ entries }: { entries: RibbonLegendEntry[] }) {
  return (
    <ul className="ribbon-legend">
      {entries.map((entry) => (
        <li key={entry.coicop}>
          <span className="swatch" style={{ background: `light-dark(${entry.light}, ${entry.dark})` }} />
          {entry.name} <span className="muted">· {entry.months} {entry.months === 1 ? "month" : "months"}</span>
        </li>
      ))}
    </ul>
  );
}
