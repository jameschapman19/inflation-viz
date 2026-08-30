import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChartSection, StatTile, SubcategoryTable } from "@/components/DetailSections";
import { subdivisionColor } from "@/lib/colors";
import {
  childRateSeriesOf,
  childWeightSeriesOf,
  latestPointFor,
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

  const color = subdivisionColor(coicop);
  const children = subdivisionsUnder(coicop);
  const childRates = childRateSeriesOf(coicop);
  const childWeights = childWeightSeriesOf(coicop);

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
        <StatTile
          label="12-month rate"
          point={latestPointFor(subdivision.unique_id)}
          format={(y) => `${y.toFixed(1)}%`}
          source={subdivision}
        />
        {weight && (
          <StatTile
            label="Basket weight"
            point={latestPointFor(weight.unique_id)}
            format={(y) => `${y.toFixed(1)}‰`}
            source={weight}
          />
        )}
      </div>

      <ChartSection heading="12-month rate" chart="subdivision-rate" coicop={coicop} height="360px" />

      {weight && (
        <ChartSection heading="Basket weight over time" chart="subdivision-weight" coicop={coicop} height="320px" />
      )}

      {childWeights.length > 0 && (
        <ChartSection
          heading="Basket weight by sub-category"
          lede={
            <>
              {subdivision.division_name}&apos;s basket weight, broken down further — additive, so
              this stacks validly (unlike rates, below).
            </>
          }
          chart="stacked-weight"
          entries={childWeights}
          drillBasePath="/subdivision"
          height="320px"
        />
      )}

      {childRates.length > 0 && (
        <ChartSection
          heading="Sub-category 12-month rates"
          lede="Each sub-category's own rate of change, compared side by side rather than stacked —
            see the division page for why."
          chart="multiline-rate"
          entries={childRates}
          drillBasePath="/subdivision"
          height="320px"
        />
      )}

      {children.length > 0 && <SubcategoryTable rows={children} showCoicopColumn={false} />}

      <nav className="division-pager">
        <Link href={parentHref}>&larr; Back to {parentCoicop}</Link>
        <Link href="/contributors">All divisions</Link>
      </nav>
    </>
  );
}
