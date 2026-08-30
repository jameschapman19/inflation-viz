import type { ReactNode } from "react";
import Link from "next/link";
import type { ChartKind } from "@/components/Chart";
import { Chart } from "@/components/Chart";
import { childColor } from "@/lib/colors";
import type { ChildSeries } from "@/lib/data";
import type { SeriesPoint, SeriesSource } from "@/lib/types";

/** One "latest value" tile in a detail page's stat row (12-month rate,
 * contribution to headline CPI, or basket weight). */
export function StatTile({
  label,
  point,
  format,
  source,
}: {
  label: string;
  point: SeriesPoint | undefined;
  format: (y: number) => string;
  source: SeriesSource;
}) {
  if (!point) return null;
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{format(point.y)}</div>
      <div className="stat-meta">
        {point.ds} · <a href={source.source_url}>{source.cdid}</a>
      </div>
    </div>
  );
}

/** A `<section>` wrapping one chart, with an optional intro paragraph —
 * the "Basket weight over time" / "by sub-category" / rate-comparison
 * blocks repeated on every division and subdivision page. */
export function ChartSection({
  heading,
  lede,
  chart,
  coicop,
  entries,
  drillBasePath,
  height,
}: {
  heading: string;
  lede?: ReactNode;
  chart: ChartKind;
  coicop?: string;
  entries?: ChildSeries[];
  drillBasePath?: string;
  height: string;
}) {
  return (
    <section>
      <h2>{heading}</h2>
      {lede && <p className="lede">{lede}</p>}
      <div className="chart-section">
        <Chart chart={chart} coicop={coicop} entries={entries} drillBasePath={drillBasePath} height={height} />
      </div>
    </section>
  );
}

/** The "Sub-categories" table on a division/subdivision page — each row a
 * child sub-category, linked to its own subdivision page. */
export function SubcategoryTable({
  rows,
  showCoicopColumn,
}: {
  rows: SeriesSource[];
  showCoicopColumn: boolean;
}) {
  return (
    <section>
      <h2>Sub-categories</h2>
      <div className="legend-table">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              {showCoicopColumn && <th>COICOP</th>}
              <th>Series</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={s.unique_id}>
                <td>
                  <span
                    className="swatch"
                    style={{ background: s.coicop ? childColor(s.coicop, i, rows.length, "dark") : "#898781" }}
                  />
                  <Link href={`/subdivision/${s.coicop}`}>{s.division_name}</Link>
                </td>
                {showCoicopColumn && <td>{s.coicop}</td>}
                <td>
                  <a href={s.source_url}>{s.cdid}</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
