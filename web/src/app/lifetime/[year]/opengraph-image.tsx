import { ImageResponse } from "next/og";
import { OgCard } from "@/kit/og";
import { FIRST_BIRTH_YEAR, lastBirthYear, lifetimeFor } from "@/lib/lifetime";
import { stripeColor } from "@/lib/stripeColor";

export const alt = "UK prices since your birth year";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return Array.from({ length: lastBirthYear() - FIRST_BIRTH_YEAR + 1 }, (_, i) => ({ year: String(FIRST_BIRTH_YEAR + i) }));
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
        subtitle={`£100 then costs £${(100 * life.multiple).toFixed(0)} now`}
        footerLeft="One stripe per month · blue below the 2% target, red above"
        footerRight="Inflation Radar UK · ONS data"
      >
        {life.values.map((value, i) => (
          <div key={life.dates[i]} style={{ flex: 1, background: stripeColor(value).dark }} />
        ))}
      </OgCard>
    ),
    size,
  );
}
