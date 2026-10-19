/**
 * Diverging colour for a harvest against its ten-year trend: orange below
 * it, teal above it, grey on it. The poles are the map "change" layer's own
 * end colours, so the two read as a pair. Saturates at ±20% with a square-root
 * ramp, so the ordinary swings of a few percent stay visible.
 */
export const HARVEST_LIMIT = 20;
const MID = [0x5a, 0x67, 0x70];
const FALL = [0xd7, 0x92, 0x56];
const RISE = [0x79, 0xcc, 0xd0];

export function harvestColor(change: number): string {
  const pole = change < 0 ? FALL : RISE;
  const t = Math.sqrt(Math.min(Math.abs(change), HARVEST_LIMIT) / HARVEST_LIMIT);
  const channel = (i: number) => Math.round(MID[i] + (pole[i] - MID[i]) * t).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}
