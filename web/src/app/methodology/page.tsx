import { divisionColor } from "@/lib/colors";
import { divisionsSorted, meta, registry, weightsSorted } from "@/lib/data";

export const metadata = { title: "Methodology & sources — Inflation Radar (UK)" };

export default function MethodologyPage() {
  const divisions = divisionsSorted();
  const weights = weightsSorted();

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
                    {s.division_name}
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
                    {s.division_name}
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
