/** A line with a soft fill for share cards. Satori needs explicit pixel sizes, so this takes them. */
export function Sparkline({ points, width, height, color, fill }: { points: { t: number; v: number }[]; width: number; height: number; color: string; fill: string }) {
  const [t0, t1] = [points[0].t, points[points.length - 1].t];
  const values = points.map(p => p.v);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * width;
  const y = (v: number) => height - 6 - ((v - lo) / (hi - lo || 1)) * (height - 12);
  const line = points.map(p => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polygon points={`0,${height} ${line} ${width},${height}`} fill={fill} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}
