import { notFound } from "next/navigation";
import { EmbedCode } from "@/kit/EmbedCode";
import { CellRibbon, RibbonLegend } from "@/kit/Ribbon";
import { StripeStrip, StripeTicks } from "@/kit/StripeStrip";
import { YearPicker } from "@/components/YearPicker";
import { formatMonth, formatPercent } from "@/lib/format";
import { FIRST_BIRTH_YEAR, lastBirthYear, lifetimeFor } from "@/lib/lifetime";
import { leadingDivisions, ribbonLegend } from "@/lib/ribbon";
import { toKitCells, toKitLegend } from "@/lib/ribbonCells";
import { STRIPE_TARGET, stripeFill } from "@/lib/stripeColor";
import { yearTicks } from "@/lib/ticks";

export function generateStaticParams() {
  return Array.from({ length: lastBirthYear() - FIRST_BIRTH_YEAR + 1 }, (_, i) => ({ year: String(FIRST_BIRTH_YEAR + i) }));
}

function parseYear(raw: string): number | null {
  const year = Number(raw);
  return Number.isInteger(year) && year >= FIRST_BIRTH_YEAR && year <= lastBirthYear() ? year : null;
}

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }) {
  const { year: raw } = await params;
  const year = parseYear(raw);
  if (year === null) return {};
  const life = lifetimeFor(year);
  return {
    title: `Inflation since ${year} — Inflation Radar (UK)`,
    description: `UK prices are ${life.multiple.toFixed(2)}× what they were in ${life.baseLabel}.`,
  };
}

export default async function LifetimeYearPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: raw } = await params;
  const year = parseYear(raw);
  if (year === null) notFound();

  const life = lifetimeFor(year);
  const years = Array.from({ length: lastBirthYear() - FIRST_BIRTH_YEAR + 1 }, (_, i) => FIRST_BIRTH_YEAR + i);
  const cells = leadingDivisions(life.dates);
  const hasDivisions = cells.some((cell) => cell !== null);
  const share = Math.round((life.monthsAboveTarget / life.values.length) * 100);

  return (
    <>
      <section className="page-header">
        <h1>Inflation since you were born in {year}</h1>
        <p className="lede">
          £100 in {life.baseLabel} would cost <b>£{(100 * life.multiple).toFixed(0)}</b> in {life.latestLabel}: UK prices
          are {life.multiple.toFixed(2)}× what they were.
        </p>
      </section>

      <YearPicker years={years} current={year} />

      <div className="stat-row">
        <div className="stat-tile">
          <div className="stat-label">Prices since {life.baseLabel}</div>
          <div className="stat-value-row">
            <span className="stat-value">{life.multiple.toFixed(2)}×</span>
          </div>
          <div className="stat-meta">Chained from ONS&apos;s published 12-month rates</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Worst month</div>
          <div className="stat-value-row">
            <span className="stat-value">{formatPercent(life.peak.rate)}</span>
          </div>
          <div className="stat-meta">{formatMonth(life.peak.ds, "long")}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Above the {STRIPE_TARGET}% target</div>
          <div className="stat-value-row">
            <span className="stat-value">{share}%</span>
          </div>
          <div className="stat-meta">of the {life.values.length} months since January {year}</div>
        </div>
      </div>

      <section className="chart-section stripes-figure">
        <StripeStrip values={life.values} fill={stripeFill} label={`UK CPI 12-month rate for every month since ${year}, coloured against the ${STRIPE_TARGET}% target`} />
        <StripeTicks labels={yearTicks(life.dates, life.dates.length > 240 ? 5 : life.dates.length > 96 ? 2 : 1)} />
        {hasDivisions && (
          <>
            <h2 className="ribbon-title">What led it</h2>
            <CellRibbon cells={toKitCells(cells, life.dates)} label="The division contributing most to inflation each month" />
            <RibbonLegend entries={toKitLegend(ribbonLegend(cells))} />
            <p className="muted">The division contributing most to inflation each month; ONS publishes divisions from November 2003.</p>
          </>
        )}
      </section>

      {life.ages.length > 0 && (
        <p className="age-rates">
          {life.ages.map((a) => (
            <span key={a.age}>
              At {a.age} ({a.year}): <b>{formatPercent(a.rate)}</b>
            </span>
          ))}
        </p>
      )}

      <p className="muted">
        Prices are compared from the same month each year, chained from the published CPI 12-month rate (one decimal place), so
        the multiple is approximate to within about 1%. Blue stripes are below the Bank of England&apos;s {STRIPE_TARGET}% target, red above.
      </p>
      <EmbedCode path={`/lifetime/${year}`} height={900} title={`Inflation since ${year}`} />
    </>
  );
}
