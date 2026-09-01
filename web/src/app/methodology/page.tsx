import type { ReactNode } from "react";
import Link from "next/link";
import { divisionColor, subdivisionColor } from "@/lib/colors";
import {
  divisionsSorted,
  forecast,
  hasForecast,
  meta,
  registry,
  subdivisionsSorted,
  subdivisionWeightsSorted,
  weightsSorted,
} from "@/lib/data";
import type { ReferenceTableSource, SeriesSource } from "@/lib/types";

export const metadata = { title: "Methodology & sources — Inflation Radar (UK)" };

function SourceTable<T extends { unique_id?: string; key?: string }>({
  rows,
  columns,
}: {
  rows: T[];
  columns: { header: string; render: (row: T) => ReactNode }[];
}) {
  return (
    <div className="sources-table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.header}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.unique_id ?? row.key ?? i}>
              {columns.map((c) => (
                <td key={c.header}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CDID_COLUMN = {
  header: "CDID",
  render: (s: SeriesSource) => (
    <a href={s.source_url}>{s.cdid}</a>
  ),
};
const SOURCE_COLUMNS = [
  { header: "Source", render: (s: SeriesSource) => s.source_name },
  { header: "License", render: (s: SeriesSource) => s.license },
  { header: "Cadence", render: (s: SeriesSource) => s.cadence },
];

function divisionName(s: SeriesSource, color: (coicop: string) => string, href: (coicop: string) => string) {
  if (!s.coicop) return s.division_name ?? s.name;
  return (
    <>
      <span className="swatch" style={{ background: color(s.coicop) }} />
      <Link href={href(s.coicop)}>{s.division_name}</Link>
    </>
  );
}

export default function MethodologyPage() {
  const divisions = divisionsSorted();
  const weights = weightsSorted();
  const subdivisionRows = [...subdivisionsSorted(), ...subdivisionWeightsSorted()].sort((a, b) =>
    (a.coicop ?? "").localeCompare(b.coicop ?? ""),
  );
  const missingNames = hasForecast()
    ? divisions
        .filter((d) => d.coicop && forecast.coverage.missing.includes(d.unique_id))
        .map((d) => d.division_name)
    : [];

  return (
    <>
      <section className="page-header">
        <h1>Methodology &amp; sources</h1>
        <p className="lede">
          Every ONS series behind this site — headline, all 12 divisions, and their full
          sub-category tree — is discovered live from ONS&apos;s own bulk dataset at refresh time,
          not hand-typed; nothing here is stale by construction. <code>sources.yaml</code> lists
          this pipeline&apos;s deliberate exceptions to that: a small number of additional,
          individually hand-typed ONS series, Bank of England data (a different provider
          entirely), and non-ONS reference sources — see below.
        </p>
      </section>

      <section>
        <h2>Headline rates</h2>
        <SourceTable
          rows={registry.headline}
          columns={[{ header: "Series", render: (s) => s.name }, CDID_COLUMN, ...SOURCE_COLUMNS]}
        />
      </section>

      {registry.context.length > 0 && (
        <section>
          <h2>Context indicators</h2>
          <p className="lede">
            Additional ONS series added for context — some alternative inflation measures (RPI,
            still used for rail fares, some student loans, and index-linked gilts), some outside
            CPI entirely (real, CPI-deflated regular pay growth, so you can see whether pay is
            keeping pace with prices without leaving the site). Fetched the same way as every CPI
            series above, just from a different ONS dataset.
          </p>
          <SourceTable
            rows={registry.context}
            columns={[{ header: "Series", render: (s) => s.name }, CDID_COLUMN, ...SOURCE_COLUMNS]}
          />
        </section>
      )}

      {registry.boe.length > 0 && (
        <section>
          <h2>Bank of England</h2>
          <p className="lede">
            A different provider entirely — the Bank&apos;s Interactive Database (IADB) rather
            than ONS&apos;s timeseries API, so it&apos;s fetched by its own small pipeline module
            (<code>boe.py</code>). Bank Rate is the Bank&apos;s own lever for bringing inflation
            back to target; 10-year breakeven inflation is the Bank&apos;s own zero-coupon
            inflation curve — the gap between conventional and index-linked gilt yields, i.e. what
            the bond market itself expects inflation to average over the next decade, not
            something derived here.
          </p>
          <SourceTable
            rows={registry.boe}
            columns={[
              { header: "Series", render: (s) => s.name },
              { header: "Series code", render: (s) => <a href={s.source_url}>{s.cdid}</a> },
              ...SOURCE_COLUMNS,
            ]}
          />
        </section>
      )}

      <section>
        <h2>COICOP division contribution series</h2>
        <SourceTable
          rows={divisions}
          columns={[
            { header: "Division", render: (s) => divisionName(s, (c) => divisionColor(c, "dark"), (c) => `/division/${c}`) },
            CDID_COLUMN,
            ...SOURCE_COLUMNS,
          ]}
        />
      </section>

      <section>
        <h2>COICOP division basket weights</h2>
        <SourceTable
          rows={weights}
          columns={[
            { header: "Division", render: (s) => divisionName(s, (c) => divisionColor(c, "dark"), (c) => `/division/${c}`) },
            CDID_COLUMN,
            ...SOURCE_COLUMNS,
          ]}
        />
      </section>

      <section>
        <h2>COICOP sub-division rates &amp; weights</h2>
        <p className="lede">
          Below the division level, ONS only publishes each category&apos;s own 12-month rate and
          basket weight — not a contribution to headline CPI — to whatever depth it itself breaks
          a division down into (a group, a class, sometimes a further subclass).
        </p>
        <SourceTable
          rows={subdivisionRows}
          columns={[
            {
              header: "Category",
              render: (s) => (
                <>
                  {divisionName(s, (c) => subdivisionColor(c, "dark"), (c) => `/subdivision/${c}`)}{" "}
                  <span className="muted">({s.coicop})</span>
                </>
              ),
            },
            { header: "Metric", render: (s) => (s.unique_id.startsWith("GB.SW") ? "Basket weight" : "12-month rate") },
            CDID_COLUMN,
            ...SOURCE_COLUMNS,
          ]}
        />
      </section>

      <section>
        <h2>Not yet ingested</h2>
        <p className="muted">Reserved in the source registry for Phase 2 forecasting exogenous regressors.</p>
        <SourceTable<ReferenceTableSource>
          rows={registry.external}
          columns={[
            { header: "Table", render: (t) => <a href={t.source_url}>{t.name}</a> },
            { header: "Source", render: (t) => t.source_name },
            { header: "License", render: (t) => t.license },
            { header: "Cadence", render: (t) => t.cadence },
          ]}
        />
      </section>

      {hasForecast() && (
        <section>
          <h2>Short-term projection</h2>
          <p>
            The dashed continuation on the headline and contributors charts is this project&apos;s
            own short-term projection, not an ONS figure.
          </p>
          <p className="muted">
            Currently projects {forecast.coverage.included.length} of 12 divisions.
            {missingNames.length > 0 && <> Not yet covered: {missingNames.join(", ")}.</>}
          </p>
        </section>
      )}

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
