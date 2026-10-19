import { stripeFill } from "@/lib/stripeColor";

/** One stripe per value, contiguous, coloured by `stripeFill`. Pure markup so
 * it renders on the server; `Stripes` adds interaction on top. Stripes from
 * `projectedFrom` on are drawn faded. */
export function StripeStrip({
  values,
  projectedFrom = null,
  label,
}: {
  values: number[];
  projectedFrom?: number | null;
  label: string;
}) {
  return (
    <svg
      className="stripe-svg"
      viewBox={`0 0 ${values.length} 1`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      {values.map((value, i) => (
        <rect
          key={i}
          x={i}
          width={1.02}
          height={1}
          shapeRendering="crispEdges"
          style={{ fill: stripeFill(value) }}
          opacity={projectedFrom !== null && i >= projectedFrom ? 0.55 : 1}
        />
      ))}
    </svg>
  );
}
