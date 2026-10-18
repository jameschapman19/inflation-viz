/**
 * Diverging colour for a CPI 12-month rate, centred on the Bank of England's
 * 2% target: blue below, neutral grey at target, red above. Equal-hue poles
 * and a neutral midpoint are the diverging-scale rules from the data-viz
 * skill's palette; the poles reuse this site's validated blue (GB.CP01) and
 * red (GB.CP08) so the stripes read as part of the same system.
 *
 * The scale saturates at 0% and 9%. The upper arm covers far more range than
 * the lower (inflation is rarely far below target), and a square-root ramp
 * keeps moderate overshoots visibly red instead of near-grey.
 */
export const STRIPE_TARGET = 2;
export const STRIPE_LOW = 0;
export const STRIPE_HIGH = 9;

export interface StripeColor {
  light: string;
  dark: string;
}

const MID: StripeColor = { light: "#f0efec", dark: "#383835" };
const BLUE: StripeColor = { light: "#2a78d6", dark: "#3987e5" };
const RED: StripeColor = { light: "#e34948", dark: "#e66767" };

function mix(from: string, to: string, t: number): string {
  const channel = (hex: string, offset: number) => parseInt(hex.slice(offset, offset + 2), 16);
  const hex = (offset: number) =>
    Math.round(channel(from, offset) + (channel(to, offset) - channel(from, offset)) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(1)}${hex(3)}${hex(5)}`;
}

export function stripeColor(rate: number): StripeColor {
  const [pole, t] =
    rate >= STRIPE_TARGET
      ? ([RED, (Math.min(rate, STRIPE_HIGH) - STRIPE_TARGET) / (STRIPE_HIGH - STRIPE_TARGET)] as const)
      : ([BLUE, (STRIPE_TARGET - Math.max(rate, STRIPE_LOW)) / (STRIPE_TARGET - STRIPE_LOW)] as const);
  const eased = Math.sqrt(t);
  return { light: mix(MID.light, pole.light, eased), dark: mix(MID.dark, pole.dark, eased) };
}

/** A CSS colour that follows the page's colour scheme, for SVG/HTML fills. */
export function stripeFill(rate: number): string {
  const { light, dark } = stripeColor(rate);
  return `light-dark(${light}, ${dark})`;
}
