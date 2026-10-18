import Link from "next/link";
import { EmbedCode } from "@/components/EmbedCode";
import { StripeStrip } from "@/components/StripeStrip";
import { registry } from "@/lib/data";
import { STRIPE_HIGH, STRIPE_LOW, STRIPE_TARGET, stripeFill } from "@/lib/stripeColor";
import { cpiStripes } from "@/lib/stripesData";
import { formatPercent } from "@/lib/format";

export const metadata = {
  title: "Inflation stripes — Inflation Radar (UK)",
  description: "Every month of UK CPI inflation since 1989, coloured against the 2% target.",
};

const KEY_STEPS = 18;

export default function StripesPage() {
  const { dates, values } = cpiStripes();
  const first = dates[0];
  const last = dates[dates.length - 1];
  const peak = values.indexOf(Math.max(...values));
  const years = dates
    .map((ds, i) => ({ ds, i }))
    .filter(({ ds }) => ds.slice(5, 7) === "01" && Number(ds.slice(0, 4)) % 5 === 0);

  const gradient = Array.from({ length: KEY_STEPS + 1 }, (_, i) => {
    const rate = STRIPE_LOW + ((STRIPE_HIGH - STRIPE_LOW) * i) / KEY_STEPS;
    return `${stripeFill(rate)} ${(i / KEY_STEPS) * 100}%`;
  }).join(", ");
  const targetPosition = ((STRIPE_TARGET - STRIPE_LOW) / (STRIPE_HIGH - STRIPE_LOW)) * 100;

  return (
    <>
      <section className="page-header">
        <h1>UK inflation stripes</h1>
        <p className="lede">
          One stripe per month, {first.slice(0, 4)} to {last.slice(0, 4)}: the CPI 12-month rate against the Bank of
          England&apos;s {STRIPE_TARGET}% target — blue below it, grey at it, red above. The peak is{" "}
          {formatPercent(values[peak])} in {new Date(`${dates[peak]}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}.
        </p>
      </section>

      <section className="chart-section stripes-figure">
        <StripeStrip values={values} label={`UK CPI 12-month rate by month from ${first.slice(0, 4)}, coloured against the ${STRIPE_TARGET}% target`} />
        <div className="stripe-years" aria-hidden="true">
          {years.map(({ ds, i }) => (
            <span key={ds} style={{ left: `${((i + 0.5) / dates.length) * 100}%` }}>
              {ds.slice(0, 4)}
            </span>
          ))}
        </div>
        <div className="stripe-key" aria-hidden="true">
          <div className="stripe-key-bar" style={{ background: `linear-gradient(to right, ${gradient})` }} />
          <span style={{ left: 0 }}>{STRIPE_LOW}% or less</span>
          <span style={{ left: `${targetPosition}%` }}>{STRIPE_TARGET}% target</span>
          <span style={{ right: 0 }}>{STRIPE_HIGH}% or more</span>
        </div>
      </section>

      <p className="muted">
        Data: ONS CPI 12-month rate (<a href={registry.headline[0].source_url}>{registry.headline[0].cdid}</a>), monthly. See the{" "}
        <Link href="/replay">replay</Link> to watch what drove each month.
      </p>
      <EmbedCode path="/stripes" height={340} title="UK inflation stripes" />
    </>
  );
}
