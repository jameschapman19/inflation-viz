import { ImageResponse } from "next/og";
import { stripeColor } from "@/lib/stripeColor";
import { cpiStripes } from "@/lib/stripesData";

export const alt = "UK CPI inflation by month since 1989, coloured against the 2% target";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const { dates, values } = cpiStripes();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#1a1a19", color: "#f0efec", padding: 56 }}>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700 }}>UK inflation, month by month</div>
        <div style={{ display: "flex", fontSize: 28, color: "#c3c2b7", marginTop: 8 }}>
          CPI 12-month rate against the 2% target · {dates[0].slice(0, 4)}–{dates[dates.length - 1].slice(0, 4)}
        </div>
        <div style={{ display: "flex", flex: 1, marginTop: 36 }}>
          {values.map((value, i) => (
            <div key={dates[i]} style={{ flex: 1, background: stripeColor(value).dark }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#898781", marginTop: 20 }}>
          <span>Blue: below target · Grey: at target · Red: above</span>
          <span>Inflation Radar UK · ONS data</span>
        </div>
      </div>
    ),
    size,
  );
}
