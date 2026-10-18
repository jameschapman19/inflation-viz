import { ImageResponse } from "next/og";
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
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#1a1a19", color: "#f0efec", padding: 56 }}>
        <div style={{ display: "flex", fontSize: 34, color: "#c3c2b7" }}>Born in {life.birthYear}</div>
        <div style={{ display: "flex", alignItems: "baseline", marginTop: 8 }}>
          <span style={{ fontSize: 150, fontWeight: 700, lineHeight: 1 }}>{life.multiple.toFixed(2)}×</span>
          <span style={{ fontSize: 40, marginLeft: 28, color: "#c3c2b7" }}>UK prices since {life.baseLabel}</span>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#c3c2b7", marginTop: 14 }}>
          £100 then costs £{(100 * life.multiple).toFixed(0)} now
        </div>
        <div style={{ display: "flex", flex: 1, marginTop: 30 }}>
          {life.values.map((value, i) => (
            <div key={life.dates[i]} style={{ flex: 1, background: stripeColor(value).dark }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#898781", marginTop: 18 }}>
          <span>One stripe per month · blue below the 2% target, red above</span>
          <span>Inflation Radar UK · ONS data</span>
        </div>
      </div>
    ),
    size,
  );
}
