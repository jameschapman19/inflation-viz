import Link from "next/link";
import { Chart } from "@/components/Chart";
import { divisionColor } from "@/lib/colors";
import { latestWeights } from "@/lib/data";

export const metadata = { title: "Basket explorer — Inflation Radar (UK)" };

export default function BasketPage() {
  const weights = latestWeights();

  return (
    <>
      <section className="page-header">
        <h1>Basket explorer</h1>
        <p className="lede">
          The current live CPI basket weights by COICOP division, in per mille (parts per 1000) of
          total household expenditure. Weights are refreshed by ONS each January/February.
        </p>
      </section>

      <section className="chart-section">
        <Chart chart="basket" />
      </section>
      <p className="muted" style={{ marginTop: -14 }}>
        Click a segment to see that division on its own.
      </p>

      <section className="legend-table">
        <table>
          <thead>
            <tr>
              <th>Division</th>
              <th>COICOP</th>
              <th>Weight (‰)</th>
              <th>Series</th>
            </tr>
          </thead>
          <tbody>
            {weights.map((w) => (
              <tr key={w.coicop}>
                <td>
                  <span className="swatch" style={{ background: divisionColor(w.coicop, "dark") }} />
                  <Link href={`/division/${w.coicop}`}>{w.divisionName}</Link>
                </td>
                <td>{w.coicop}</td>
                <td>{w.weightPerMille.toFixed(1)}</td>
                <td>
                  <a href={w.sourceUrl}>{w.cdid}</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
