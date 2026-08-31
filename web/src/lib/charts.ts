import type { EChartsOption, SeriesOption } from "echarts";
import { CHART_SURFACE, GRIDLINE, HEADLINE_COLOR, MUTED_TEXT, childColor, divisionColor, subdivisionColor } from "./colors";
import type { ChildSeries } from "./data";
import type { ForecastBand, ForecastPoint, SeriesPoint, SeriesSource } from "./types";
import {
  childWeightSeriesOf,
  divisionByCoicop,
  forecast,
  forecastFor,
  hasForecast,
  registry,
  seriesFor,
  subdivisionByCoicop,
  subdivisionWeightByCoicop,
  topLevelContributionChildren,
  weightByCoicop,
  weightsSorted,
} from "./data";
import { formatPercent, formatWeight } from "./format";

export type ChartMode = "light" | "dark";

const FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', sans-serif";

// A forecast series is drawn at reduced opacity in addition to being
// dashed — distinguishing "actual" from "projected" by dash pattern
// alone is easy to miss at a glance; muting the color too is the
// standard way to read uncertain/projected data as visually secondary.
const FORECAST_OPACITY = 0.55;

// Series ids ending in this suffix are marked as forecast points in the
// tooltip formatter below — needed specifically for stackedChildrenChart,
// whose forecast series intentionally *share* their real counterpart's
// name (to avoid doubling the legend), so the name alone can't tell them
// apart in a tooltip. headlineChart/singleSeriesChart give their forecast
// series distinctly-worded names instead and don't need this.
const FORECAST_ID_SUFFIX = "-forecast";

interface TooltipParam {
  axisValueLabel?: string;
  seriesName?: string;
  seriesId?: string;
  marker?: string;
  value?: [string, number];
}

/** A `tooltip.formatter` for axis-trigger tooltips that renders every
 * series' value through `formatValue` instead of ECharts' default (which
 * prints the raw, unrounded number) — the one tooltip formatter every
 * chart in this file uses, parameterized by unit (percent vs. per-mille)
 * and decimal precision per chart. Series hidden from the legend by name
 * (the confidence-band helper series) are also hidden here.
 */
function axisTooltipFormatter(formatValue: (value: number) => string) {
  return (raw: unknown): string => {
    const params = (Array.isArray(raw) ? raw : [raw]) as TooltipParam[];
    const visible = params.filter(
      (p) => Array.isArray(p.value) && typeof p.value[1] === "number" && !Number.isNaN(p.value[1]) && !p.seriesName?.startsWith("__"),
    );
    if (visible.length === 0) return "";
    const header = visible[0]?.axisValueLabel ?? "";
    const rows = visible
      .map((p) => {
        const value = (p.value as [string, number])[1];
        const isForecast = typeof p.seriesId === "string" && p.seriesId.endsWith(FORECAST_ID_SUFFIX);
        const label = isForecast ? `${p.seriesName} (projected)` : p.seriesName;
        return `<div>${p.marker ?? ""}${label}: <b>${formatValue(value)}</b></div>`;
      })
      .join("");
    return `<div style="font-weight:600;margin-bottom:2px;">${header}</div>${rows}`;
  };
}

function baseOption(mode: ChartMode, tooltipFormat: (value: number) => string): EChartsOption {
  const textColor = mode === "dark" ? "#ffffff" : "#0b0b0b";
  const muted = MUTED_TEXT[mode];
  const grid = GRIDLINE[mode];
  return {
    backgroundColor: CHART_SURFACE[mode],
    textStyle: { fontFamily: FONT_FAMILY, color: textColor },
    tooltip: {
      trigger: "axis",
      backgroundColor: mode === "dark" ? "#202020" : "#ffffff",
      borderColor: grid,
      textStyle: { color: textColor, fontFamily: FONT_FAMILY },
      axisPointer: { type: "cross", label: { backgroundColor: mode === "dark" ? "#202020" : "#ffffff" } },
      formatter: axisTooltipFormatter(tooltipFormat),
    },
    // "scroll" keeps the legend to a single row (paging with </> controls
    // once it overflows) instead of wrapping onto a second line — a
    // wrapped legend's height varies with how many children a chart has,
    // which pushed a second row into the fixed grid.top below on charts
    // with 8+ series (e.g. Food's 9-way sub-category breakdown).
    legend: {
      type: "scroll",
      top: 0,
      left: 0,
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: muted, fontFamily: FONT_FAMILY, fontSize: 12 },
      pageIconColor: muted,
      pageIconInactiveColor: grid,
      pageTextStyle: { color: muted, fontFamily: FONT_FAMILY, fontSize: 11 },
    },
    grid: { left: 48, right: 24, top: 40, bottom: 32, containLabel: true },
    xAxis: {
      type: "time",
      axisLine: { lineStyle: { color: muted } },
      axisLabel: { color: muted },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: muted, formatter: "{value}%" },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: grid } },
    },
  };
}

