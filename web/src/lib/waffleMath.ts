/** Splits `total` squares across shares by the largest-remainder method, so
 * the counts always sum to exactly `total`. */
export function squaresFor(shares: number[], total = 100): number[] {
  const sum = shares.reduce((a, b) => a + b, 0);
  const exact = shares.map((s) => (s / sum) * total);
  const counts = exact.map(Math.floor);
  const order = exact.map((value, i) => ({ i, remainder: value - counts[i] })).sort((a, b) => b.remainder - a.remainder);
  const leftover = total - counts.reduce((a, b) => a + b, 0);
  for (let k = 0; k < leftover; k++) counts[order[k].i]++;
  return counts;
}
