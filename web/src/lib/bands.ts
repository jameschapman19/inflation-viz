/**
 * Bands a 12-month rate against the Bank of England's 2% CPI inflation
 * target, on the same blue / neutral / red scale as the stripes. Applied to
 * CPIH and RPI too, since they move on the same scale, even though the formal
 * remit target is CPI specifically.
 */
export type InflationBand = "below-target" | "near-target" | "elevated" | "high";

export function bandForRate(value: number): InflationBand {
  if (value < 1.5) return "below-target";
  if (value <= 2.5) return "near-target";
  if (value <= 5) return "elevated";
  return "high";
}
