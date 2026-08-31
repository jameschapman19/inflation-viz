import Link from "next/link";
import { Chart } from "@/components/Chart";
import { divisionColor } from "@/lib/colors";
import { divisionsSorted, forecast, hasForecast, topLevelWeightChildren } from "@/lib/data";

export const metadata = { title: "Contributors — Inflation Radar (UK)" };

export default function ContributorsPage() {
  const divisions = divisionsSorted();
  const weightChildren = topLevelWeightChildren();
  const missingNames = hasForecast()
    ? divisions
        .filter((d) => d.coicop && forecast.coverage.missing.includes(d.unique_id))
        .map((d) => d.division_name)
    : [];

  return (
    <>
      <section className="page-header">
        <h1>Contribution to headline CPI by division</h1>
        <p className="lede">
          Each division&apos;s percentage-point contribution to the headline 12-month CPI rate, as
          published by ONS — not reconstructed from index and weight, so it reflects ONS&apos;s own
          vintage weighting.
          {hasForecast() && (
            <>
              {" "}Dashed bands past the last real month are this project&apos;s own short-term
              projection, not ONS data — see <Link href="/methodology">Methodology</Link>.
              {missingNames.length > 0 && (
                <> Not yet projected: {missingNames.join(", ")}.</>
              )}
            </>
          )}
        </p>
      </section>

      <section className="chart-section">
        <Chart chart="contributors" />
      </section>

      <p className="muted">Click a division&apos;s band on the chart, or a name below, to see it on its own.</p>
      <section className="legend-table">
        <table>
          <thead>
            <tr>
              <th>Division</th>
              <th>Series</th>
            </tr>
          </thead>
          <tbody>
            {divisions.map((d) => (
              <tr key={d.unique_id}>
                <td>
                  <span
                    className="swatch"
                    style={{ background: d.coicop ? divisionColor(d.coicop, "dark") : "#898781" }}
                  />
                  {d.coicop ? (
                    <Link href={`/division/${d.coicop}`}>{d.division_name}</Link>
                  ) : (
                    d.division_name
                  )}
                </td>
                <td>
                  <a href={d.source_url}>{d.cdid}</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {weightChildren.length > 0 && (
        <section>
          <h2>Basket weight by division</h2>
          <p className="lede">
            Each division&apos;s share of the household basket over time, in per mille (parts per
            1000) — weights are additive, so unlike contribution they stack validly. Refreshed by
            ONS each January/February.
          </p>
          <div className="chart-section">
            <Chart chart="stacked-weight" entries={weightChildren} drillBasePath="/division" />
          </div>
        </section>
      )}
    </>
  );
}
