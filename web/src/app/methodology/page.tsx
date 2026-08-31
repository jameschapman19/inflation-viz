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
          not hand-typed; nothing here is stale by construction. <code>sources.yaml</code> now only
          lists the handful of non-ONS reference sources below.
        </p>
      </section>

      <section>
        <h2>Headline rates</h2>
        <SourceTable
          rows={registry.headline}
          columns={[{ header: "Series", render: (s) => s.name }, CDID_COLUMN, ...SOURCE_COLUMNS]}
        />
      </section>

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
            own estimate, not an ONS figure — an {forecast.model} model fit independently to each
            division&apos;s own contribution history, then reconciled bottom-up so the projected
            divisions always sum to the projected headline total. It carries an {forecast.level}%
            prediction interval per division; the reconciled total has no interval of its own,
            since summing per-division intervals isn&apos;t a statistically valid interval for
            their sum.
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