function toTimeSeries(points: { ds: string; y: number }[]): [string, number][] {
  return points.map((p) => [p.ds, p.y]);
}

/** Prepends the last real point as a "bridge" so a dashed forecast series
 * connects to the real one with no visual gap at the actual/forecast
 * boundary — without it, ECharts draws the dashed line starting only at
 * the first forecast date, leaving a blank stretch between the two.
 */
function toForecastTimeSeries(actual: SeriesPoint[], points: ForecastPoint[]): [string, number][] {
  const bridge: [string, number][] = actual.length > 0 ? [[actual[actual.length - 1].ds, actual[actual.length - 1].y]] : [];
  return [...bridge, ...points.map((p) => [p.ds, p.yhat] as [string, number])];
}

/**
 * A shaded confidence band around a forecast line: an invisible
 * lower-bound series (`lo`) with an area-only delta series (`hi - lo`)
 * stacked on top of it, so the visible fill spans exactly [lo, hi] at
 * every date — showing a forecast's own uncertainty rather than a single
 * point estimate that reads as more certain than it is. No-ops (returns
 * `[]`) wherever a point carries no interval at all — the reconciled
 * total never does (summing per-division intervals isn't statistically
 * valid, see inflation-forecast's publish.py), so this only ever
 * produces a band for a single division's own forecast.
 */
function toForecastBandSeries(actual: SeriesPoint[], points: ForecastPoint[], color: string): SeriesOption[] {
  const withInterval = points.filter((p): p is ForecastPoint & { lo: number; hi: number } => p.lo != null && p.hi != null);
  if (withInterval.length === 0) return [];

  const bridge = actual.length > 0 ? actual[actual.length - 1] : undefined;
  const lowerData: [string, number][] = bridge ? [[bridge.ds, bridge.y]] : [];
  const deltaData: [string, number][] = bridge ? [[bridge.ds, 0]] : [];
  for (const p of withInterval) {
    lowerData.push([p.ds, p.lo]);
    deltaData.push([p.ds, p.hi - p.lo]);
  }

  const bandLabel = forecast.level != null ? `${forecast.level}% interval` : "Projected interval";
  const shared = { type: "line" as const, stack: "forecast-interval", showSymbol: false, silent: true, tooltip: { show: false } };

  return [
    { ...shared, id: "__interval-lower", name: "__interval-lower", data: lowerData, lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } },
    {
      ...shared,
      id: "__interval-band",
      name: bandLabel,
      data: deltaData,
      lineStyle: { opacity: 0 },
      areaStyle: { color, opacity: 0.15 },
      itemStyle: { color, opacity: 0.15 },
    },
  ];
}

/**
 * A "fan" of nested confidence bands — several `toForecastBandSeries`-style
 * stacked [lower, delta] pairs, one per level in each point's `bands`
 * array, each on its own independent stack id (so the levels don't sum
 * into each other) with *decreasing* opacity as the level widens: the
 * narrow, more-likely band reads as the most solid, the widest band the
 * faintest — the standard fan-chart convention (e.g. the Bank of
 * England's own Monetary Policy Report fan charts). Points without a
 * `bands` array are skipped; returns `[]` entirely if none carry one
 * (e.g. a run with `compute_fan=False`, or before the first run that
 * computed conformal bands at all).
 */
