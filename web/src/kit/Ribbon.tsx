// GENERATED from packages/web-kit/src — edit there, then run: node scripts/sync-web-kit.mjs
/** One cell of a ribbon: a month or year coloured by the category that led it. */
export interface RibbonCell {
  /** Any CSS colour, typically `light-dark(...)`. */
  color: string;
  /** Tooltip text, e.g. "Oct 2022: Housing (3.70ppt)". */
  title: string;
}

/** A strip aligned with a stripes strip: each position is coloured by its
 * category. Null cells (no data) are left empty. Pure markup, so it renders
 * on the server. */
export function CellRibbon({ cells, label }: { cells: (RibbonCell | null)[]; label: string }) {
  return (
    <svg className="ribbon-svg" viewBox={`0 0 ${cells.length} 1`} preserveAspectRatio="none" role="img" aria-label={label}>
      {cells.map((cell, i) =>
        cell ? (
          <rect key={i} x={i} width={1.02} height={1} shapeRendering="crispEdges" style={{ fill: cell.color }}>
            <title>{cell.title}</title>
          </rect>
        ) : null,
      )}
    </svg>
  );
}

export interface RibbonLegendEntry {
  id: string;
  color: string;
  label: string;
  /** Secondary text, e.g. "92 months". */
  note: string;
}

export function RibbonLegend({ entries }: { entries: RibbonLegendEntry[] }) {
  return (
    <ul className="ribbon-legend">
      {entries.map((entry) => (
        <li key={entry.id}>
          <span className="swatch" style={{ background: entry.color }} />
          {entry.label} <span className="muted">· {entry.note}</span>
        </li>
      ))}
    </ul>
  );
}
