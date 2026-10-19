/**
 * The positions of the highest and lowest values in `values[from..to]`
 * (inclusive, offsets relative to `from`), for jump-to chips that name real
 * extremes of the data instead of hand-written episodes. The first of equal
 * values wins; `to` lets a caller leave out projected months.
 */
export function extremes(values: number[], from: number, to: number): { peak: number; low: number } {
  let peak = from;
  let low = from;
  for (let i = from; i <= to; i++) {
    if (values[i - from] > values[peak - from]) peak = i;
    if (values[i - from] < values[low - from]) low = i;
  }
  return { peak, low };
}