function toForecastFanSeries(actual: SeriesPoint[], points: ForecastPoint[], color: string): SeriesOption[] {
  const withBands = points.filter((p): p is ForecastPoint & { bands: ForecastBand[] } => !!p.bands && p.bands.length > 0);
  if (withBands.length === 0) return [];

  const levels = Array.from(new Set(withBands.flatMap((p) => p.bands.map((b) => b.level)))).sort((a, b) => a - b);
  const bridge = actual.length > 0 ? actual[actual.length - 1] : undefined;
  const maxOpacity = 0.3;
  const minOpacity = 0.1;

  const series: SeriesOption[] = [];
  levels.forEach((level, i) => {
    const lowerData: [string, number][] = bridge ? [[bridge.ds, bridge.y]] : [];
    const deltaData: [string, number][] = bridge ? [[bridge.ds, 0]] : [];
    for (const p of withBands) {
      const band = p.bands.find((b) => b.level === level);
      if (!band) continue;
      lowerData.push([p.ds, band.lo]);
      deltaData.push([p.ds, band.hi - band.lo]);
    }

    const opacity = levels.length > 1 ? maxOpacity - i * ((maxOpacity - minOpacity) / (levels.length - 1)) : maxOpacity;
    const shared = { type: "line" as const, stack: `fan-${level}`, showSymbol: false, silent: true, tooltip: { show: false } };
    series.push(
      { ...shared, id: `__fan-lower-${level}`, name: `__fan-lower-${level}`, data: lowerData, lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } },
      {
        ...shared,
        id: `__fan-band-${level}`,
        name: `${level}% interval`,
        data: deltaData,
        lineStyle: { opacity: 0 },
        areaStyle: { color, opacity },
        itemStyle: { color, opacity },
      },
    );
  });
  return series;
}

/**
 * Aligns every child's series onto the union of all dates that appear in
 * any of them, filling 0 wherever one child has no observation at a date
 * another does. Sub-categories are introduced/retired at different times
 * (e.g. a division's newer sub-category may only start in the late 1990s
 * while its siblings go back to the 1980s) — without this, ECharts'
 * stacking simply omits a missing child at a given date rather than
 * treating it as zero, which tears a visible gap through the stack
 * (rather than a clean "hadn't been split out yet" step to zero). Only
 * correct for stacking additive series (weights, ppt contributions) —
 * never use this to fill a rate series, where "no data" and "0%" mean
 * very different things.
 */
function alignedForStacking(children: ChildSeries[]): [string, number][][] {
  const pointsByChild = children.map((c) => seriesFor(c.uniqueId));
  const allDates = Array.from(new Set(pointsByChild.flatMap((pts) => pts.map((p) => p.ds)))).sort();
  return pointsByChild.map((pts) => {
    const byDate = new Map(pts.map((p) => [p.ds, p.y]));
    return allDates.map((d) => [d, byDate.get(d) ?? 0] as [string, number]);
  });
}

export function headlineChart(mode: ChartMode): EChartsOption {
  const base = baseOption(mode, (v) => formatPercent(v, 1));
  const series: SeriesOption[] = registry.headline.map((source) => ({
    type: "line",
    name: source.name,
    data: toTimeSeries(seriesFor(source.unique_id)),
    showSymbol: false,
    lineStyle: { width: 2, color: source.unique_id === "GB.CPI" ? HEADLINE_COLOR[mode] : "#898781" },
    itemStyle: { color: source.unique_id === "GB.CPI" ? HEADLINE_COLOR[mode] : "#898781" },
  }));

  // Only GB.CPI gets a projection — the reconciliation hierarchy is built
  // from CPI-consistent division contributions, with no basis for CPIH's
  // owner-occupier housing cost treatment.
  const actualCpi = seriesFor("GB.CPI");
  const projected = hasForecast() ? forecastFor(forecast.totalUniqueId) : [];
  if (projected.length > 0) {
    series.push({
      type: "line",
      // No FORECAST_ID_SUFFIX id here — the tooltip formatter appends
      // "(projected)" for series marked that way, which would double up
      // with this series' own already-descriptive name.
      name: "CPI (projected)",
      data: toForecastTimeSeries(actualCpi, projected),
      showSymbol: false,
      lineStyle: { width: 2, color: HEADLINE_COLOR[mode], type: "dashed", opacity: FORECAST_OPACITY },
      itemStyle: { color: HEADLINE_COLOR[mode], opacity: FORECAST_OPACITY },
    });
    // A fan, not a single band — the reconciled total's own conformal
    // prediction bands (inflation-forecast's conformal.py), not combined
    // from the divisions' (still not statistically valid, same as ever —
    // this sidesteps that instead of working around it). No-ops if the
    // points don't carry a `bands` array at all (e.g. before the first
    // run that computed one, or a `compute_fan=False` run).
    series.push(...toForecastFanSeries(actualCpi, projected, HEADLINE_COLOR[mode]));
  }

  return {
    ...base,
    legend: { ...base.legend, data: series.map((s) => s.name as string).filter((name) => !name.startsWith("__")) },
    series,
  };
}

