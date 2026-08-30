import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chart } from "@/components/Chart";
import { subdivisionColor } from "@/lib/colors";
import {
  seriesFor,
  subdivisionByCoicop,
  subdivisionsSorted,
  subdivisionsUnder,
  subdivisionWeightByCoicop,
} from "@/lib/data";

export function generateStaticParams() {
  return subdivisionsSorted().map((s) => ({ coicop: s.coicop as string }));
}

export async function generateMetadata({ params }: { params: Promise<{ coicop: string }> }) {
  const { coicop } = await params;
  const subdivision = subdivisionByCoicop(coicop);
  return { title: `${subdivision?.division_name ?? coicop} — Inflation Radar (UK)` };
}

export default async function SubdivisionPage({ params }: { params: Promise<{ coicop: string }> }) {
  const { coicop } = await params;
  const subdivision = subdivisionByCoicop(coicop);
  const weight = subdivisionWeightByCoicop(coicop);
  if (!subdivision) notFound();

  const parentCoicop = subdivision.parent_coicop ?? "";
  const isParentTopLevelDivision = !parentCoicop.includes(".");
  const parentHref = isParentTopLevelDivision ? `/division/${parentCoicop}` : `/subdivision/${parentCoicop}`;

  const ratePoints = seriesFor(subdivision.unique_id);
  const latestRate = ratePoints[ratePoints.length - 1];
  const weightPoints = weight ? seriesFor(weight.unique_id) : [];
  const latestWeight = weightPoints[weightPoints.length - 1];
  const color = subdivisionColor(coicop);
  const children = subdivisionsUnder(coicop);

  return (
    <>
      <section className="page-header">
        <span className="pill" style={{ "--accent": color } as CSSProperties}>
          COICOP {coicop}
        </span>
        <h1>{subdivision.division_name}</h1>
        <p className="lede">
          A sub-category within <Link href={parentHref}>{parentCoicop}</Link>. This is the
          sub-category&apos;s own 12-month rate of change — a different thing from the ppt
          contribution shown on the top-level division pages, since ONS only publishes that
          contribution measure at the 2-digit division level.
        </p>
      </section>

      <div className="stat-row">
        {latestRate && (
          <div className="stat-tile">
            <div className="stat-label">12-month rate</div>
            <div className="stat-value">{latestRate.y.toFixed(1)}%</div>
            <div className="stat-meta">
              {latestRate.ds} · <a href={subdivision.source_url}>{subdivision.cdid}</a>
            </div>
          </div>
        )}
        {latestWeight && weight && (
          <div className="stat-tile">
            <div className="stat-label">Basket weight</div>
            <div className="stat-value">{latestWeight.y.toFixed(1)}‰</div>
            <div className="stat-meta">
              {latestWeight.ds} · <a href={weight.source_url}>{weight.cdid}</a>
            </div>
          </div>
        )}
      </div>

      <section>
        <h2>12-month rate</h2>
        <div className="chart-section">
          <Chart chart="subdivision-rate" coicop={coicop} height="360px" />
        </div>
      </section>

      {weight && (
        <section>
          <h2>Basket weight over time</h2>
          <div className="chart-section">
            <Chart chart="subdivision-weight" coicop={coicop} height="320px" />
          </div>
        </section>
      )}

      {children.length > 0 && (
        <section>
          <h2>Sub-categories</h2>
          <div className="legend-table">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Series</th>
                </tr>
              </thead>
              <tbody>
                {children.map((c) => (
                  <tr key={c.unique_id}>
                    <td>
                      <span
                        className="swatch"
                        style={{ background: c.coicop ? subdivisionColor(c.coicop, "dark") : "#898781" }}
                      />
                      <Link href={`/subdivision/${c.coicop}`}>{c.division_name}</Link>
                    </td>
                    <td>
                      <a href={c.source_url}>{c.cdid}</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <nav className="division-pager">
        <Link href={parentHref}>&larr; Back to {parentCoicop}</Link>
        <Link href="/contributors">All divisions</Link>
      </nav>
    </>
  );
}
