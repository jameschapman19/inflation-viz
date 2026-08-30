import Link from "next/link";
import { divisionColor, subdivisionColor } from "@/lib/colors";
import {
  divisionsSorted,
  meta,
  registry,
  subdivisionsSorted,
  subdivisionWeightsSorted,
  weightsSorted,
} from "@/lib/data";

export const metadata = { title: "Methodology & sources — Inflation Radar (UK)" };

export default function MethodologyPage() {
  const divisions = divisionsSorted();
  const weights = weightsSorted();
  const subdivisions = subdivisionsSorted();
  const subdivisionWeights = subdivisionWeightsSorted();

  return (
    <>
      <section className="page-header">
        <h1>Methodology &amp; sources</h1>
        <p className="lede">
          Every series behind this site, in one table. Nothing here is hand-edited — it&apos;s
          generated straight from <code>sources.yaml</code>, the single registry every fetcher
          reads from.
        </p>
      </section>

      <section>
        <h2>Headline rates</h2>
        <div className="sources-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Series</th>
                <th>CDID</th>
                <th>Source</th>
                <th>License</th>
                <th>Cadence</th>
              </tr>
            </thead>
            <tbody>
              {registry.headline.map((s) => (
                <tr key={s.unique_id}>
                  <td>{s.name}</td>
                  <td>
                    <a href={s.source_url}>{s.cdid}</a>
                  </td>
                  <td>{s.source_name}</td>
                  <td>{s.license}</td>
                  <td>{s.cadence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>COICOP division contribution series</h2>
        <div className="sources-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Division</th>
                <th>CDID</th>
                <th>Source</th>
                <th>License</th>
                <th>Cadence</th>
              </tr>
            </thead>
            <tbody>
              {divisions.map((s) => (
                <tr key={s.unique_id}>
                  <td>
                    <span
                      className="swatch"
                      style={{ background: s.coicop ? divisionColor(s.coicop, "dark") : "#898781" }}
                    />
                    {s.coicop ? <Link href={`/division/${s.coicop}`}>{s.division_name}</Link> : s.division_name}
                  </td>
                  <td>
                    <a href={s.source_url}>{s.cdid}</a>
                  </td>
                  <td>{s.source_name}</td>
                  <td>{s.license}</td>
                  <td>{s.cadence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>COICOP division basket weights</h2>
        <div className="sources-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Division</th>
                <th>CDID</th>
                <th>Source</th>
                <th>License</th>
                <th>Cadence</th>
              </tr>
            </thead>
            <tbody>
              {weights.map((s) => (
                <tr key={s.unique_id}>
                  <td>
                    <span
                      className="swatch"
                      style={{ background: s.coicop ? divisionColor(s.coicop, "dark") : "#898781" }}
                    />
                    {s.coicop ? <Link href={`/division/${s.coicop}`}>{s.division_name}</Link> : s.division_name}
                  </td>
                  <td>
                    <a href={s.source_url}>{s.cdid}</a>
                  </td>
                  <td>{s.source_name}</td>
                  <td>{s.license}</td>
                  <td>{s.cadence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>COICOP sub-division rates &amp; weights</h2>
        <p className="lede">
          Below the division level, ONS only publishes each category&apos;s own 12-month rate and
          basket weight — not a contribution to headline CPI. Pilot scope: Transport&apos;s
          07.1/07.2/07.3 groups plus 07.2.2, nested one level further under 07.2.
        </p>
        <div className="sources-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Metric</th>
                <th>CDID</th>
                <th>Source</th>
                <th>License</th>
                <th>Cadence</th>
              </tr>
            </thead>
            <tbody>
              {[...subdivisions, ...subdivisionWeights]
                .sort((a, b) => (a.coicop ?? "").localeCompare(b.coicop ?? ""))
                .map((s) => (
                  <tr key={s.unique_id}>
                    <td>
                      <span
                        className="swatch"
                        style={{ background: s.coicop ? subdivisionColor(s.coicop, "dark") : "#898781" }}
                      />
                      {s.coicop ? <Link href={`/subdivision/${s.coicop}`}>{s.division_name}</Link> : s.division_name}{" "}
                      <span className="muted">({s.coicop})</span>
                    </td>
                    <td>{s.unique_id.startsWith("GB.SW") ? "Basket weight" : "12-month rate"}</td>
                    <td>
                      <a href={s.source_url}>{s.cdid}</a>
                    </td>
                    <td>{s.source_name}</td>
                    <td>{s.license}</td>
                    <td>{s.cadence}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Not yet ingested</h2>
        <p className="muted">Reserved in the source registry for Phase 2 forecasting exogenous regressors.</p>
        <div className="sources-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Table</th>
                <th>Source</th>
                <th>License</th>
                <th>Cadence</th>
              </tr>
            </thead>
            <tbody>
              {registry.external.map((t) => (
                <tr key={t.key}>
                  <td>
                    <a href={t.source_url}>{t.name}</a>
                  </td>
                  <td>{t.source_name}</td>
                  <td>{t.license}</td>
                  <td>{t.cadence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Data vintages</h2>
        <p>
          Every fetch writes an immutable, timestamped vintage snapshot rather than overwriting the
          last one — see <code>data/vintages/</code>. The site is always built from the newest
          vintage; older vintages are kept for future point-in-time backtesting (see the{" "}
          <code>inflation-forecast</code> repository).
        </p>
        <p className="muted">Latest vintage: {meta.latestVintage ?? "none — run the fetcher first"}</p>
      </section>
    </>
  );
}
