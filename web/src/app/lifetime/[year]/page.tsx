import { notFound } from "next/navigation";
import { EmbedCode } from "@/kit/EmbedCode";
import { CellRibbon, RibbonLegend } from "@/kit/Ribbon";
import { StripeStrip, StripeTicks } from "@/kit/StripeStrip";
import { YearPicker } from "@/components/YearPicker";
import { formatMonth, formatPercent } from "@/lib/format";
import { birthYears, lifetimeFor } from "@/lib/lifetime";
import { leadingDivisions, ribbonLegend } from "@/lib/ribbon";
import { toKitCells, toKitLegend } from "@/lib/ribbonCells";
import { STRIPE_TARGET, stripeFill } from "@/lib/stripeColor";
import { yearTicks } from "@/lib/ticks";

export function generateStaticParams() {
  return birthYears().map((year) => ({ year: String(year) }));
}

function parseYear(raw: string): number | null {
  const year = Number(raw);
  return birthYears().includes(year) ? year : null;
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
  const years = birthYears();
  const cells = leadingDivisions(life.dates);
  const hasDivisions = cells.some((cell) => cell !== null);
  const share = Math.round((life.monthsAboveTarget / life.cpiMonths) * 100);
  const usesRpi = life.rpiMonths > 0;

  return (
    <>
      <section className="page-header">
        <h1>Inflation since you were born in {year}</h1>
        <p className="lede">
          £100 in {life.baseLabel} would cost <b>£{Math.round(100 * life.multiple).toLocaleString("en-GB")}</b> in {life.latestLabel}: UK prices
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
          <div className="stat-meta">Chained from ONS&apos;s published 12-month rates{usesRpi ? ", RPI before CPI began in 1989" : ""}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Worst month</div>
          <div className="stat-value-row">
            <span className="stat-value">{formatPercent(life.peak.rate)}</span>
          </div>
          <div className="stat-meta">{formatMonth(life.peak.ds, "long")}{life.peak.measure === "RPI" ? " (RPI)" : ""}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Above the {STRIPE_TARGET}% target</div>
          <div className="stat-value-row">
            <span className="stat-value">{share}%</span>
          </div>
          <div className="stat-meta">of the {life.cpiMonths} months since {usesRpi ? "CPI began in January 1989" : `January ${year}`}</div>
        </div>
      </div>

      <section className="chart-section stripes-figure">
        <StripeStrip values={life.values} fill={stripeFill} fadeBefore={life.rpiMonths} label={`UK 12-month inflation for every month since ${year}, coloured against the ${STRIPE_TARGET}% target`} />
        <StripeTicks labels={yearTicks(life.dates, life.dates.length > 240 ? 5 : life.dates.length > 96 ? 2 : 1)} />
        {usesRpi && (
          <p className="muted rpi-note">
            Faded stripes are RPI, used before CPI&apos;s series begins in 1989.
            {life.rpiPremium !== null && ` Since 1989 RPI has run ${life.rpiPremium.toFixed(1)} points above CPI on average, so the earlier years read a little hotter than CPI would.`}
          </p>
        )}
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
              At {a.age} ({a.year}): <b>{formatPercent(a.rate)}</b>{a.measure === "RPI" ? " RPI" : ""}
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
