import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chart } from "@/components/Chart";
import { childColor, divisionColor } from "@/lib/colors";
import {
  childRateSeriesOf,
  childWeightSeriesOf,
  divisionByCoicop,
  divisionsSorted,
  seriesFor,
  subdivisionsUnderDivision,
  weightByCoicop,
} from "@/lib/data";

export function generateStaticParams() {
  return divisionsSorted()
    .filter((d) => d.coicop)
    .map((d) => ({ coicop: d.coicop as string }));
}

export async function generateMetadata({ params }: { params: Promise<{ coicop: string }> }) {
  const { coicop } = await params;
  const division = divisionByCoicop(coicop);
  return { title: `${division?.division_name ?? coicop} — Inflation Radar (UK)` };
}

export default async function DivisionPage({ params }: { params: Promise<{ coicop: string }> }) {
  const { coicop } = await params;
  const division = divisionByCoicop(coicop);
  const weight = weightByCoicop(coicop);
  if (!division) notFound();

  const contributionPoints = seriesFor(division.unique_id);
  const latestContribution = contributionPoints[contributionPoints.length - 1];
  const weightPoints = weight ? seriesFor(weight.unique_id) : [];
  const latestWeight = weightPoints[weightPoints.length - 1];
  const color = divisionColor(coicop);
  const subdivisions = subdivisionsUnderDivision(coicop);
  const childRates = childRateSeriesOf(coicop);
  const childWeights = childWeightSeriesOf(coicop);

  return (
    <>
      <section className="page-header">
        <span className="pill" style={{ "--accent": color } as CSSProperties}>
          COICOP {coicop}
        </span>
        <h1>{division.division_name}</h1>
        <p className="lede">
          This division&apos;s own contribution to headline CPI and its share of the household
          basket, isolated from the other 11 — see{" "}
          <a href="/contributors">Contributors</a> for the full stacked picture.
        </p>
      </section>

      <div className="stat-row">
        {latestContribution && (
          <div className="stat-tile">
            <div className="stat-label">Contribution to headline CPI</div>
            <div className="stat-value">{latestContribution.y.toFixed(2)}ppt</div>
            <div className="stat-meta">
              {latestContribution.ds} · <a href={division.source_url}>{division.cdid}</a>
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
        <h2>Contribution to headline CPI</h2>
        <div className="chart-section">
          <Chart chart="division-contribution" coicop={coicop} height="360px" />
        </div>
      </section>

      {weight && (
        <section>
          <h2>Basket weight over time</h2>
          <div className="chart-section">
            <Chart chart="division-weight" coicop={coicop} height="320px" />
          </div>
        </section>
      )}

      {childWeights.length > 0 && (
        <section>
          <h2>Basket weight by sub-category</h2>
          <p className="lede">
            {division.division_name}&apos;s basket weight, broken down into its own sub-categories
            over time — additive, so this stacks validly (unlike rates, below).
          </p>
          <div className="chart-section">
            <Chart chart="stacked-weight" entries={childWeights} drillBasePath="/subdivision" height="360px" />
          </div>
        </section>
      )}

      {childRates.length > 0 && (
        <section>
          <h2>Sub-category 12-month rates</h2>
          <p className="lede">
            Each sub-category&apos;s own rate of change, compared side by side — these are
            independent rates rather than pre-weighted contributions, so they&apos;re shown as
            separate lines rather than stacked (stacking rates would produce a number that
            doesn&apos;t mean anything).
          </p>
          <div className="chart-section">
            <Chart chart="multiline-rate" entries={childRates} drillBasePath="/subdivision" height="360px" />
          </div>
        </section>
      )}

      {subdivisions.length > 0 && (
        <section>
          <h2>Sub-categories</h2>
          <p className="lede">
            Drill further in — ONS publishes these below the division level as each
            category&apos;s own 12-month rate and basket weight, not as a contribution to headline
            CPI (that measure only exists at the division level shown above).
          </p>
          <div className="legend-table">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>COICOP</th>
                  <th>Series</th>
                </tr>
              </thead>
              <tbody>
                {subdivisions.map((s, i) => (
                  <tr key={s.unique_id}>
                    <td>
                      <span
                        className="swatch"
                        style={{
                          background: s.coicop ? childColor(s.coicop, i, subdivisions.length, "dark") : "#898781",
                        }}
                      />
                      <Link href={`/subdivision/${s.coicop}`}>{s.division_name}</Link>
                    </td>
                    <td>{s.coicop}</td>
                    <td>
                      <a href={s.source_url}>{s.cdid}</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <DivisionPager coicop={coicop} />
    </>
  );
}

function DivisionPager({ coicop }: { coicop: string }) {
  const all = divisionsSorted().filter((d) => d.coicop);
  const index = all.findIndex((d) => d.coicop === coicop);
  const prev = all[(index - 1 + all.length) % all.length];
  const next = all[(index + 1) % all.length];

  return (
    <nav className="division-pager">
      <Link href={`/division/${prev.coicop}`}>&larr; {prev.division_name}</Link>
      <Link href="/contributors">All divisions</Link>
      <Link href={`/division/${next.coicop}`}>{next.division_name} &rarr;</Link>
    </nav>
  );
}
