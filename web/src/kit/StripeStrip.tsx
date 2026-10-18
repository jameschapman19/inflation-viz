// GENERATED from packages/web-kit/src — edit there, then run: node scripts/sync-web-kit.mjs
/** One stripe per value, contiguous, coloured by `fill` (a CSS colour for a
 * value — typically `light-dark(...)`). Pure markup, so it renders on the
 * server; `StripeScrubber` adds interaction on top. Stripes from
 * `projectedFrom` on are drawn faded. */
export function StripeStrip({
  values,
  fill,
  projectedFrom = null,
  label,
}: {
  values: number[];
  fill: (value: number) => string;
  projectedFrom?: number | null;
  label: string;
}) {
  return (
    <svg className="stripe-svg" viewBox={`0 0 ${values.length} 1`} preserveAspectRatio="none" role="img" aria-label={label}>
      {values.map((value, i) => (
        <rect
          key={i}
          x={i}
          width={1.02}
          height={1}
          shapeRendering="crispEdges"
          style={{ fill: fill(value) }}
          opacity={projectedFrom !== null && i >= projectedFrom ? 0.55 : 1}
        />
      ))}
    </svg>
  );
}

/** Tick labels under a strip of monthly (or yearly) points: only entries whose
 * `label` is non-null are drawn, positioned by index. */
export function StripeTicks({ labels }: { labels: (string | null)[] }) {
  return (
    <div className="stripe-years" aria-hidden="true">
      {labels.map((label, i) =>
        label === null ? null : (
          <span key={i} style={{ left: `${((i + 0.5) / labels.length) * 100}%` }}>
            {label}
          </span>
        ),
      )}
    </div>
  );
}