/**
 * The 12 top-level divisions each already have their own validated,
 * CVD-checked hue — those stay exactly as assigned. But a division or
 * subdivision's own sub-categories (e.g. Transport's 07.1/07.2/07.3) all
 * share one hue via `subdivisionColor` (inherited from their common
 * top-level division), so plotted together they're indistinguishable.
 * When every entry in a set shares the same top-level division, spread
 * them across a same-hue lightness ramp instead — still reads as
 * "Transport", but each sibling gets a distinct shade.
 */
function colorsFor(children: ChildSeries[], mode: ChartMode): string[] {
  const topLevels = new Set(children.map((c) => c.coicop.split(".")[0]));
  if (topLevels.size <= 1 && children.length > 1) {
    return children.map((c, i) => childColor(c.coicop, i, children.length, mode));
  }
  return children.map((c) => subdivisionColor(c.coicop, mode));
}

/**
 * A set of children's series stacked as a filled area chart — valid for
 * anything additive (ppt contributions, which ONS pre-weights to sum to
 * the parent's own rate; basket weights, which are per-mille shares of one
 * total). Never feed a set of independent rates/percentages into this —
 * see `multiLineChildrenChart` for those.
 */
function stackedChildrenChart(
  children: ChildSeries[],
  mode: ChartMode,
  yAxisName: string,
  yAxisFormatter: string,
  tooltipFormat: (value: number) => string,
): EChartsOption {
  const base = baseOption(mode, tooltipFormat);
  const colors = colorsFor(children, mode);
  const aligned = alignedForStacking(children);
  const series: SeriesOption[] = children.map((child, i) => {
    const color = colors[i];
    return {
      type: "line",
      name: child.name,
      data: aligned[i],
      stack: "children",
      showSymbol: false,
      lineStyle: { width: 0.5, color },
      itemStyle: { color },
      areaStyle: { color, opacity: 1 },
      emphasis: { focus: "series" },
    };
  });

  // A separate stack id ("children-forecast", not "children") for the
  // dashed continuation — putting it in the same stack as the real series
  // would double-count the one date they share (the bridge point sits at
  // the same x-date as the real series' own last point, and ECharts sums
  // every series sharing a stack id at each x-value). With its own stack
  // id, this stack's own total at the bridge date equals the real stack's
  // total there anyway (every child's bridge value is just its own last
  // real value), so the two visually align without ECharts ever summing
  // across both groups. An uncovered child simply gets no forecast series.
  // Named identically to its real counterpart (not "X (projected)") so
  // the two share one legend entry — 12 divisions already fill the legend;
  // doubling it with near-duplicate names would just be clutter.
  if (hasForecast()) {
    children.forEach((child, i) => {
      if (!forecast.coverage.included.includes(child.uniqueId)) return;
      const points = forecastFor(child.uniqueId);
      if (points.length === 0) return;
      const color = colors[i];
      series.push({
        type: "line",
        id: `${child.uniqueId}${FORECAST_ID_SUFFIX}`,
        name: child.name,
        data: toForecastTimeSeries(seriesFor(child.uniqueId), points),
        stack: "children-forecast",
        showSymbol: false,
        lineStyle: { width: 0.5, color, type: "dashed", opacity: FORECAST_OPACITY },
        itemStyle: { color, opacity: FORECAST_OPACITY },
        emphasis: { focus: "series" },
      });
    });
  }

  return {
    ...base,
    yAxis: {
      ...base.yAxis,
      name: yAxisName,
      nameGap: 40,
      nameLocation: "middle",
      axisLabel: { color: MUTED_TEXT[mode], formatter: yAxisFormatter },
    },
    series,
  };
}

