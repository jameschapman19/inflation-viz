/**
 * Single shared division color mapping, reused by every chart on the site.
 *
 * Ported from `src/inflation_viz/colors.py` — that's the canonical source
 * (validated with the data-viz skill's `validate_palette.js`: all 12 hues
 * clear the adjacent-pair CVD (deltaE >= 8) and normal-vision (deltaE >= 15)
 * floors in both light and dark mode). Keep the two in sync by hand; this
 * mirrors how inflation-forecast deliberately duplicates rather than
 * imports across the Python/TS boundary.
 *
 * Do not add a per-chart color scale anywhere else in the codebase — import
 * DIVISION_COLORS (or the CSS custom properties in globals.css, generated
 * from the same table) instead.
 */

export interface DivisionColor {
  light: string;
  dark: string;
}

// Keyed by unique_id (GB.CP01..GB.CP12), in fixed COICOP order. This order
// is the palette's validated adjacency order for a 12-series stacked area
// chart — do not re-sort it per chart.
export const DIVISION_COLORS: Record<string, DivisionColor> = {
  "GB.CP01": { light: "#2a78d6", dark: "#3987e5" }, // blue
  "GB.CP02": { light: "#eb6834", dark: "#d95926" }, // orange
  "GB.CP03": { light: "#1baf7a", dark: "#199e70" }, // aqua
  "GB.CP04": { light: "#eda100", dark: "#c98500" }, // yellow
  "GB.CP05": { light: "#e87ba4", dark: "#d55181" }, // magenta
  "GB.CP06": { light: "#008300", dark: "#008300" }, // green
  "GB.CP07": { light: "#4a3aa7", dark: "#9085e9" }, // violet
  "GB.CP08": { light: "#e34948", dark: "#e66767" }, // red
  "GB.CP09": { light: "#009999", dark: "#12a3a3" }, // teal
  "GB.CP10": { light: "#b3691e", dark: "#b56a1f" }, // amber
  "GB.CP11": { light: "#c2185b", dark: "#e0508a" }, // rose
  "GB.CP12": { light: "#3f51b5", dark: "#6f7fd4" }, // indigo
};

export const HEADLINE_COLOR: DivisionColor = { light: "#0b0b0b", dark: "#ffffff" };

// Chart chrome, from the data-viz skill's reference palette.
export const CHART_SURFACE: DivisionColor = { light: "#fcfcfb", dark: "#1a1a19" };
export const GRIDLINE: DivisionColor = { light: "#e1e0d9", dark: "#2c2c2a" };
export const MUTED_TEXT: DivisionColor = { light: "#898781", dark: "#898781" };

export function divisionColor(coicop: string, mode: "light" | "dark" = "light"): string {
  const key = `GB.CP${coicop}`;
  const c = DIVISION_COLORS[key];
  if (!c) throw new Error(`No color for COICOP division ${coicop}`);
  return mode === "dark" ? c.dark : c.light;
}

/**
 * A sub-division (e.g. "07.2.2") isn't in the validated 12-hue palette —
 * it inherits its top-level division's color instead, so Transport's
 * sub-categories read visually as Transport rather than needing their own
 * adjacency-checked hues.
 */
export function subdivisionColor(coicop: string, mode: "light" | "dark" = "light"): string {
  const topLevel = coicop.split(".")[0];
  return divisionColor(topLevel, mode);
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const hPrime = h / 60;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));
  const m = lNorm - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (hPrime >= 0 && hPrime < 1) [r, g, b] = [c, x, 0];
  else if (hPrime < 2) [r, g, b] = [x, c, 0];
  else if (hPrime < 3) [r, g, b] = [0, c, x];
  else if (hPrime < 4) [r, g, b] = [0, x, c];
  else if (hPrime < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * A color for one sibling among a set of `total` sub-categories that all
 * share the same parent (and so all resolve to the same base hue via
 * `subdivisionColor`) — a plain family of same-hue lines/bands is
 * indistinguishable from each other, so this spreads them across a
 * lightness ramp (same hue and saturation as the parent, sequential
 * light->dark by position) instead. Pass `index`/`total` as the sibling's
 * position within its own siblings list, not any global index.
 */
export function childColor(
  coicop: string,
  index: number,
  total: number,
  mode: "light" | "dark" = "light",
): string {
  const base = subdivisionColor(coicop, mode);
  if (total <= 1) return base;

  const { h, s } = hexToHsl(base);
  const [minL, maxL] = mode === "dark" ? [40, 82] : [20, 58];
  const t = index / (total - 1);
  const targetL = minL + t * (maxL - minL);
  return hslToHex(h, Math.max(s, 45), targetL);
}
