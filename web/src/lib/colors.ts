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
