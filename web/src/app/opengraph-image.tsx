import { ImageResponse } from "next/og";
import { formatDelta, headlineStats, seriesFor } from "@/lib/data";
import { formatMonth } from "@/lib/format";
import { stripeColor } from "@/lib/stripeColor";

export const alt = "UK CPI inflation: the latest rate and the last three years, month by month";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const STRIPE_MONTHS = 36;

// Prerendered at build, and the site rebuilds whenever the data refresh
// commits new numbers, so this card always shows the latest rate. It is also
// the fallback preview for every page without its own image.
export default function Image() {
  const cpi = headlineStats()[0];
  const recent = seriesFor("GB.CPI").slice(-STRIPE_MONTHS);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#1a1a19", color: "#f0efec", padding: 56 }}>
        <div style={{ display: "flex", fontSize: 34, color: "#c3c2b7" }}>UK inflation · {formatMonth(cpi.period)}</div>
        <div style={{ display: "flex", alignItems: "baseline", marginTop: 6 }}>
          <span style={{ fontSize: 190, fontWeight: 700, lineHeight: 1 }}>{cpi.value.toFixed(1)}%</span>
          {cpi.deltaFromPreviousMonth !== null && (
            <span style={{ fontSize: 38, marginLeft: 28, color: "#c3c2b7" }}>{formatDelta(cpi.deltaFromPreviousMonth)} on last month</span>
          )}
        </div>
        <div style={{ display: "flex", flex: 1, marginTop: 30 }}>
          {recent.map((p) => (
            <div key={p.ds} style={{ flex: 1, background: stripeColor(p.y).dark }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#898781", marginTop: 18 }}>
          <span>Last 3 years, one stripe per month · blue below the 2% target, red above</span>
          <span>Inflation Radar UK</span>
        </div>
      </div>
    ),
    size,
  );
}
