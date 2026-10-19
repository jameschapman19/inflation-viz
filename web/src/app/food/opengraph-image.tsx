import { ImageResponse } from "next/og";
import { OgCard } from "@/kit/og";
import { buildFoodData } from "@/lib/food";

export const alt = "UK bread inflation against the world wheat price, and how the lag between them moves";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const W = 1088;
const H = 190;

function line(values: (number | null)[], lo: number, hi: number): string {
  const points: string[] = [];
  values.forEach((v, i) => {
    if (v !== null) points.push(`${((i / (values.length - 1)) * W).toFixed(1)},${(H - 8 - ((v - lo) / (hi - lo)) * (H - 16)).toFixed(1)}`);
  });
  return points.join(" ");
}

export default function Image() {
  const bread = buildFoodData().pairs[0];
  const [all, early, late] = bread.windows;
  const lag = all.best?.lag ?? 0;
  const last = bread.dates.indexOf(bread.lastCpi);
  const cpi = bread.cpi.slice(0, last + 1);
  const wheat = bread.dates.slice(0, last + 1).map((_, i) => (i - lag >= 0 ? bread.commodity[i - lag] : null));
  const all2 = [...cpi, ...wheat].filter((v): v is number => v !== null);
  const [lo, hi] = [Math.min(...all2), Math.max(...all2)];
  return new ImageResponse(
    (
      <OgCard
        eyebrow="Wheat → UK bread"
        hero={<span style={{ fontSize: 62, fontWeight: 700, lineHeight: 1.05 }}>How far ahead does wheat lead?</span>}
        subtitle={`${all.best ? `${all.best.lag} months over ${all.label}` : "No clear lead"} — but ${early.best?.lag ?? "?"} in ${early.label}, ${late.best?.lag ?? "?"} in ${late.label}`}
        footerLeft="White: UK bread inflation · Amber: wheat price change, shifted"
        footerRight="Inflation Radar UK"
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <polyline points={line(wheat, lo, hi)} fill="none" stroke="#e7b45e" strokeWidth="4" strokeLinejoin="round" />
          <polyline points={line(cpi, lo, hi)} fill="none" stroke="#f0efec" strokeWidth="5" strokeLinejoin="round" />
        </svg>
      </OgCard>
    ),
    size,
  );
}
