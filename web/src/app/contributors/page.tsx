import Link from "next/link";
import { Chart } from "@/components/Chart";
import { divisionColor } from "@/lib/colors";
import { divisionsSorted } from "@/lib/data";

export const metadata = { title: "Contributors — Inflation Radar (UK)" };

export default function ContributorsPage() {
  const divisions = divisionsSorted();

  return (
    <>
      <section className="page-header">
        <h1>Contribution to headline CPI by division</h1>
        <p className="lede">
          Each division&apos;s percentage-point contribution to the headline 12-month CPI rate, as
          published by ONS — not reconstructed from index and weight, so it reflects ONS&apos;s own
          vintage weighting.
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
    </>
  );
}
