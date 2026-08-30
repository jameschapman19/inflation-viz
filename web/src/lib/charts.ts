import type { EChartsOption, SeriesOption } from "echarts";
import { CHART_SURFACE, GRIDLINE, HEADLINE_COLOR, MUTED_TEXT, childColor, divisionColor, subdivisionColor } from "./colors";
import type { ChildSeries } from "./data";
import type { SeriesSource } from "./types";
import {
  childWeightSeriesOf,
  divisionByCoicop,
  registry,
  seriesFor,
  subdivisionByCoicop,
  subdivisionWeightByCoicop,
  topLevelContributionChildren,
  weightByCoicop,
  weightsSorted,
} from "./data";

export type ChartMode = "light" | "dark";

const FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', sans-serif";

function baseOption(mode: ChartMode): EChartsOption {
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
  const base = baseOption(mode);
  const series: SeriesOption[] = registry.headline.map((source) => ({
    type: "line",
    name: source.name,
    data: toTimeSeries(seriesFor(source.unique_id)),
    showSymbol: false,
    lineStyle: { width: 2, color: source.unique_id === "GB.CPI" ? HEADLINE_COLOR[mode] : "#898781" },
    itemStyle: { color: source.unique_id === "GB.CPI" ? HEADLINE_COLOR[mode] : "#898781" },
  }));
  return { ...base, series };
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
): EChartsOption {
  const base = baseOption(mode);
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
): EChartsOption {
  const base = baseOption(mode);
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
  return stackedChildrenChart(topLevelContributionChildren(), mode, "Percentage points", "{value}%");
}

/** Stacked basket-weight-over-time chart for any set of children — the 12
 * divisions at the top level, or a division/subdivision's own
 * sub-categories further down. Weights are additive, so this is valid at
 * every level, unlike the rate chart below.
 */
export function stackedWeightChart(children: ChildSeries[], mode: ChartMode): EChartsOption {
  return stackedChildrenChart(children, mode, "Basket weight (‰)", "{value}");
}

/** Multi-line 12-month-rate comparison for any set of children — never
 * stacked, since each is an independent rate of change rather than a
 * pre-weighted contribution (see `childRateSeriesOf`'s doc comment).
 */
export function multiLineRateChart(children: ChildSeries[], mode: ChartMode): EChartsOption {
  return multiLineChildrenChart(children, mode, "12-month rate", "{value}%");
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
        return `<div>${p.name}<br/><b>${p.value.toFixed(1)}‰</b> of the basket</div>${link}`;
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
): EChartsOption {
  const base = baseOption(mode);
  const name = source?.division_name ?? coicop;
  const data = toTimeSeries(source ? seriesFor(source.unique_id) : []);
  const line: SeriesOption =
    variant === "area"
      ? { type: "line", name, data, showSymbol: false, lineStyle: { width: 2, color }, itemStyle: { color }, areaStyle: { color, opacity: 0.85 } }
      : { type: "line", name, data, step: "end", showSymbol: true, symbolSize: 6, lineStyle: { width: 2, color }, itemStyle: { color } };

  return {
    ...base,
    legend: { show: false },
    yAxis: {
      ...base.yAxis,
      name: yAxisName,
      nameGap: 32,
      nameLocation: "middle",
      axisLabel: { color: MUTED_TEXT[mode], formatter: variant === "area" ? "{value}%" : "{value}" },
    },
    series: [line],
  };
}

export function divisionContributionChart(coicop: string, mode: ChartMode): EChartsOption {
  return singleSeriesChart(divisionByCoicop(coicop), coicop, divisionColor(coicop, mode), mode, "Contribution to headline CPI (ppt)", "area");
}

export function divisionWeightChart(coicop: string, mode: ChartMode): EChartsOption {
  return singleSeriesChart(weightByCoicop(coicop), coicop, divisionColor(coicop, mode), mode, "Basket weight (‰)", "step");
}

export function subdivisionRateChart(coicop: string, mode: ChartMode): EChartsOption {
  return singleSeriesChart(subdivisionByCoicop(coicop), coicop, subdivisionColor(coicop, mode), mode, "12-month rate", "area");
}

export function subdivisionWeightChart(coicop: string, mode: ChartMode): EChartsOption {
  return singleSeriesChart(subdivisionWeightByCoicop(coicop), coicop, subdivisionColor(coicop, mode), mode, "Basket weight (‰)", "step");
}
