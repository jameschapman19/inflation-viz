import { ImageResponse } from "next/og";
import { OgCard } from "@/kit/og";
import { birthYears, lifetimeFor } from "@/lib/lifetime";
import { stripeColor } from "@/lib/stripeColor";

export const alt = "UK prices since your birth year";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return birthYears().map((year) => ({ year: String(year) }));
}

export default async function Image({ params }: { params: Promise<{ year: string }> }) {
  const life = lifetimeFor(Number((await params).year));
  return new ImageResponse(
    (
      <OgCard
        eyebrow={`Born in ${life.birthYear}`}
        hero={
          <>
            <span style={{ fontSize: 150, fontWeight: 700, lineHeight: 1 }}>{life.multiple.toFixed(2)}×</span>
            <span style={{ fontSize: 40, marginLeft: 28, color: "#c3c2b7" }}>UK prices since {life.baseLabel}</span>
          </>
        }
        subtitle={`£100 then costs £${Math.round(100 * life.multiple).toLocaleString("en-GB")} now`}
        footerLeft="One stripe per month · blue below the 2% target, red above"
        footerRight="Inflation Radar UK · ONS data"
      >
        {life.values.map((value, i) => (
          <div key={life.dates[i]} style={{ flex: 1, background: stripeColor(value).dark, opacity: i < life.rpiMonths ? 0.55 : 1 }} />
        ))}
      </OgCard>
    ),
    size,
  );
}