/**
 * The same set of children as separate (non-stacked) lines — the correct
 * shape for comparing independent rates of change, where stacking would
 * produce a number with no real meaning.
 */
function multiLineChildrenChart(
  children: ChildSeries[],
  mode: ChartMode,
  yAxisName: string,
  yAxisFormatter: string,
  tooltipFormat: (value: number) => string,
): EChartsOption {
  const base = baseOption(mode, tooltipFormat);
  const colors = colorsFor(children, mode);
  const series: SeriesOption[] = children.map((child, i) => {
    const color = colors[i];
    return {
      type: "line",
      name: child.name,
      data: toTimeSeries(seriesFor(child.uniqueId)),
      showSymbol: false,
      lineStyle: { width: 1.5, color },
      itemStyle: { color },
      emphasis: { focus: "series", lineStyle: { width: 3 } },
    };
  });

  return {
    ...base,
    yAxis: {
      ...base.yAxis,
      name: yAxisName,
      nameGap: 40,
      nameLocation: "middle",
      axisLabel: { color: MUTED_TEXT[mode], formatter: yAxisFormatter },
    },
    series,
  };
}

/** The stack's own top edge already *is* the total (these are ONS's
 * published components, not reconstructed) — an extra headline overlay
 * line here reads as a second, competing total rather than a useful
 * cross-check, especially where a division's contribution isn't
 * discovered yet. The Headline page is the place for the CPI/CPIH trend
 * on its own.
 */
export function contributorsChart(mode: ChartMode): EChartsOption {
  return stackedChildrenChart(topLevelContributionChildren(), mode, "Percentage points", "{value}%", (v) => formatPercent(v, 2));
}

/** Stacked basket-weight-over-time chart for any set of children — the 12
 * divisions at the top level, or a division/subdivision's own
 * sub-categories further down. Weights are additive, so this is valid at
 * every level, unlike the rate chart below.
 */
export function stackedWeightChart(children: ChildSeries[], mode: ChartMode): EChartsOption {
  return stackedChildrenChart(children, mode, "Basket weight (‰)", "{value}", formatWeight);
}

/** Multi-line 12-month-rate comparison for any set of children — never
 * stacked, since each is an independent rate of change rather than a
 * pre-weighted contribution (see `childRateSeriesOf`'s doc comment).
 */
export function multiLineRateChart(children: ChildSeries[], mode: ChartMode): EChartsOption {
  return multiLineChildrenChart(children, mode, "12-month rate", "{value}%", (v) => formatPercent(v, 1));
}

interface TreemapNode {
  name: string;
  value: number;
  coicop: string;
  itemStyle: { color: string };
  children?: TreemapNode[];
}

/** Builds one treemap node and, recursively, every descendant the data
 * actually has — however deep that goes (most divisions bottom out at the
 * group level; Transport and Food go a class deeper). A leaf naturally has
 * no `children` key, which both ECharts (nothing to zoom into) and the
 * click handler (nowhere deeper to go, so navigate to the page instead)
 * read as "this is as far as it goes".
 */
function buildTreemapNode(coicop: string, name: string, uniqueId: string, color: string, mode: ChartMode): TreemapNode {
  const points = seriesFor(uniqueId);
  // Rounded here (not at render time) so the plain "{c}‰" built-in label
  // token shows a clean one-decimal figure without a custom formatter.
  const value = points.length > 0 ? Math.round(points[points.length - 1].y * 10) / 10 : 0;
  const kids = childWeightSeriesOf(coicop);
  const node: TreemapNode = { name, value, coicop, itemStyle: { color } };
  if (kids.length > 0) {
    node.children = kids.map((k, i) => buildTreemapNode(k.coicop, k.name, k.uniqueId, childColor(k.coicop, i, kids.length, mode), mode));
  }
  return node;
}

