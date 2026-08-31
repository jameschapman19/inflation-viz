import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChartSection, StatTile, SubcategoryTable } from "@/components/DetailSections";
import { divisionColor } from "@/lib/colors";
import {
  childRateSeriesOf,
  childWeightSeriesOf,
  divisionByCoicop,
  divisionsSorted,
  latestPointFor,
  subdivisionsUnder,
  weightByCoicop,
} from "@/lib/data";
import { formatPpt, formatWeight } from "@/lib/format";

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

  const color = divisionColor(coicop);
  const subdivisions = subdivisionsUnder(coicop);
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
        <StatTile
          label="Contribution to headline CPI"
          point={latestPointFor(division.unique_id)}
          format={formatPpt}
          source={division}
        />
        {weight && (
          <StatTile
            label="Basket weight"
            point={latestPointFor(weight.unique_id)}
            format={formatWeight}
            source={weight}
          />
        )}
      </div>

      <ChartSection heading="Contribution to headline CPI" chart="division-contribution" coicop={coicop} height="360px" />

      {weight && (
        <ChartSection heading="Basket weight over time" chart="division-weight" coicop={coicop} height="320px" />
      )}

      {childWeights.length > 0 && (
        <ChartSection
          heading="Basket weight by sub-category"
          lede={
            <>
              {division.division_name}&apos;s basket weight, broken down into its own sub-categories
              over time — additive, so this stacks validly (unlike rates, below).
            </>
          }
          chart="stacked-weight"
          entries={childWeights}
          drillBasePath="/subdivision"
          height="360px"
        />
      )}

      {childRates.length > 0 && (
        <ChartSection
          heading="Sub-category 12-month rates"
          lede="Each sub-category's own rate of change, compared side by side — these are independent
            rates rather than pre-weighted contributions, so they're shown as separate lines rather
            than stacked (stacking rates would produce a number that doesn't mean anything)."
          chart="multiline-rate"
          entries={childRates}
          drillBasePath="/subdivision"
          height="360px"
        />
      )}

      {subdivisions.length > 0 && <SubcategoryTable rows={subdivisions} showCoicopColumn />}

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
