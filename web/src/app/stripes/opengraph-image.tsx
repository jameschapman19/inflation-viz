import { ImageResponse } from "next/og";
import { OgCard } from "@/kit/og";
import { stripeColor } from "@/lib/stripeColor";
import { cpiStripes } from "@/lib/stripesData";

export const alt = "UK CPI inflation by month since 1989, coloured against the 2% target";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const { dates, values } = cpiStripes();
  return new ImageResponse(
    (
      <OgCard
        eyebrow="UK inflation, month by month"
        subtitle={`CPI 12-month rate against the 2% target · ${dates[0].slice(0, 4)}–${dates[dates.length - 1].slice(0, 4)}`}
        footerLeft="Blue: below target · Grey: at target · Red: above"
        footerRight="Inflation Radar UK · ONS data"
      >
        {values.map((value, i) => (
          <div key={dates[i]} style={{ flex: 1, background: stripeColor(value).dark }} />
        ))}
      </OgCard>
    ),
    size,
  );
}