export function basketTreemap(mode: ChartMode): EChartsOption {
  const textColor = mode === "dark" ? "#ffffff" : "#0b0b0b";
  const muted = MUTED_TEXT[mode];
  const divisions = weightsSorted().filter((w) => w.coicop);

  const data: TreemapNode[] = divisions.map((d) =>
    buildTreemapNode(d.coicop as string, d.division_name ?? d.name, d.unique_id, divisionColor(d.coicop as string, mode), mode),
  );

  const accent = mode === "dark" ? "#6fa8ec" : "#2a78d6";

  return {
    backgroundColor: CHART_SURFACE[mode],
    textStyle: { fontFamily: FONT_FAMILY, color: textColor },
    tooltip: {
      // enterable + a real <a> in the formatter: hovering any node — leaf
      // or a zoomed-in parent — offers a link to that node's own page,
      // without adding a second permanent click target on the tile
      // itself (which stays devoted to zooming, in vs. out).
      enterable: true,
      confine: true,
      backgroundColor: mode === "dark" ? "#202020" : "#ffffff",
      borderColor: GRIDLINE[mode],
      textStyle: { color: textColor, fontFamily: FONT_FAMILY },
      formatter: (params) => {
        const p = params as { name: string; value: number; data?: TreemapNode };
        const coicop = p.data?.coicop;
        const href = coicop ? `/${coicop.includes(".") ? "subdivision" : "division"}/${coicop}` : null;
        const link = href
          ? `<div style="margin-top:4px"><a href="${href}" style="color:${accent};font-weight:600;">View page &rarr;</a></div>`
          : "";
        return `<div>${p.name}<br/><b>${formatWeight(p.value)}</b> of the basket</div>${link}`;
      },
    },
    series: [
      {
        type: "treemap",
        name: "All items",
        roam: false,
        // Show only the top level to start — a node with children zooms
        // into them in place on click (one level deeper each time,
        // matching leafDepth); a leaf has nothing to zoom into, so the
        // click handler navigates instead — see Chart.tsx. The
        // breadcrumb (styled as plain text, not a boxed chip) is the way
        // back out — it's the only such control, so it stays even though
        // it's minimal at the root.
        leafDepth: 1,
        nodeClick: "zoomToNode",
        breadcrumb: {
          show: true,
          left: "left",
          top: 0,
          height: 20,
          itemStyle: {
            color: "transparent",
            borderWidth: 0,
            textStyle: { color: muted, fontFamily: FONT_FAMILY, fontSize: 12 },
          },
          emphasis: { itemStyle: { textStyle: { color: accent } } },
        },
        upperLabel: {
          show: true,
          height: 26,
          color: "#ffffff",
          fontFamily: FONT_FAMILY,
          fontWeight: 600,
          fontSize: 13,
          textShadowColor: "rgba(0, 0, 0, 0.45)",
          textShadowBlur: 6,
          // Needs its own plain formatter — left unset, it falls back to
          // `label`'s formatter below and prints its "{b}\n{c}‰" content
          // as a two-line header, not the single-line strip this is.
          formatter: "{b}",
        },
        label: {
          show: true,
          position: ["50%", "50%"],
          align: "center",
          verticalAlign: "middle",
          color: "#ffffff",
          fontFamily: FONT_FAMILY,
          fontSize: 14,
          fontWeight: 600,
          lineHeight: 20,
          // A soft shadow (not a hard outline) keeps this legible against
          // any tile color without the chunky "stroked text" look.
          textShadowColor: "rgba(0, 0, 0, 0.45)",
          textShadowBlur: 6,
          // Built-in tokens ({b} name, {c} value — value is pre-rounded in
          // buildTreemapNode) instead of a custom rich-text formatter: a
          // richer per-line style map didn't reliably apply here, and a
          // plain centered two-line label reads cleaner anyway.
          formatter: "{b}\n{c}‰",
        },
        itemStyle: { borderColor: CHART_SURFACE[mode], borderWidth: 2, gapWidth: 2 },
        // level 0 is the invisible root itself — without this it draws its
        // own "All items" header strip in addition to the breadcrumb below,
        // duplicating the same label two different ways.
        levels: [
          { upperLabel: { show: false } },
          {},
          { itemStyle: { gapWidth: 1 } },
          { itemStyle: { gapWidth: 1 } },
        ],
        data,
      },
    ],
  };
}

/** A single COICOP series as its own chart — "area" for a rate/contribution
 * (continuously varying, % on the axis), "step" for a weight (only changes
 * at ONS's Jan/Feb rebasing, plain number on the axis). Division and
 * subdivision pages both use this; only the source lookup and color differ.
 */
function singleSeriesChart(
  source: SeriesSource | undefined,
  coicop: string,
  color: string,
  mode: ChartMode,
  yAxisName: string,
  variant: "area" | "step",
  tooltipFormat: (value: number) => string,
  forecastPoints: ForecastPoint[] = [],
): EChartsOption {
  const base = baseOption(mode, tooltipFormat);
  const name = source?.division_name ?? coicop;
  const actual = source ? seriesFor(source.unique_id) : [];
  const data = toTimeSeries(actual);
  const line: SeriesOption =
    variant === "area"
      ? { type: "line", name, data, showSymbol: false, lineStyle: { width: 2, color }, itemStyle: { color }, areaStyle: { color, opacity: 0.85 } }
      : { type: "line", name, data, step: "end", showSymbol: true, symbolSize: 6, lineStyle: { width: 2, color }, itemStyle: { color } };

  const series: SeriesOption[] = [line];
  if (forecastPoints.length > 0) {
    series.push({
      type: "line",
      name: "Projected",
      data: toForecastTimeSeries(actual, forecastPoints),
      showSymbol: false,
      lineStyle: { width: 2, color, type: "dashed", opacity: FORECAST_OPACITY },
      itemStyle: { color, opacity: FORECAST_OPACITY },
    });
    series.push(...toForecastBandSeries(actual, forecastPoints, color));
  }

  return {
    ...base,
    // Unconditionally hidden otherwise (a single series names itself in
    // the chart's own heading) — shown only once a forecast series joins,
    // so actual vs. projected (and the interval band, if any) is labeled.
    legend: {
      ...base.legend,
      show: forecastPoints.length > 0,
      data: series.map((s) => s.name as string).filter((n) => !n.startsWith("__")),
    },
    yAxis: {
      ...base.yAxis,
      name: yAxisName,
      nameGap: 32,
      nameLocation: "middle",
      axisLabel: { color: MUTED_TEXT[mode], formatter: variant === "area" ? "{value}%" : "{value}" },
    },
    series,
  };
}

export function divisionContributionChart(coicop: string, mode: ChartMode): EChartsOption {
  const source = divisionByCoicop(coicop);
  const covered = hasForecast() && !!source && forecast.coverage.included.includes(source.unique_id);
  const forecastPoints = covered && source ? forecastFor(source.unique_id) : [];
  return singleSeriesChart(
    source,
    coicop,
    divisionColor(coicop, mode),
    mode,
    "Contribution to headline CPI (ppt)",
    "area",
    (v) => formatPercent(v, 2),
    forecastPoints,
  );
}

export function divisionWeightChart(coicop: string, mode: ChartMode): EChartsOption {
  return singleSeriesChart(weightByCoicop(coicop), coicop, divisionColor(coicop, mode), mode, "Basket weight (‰)", "step", formatWeight);
}

export function subdivisionRateChart(coicop: string, mode: ChartMode): EChartsOption {
  return singleSeriesChart(subdivisionByCoicop(coicop), coicop, subdivisionColor(coicop, mode), mode, "12-month rate", "area", (v) =>
    formatPercent(v, 1),
  );
}

export function subdivisionWeightChart(coicop: string, mode: ChartMode): EChartsOption {
  return singleSeriesChart(
    subdivisionWeightByCoicop(coicop),
    coicop,
    subdivisionColor(coicop, mode),
    mode,
    "Basket weight (‰)",
    "step",
    formatWeight,
  );
}
