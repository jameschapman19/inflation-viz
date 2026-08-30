import type { EChartsOption, SeriesOption } from "echarts";
import { CHART_SURFACE, GRIDLINE, HEADLINE_COLOR, MUTED_TEXT, childColor, divisionColor, subdivisionColor } from "./colors";
import type { ChildSeries } from "./data";
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
    legend: {
      top: 0,
      left: 0,
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: muted, fontFamily: FONT_FAMILY, fontSize: 12 },
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

export function contributorsChart(mode: ChartMode): EChartsOption {
  const option = stackedChildrenChart(topLevelContributionChildren(), mode, "Percentage points", "{value}%");

  const headline = registry.headline.find((s) => s.unique_id === "GB.CPI");
  if (headline && Array.isArray(option.series)) {
    option.series = [
      ...option.series,
      {
        type: "line",
        name: headline.name,
        data: toTimeSeries(seriesFor("GB.CPI")),
        showSymbol: false,
        lineStyle: { width: 2.5, color: HEADLINE_COLOR[mode], type: "dotted" },
        itemStyle: { color: HEADLINE_COLOR[mode] },
        z: 10,
      },
    ];
  }

  return option;
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
  const value = points.length > 0 ? points[points.length - 1].y : 0;
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

  return {
    backgroundColor: CHART_SURFACE[mode],
    textStyle: { fontFamily: FONT_FAMILY, color: textColor },
    tooltip: {
      backgroundColor: mode === "dark" ? "#202020" : "#ffffff",
      borderColor: GRIDLINE[mode],
      textStyle: { color: textColor, fontFamily: FONT_FAMILY },
      formatter: (params) => {
        const p = params as { name: string; value: number };
        return `${p.name}: ${p.value.toFixed(1)} per mille`;
      },
    },
    series: [
      {
        type: "treemap",
        roam: false,
        // Show only the top level to start — a node with children zooms
        // into them in place on click (one level deeper each time,
        // matching leafDepth); a leaf has nothing to zoom into, so the
        // click handler navigates instead — see Chart.tsx.
        leafDepth: 1,
        nodeClick: "zoomToNode",
        breadcrumb: {
          show: true,
          top: 0,
          itemStyle: {
            color: CHART_SURFACE[mode],
            borderColor: GRIDLINE[mode],
            textStyle: { color: muted, fontFamily: FONT_FAMILY },
          },
        },
        upperLabel: { show: true, height: 24, color: "#ffffff", fontFamily: FONT_FAMILY },
        label: {
          show: true,
          color: "#ffffff",
          fontFamily: FONT_FAMILY,
          formatter: "{b}",
        },
        itemStyle: { borderColor: CHART_SURFACE[mode], borderWidth: 2, gapWidth: 2 },
        levels: [{}, {}, { itemStyle: { gapWidth: 1 } }, { itemStyle: { gapWidth: 1 } }],
        data,
      },
    ],
  };
}

export function divisionContributionChart(coicop: string, mode: ChartMode): EChartsOption {
  const base = baseOption(mode);
  const source = divisionByCoicop(coicop);
  const color = divisionColor(coicop, mode);
  const points = source ? seriesFor(source.unique_id) : [];

  const series: SeriesOption[] = [
    {
      type: "line",
      name: source?.division_name ?? coicop,
      data: toTimeSeries(points),
      showSymbol: false,
      lineStyle: { width: 2, color },
      itemStyle: { color },
      areaStyle: { color, opacity: 0.85 },
    },
  ];

  return {
    ...base,
    legend: { show: false },
    yAxis: { ...base.yAxis, name: "Contribution to headline CPI (ppt)", nameGap: 32, nameLocation: "middle" },
    series,
  };
}

export function divisionWeightChart(coicop: string, mode: ChartMode): EChartsOption {
  const base = baseOption(mode);
  const source = weightByCoicop(coicop);
  const color = divisionColor(coicop, mode);
  const points = source ? seriesFor(source.unique_id) : [];

  const series: SeriesOption[] = [
    {
      type: "line",
      name: source?.division_name ?? coicop,
      data: toTimeSeries(points),
      step: "end",
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color },
      itemStyle: { color },
    },
  ];

  return {
    ...base,
    legend: { show: false },
    yAxis: { ...base.yAxis, name: "Basket weight (‰)", nameGap: 32, nameLocation: "middle", axisLabel: { color: MUTED_TEXT[mode] } },
    series,
  };
}

export function subdivisionRateChart(coicop: string, mode: ChartMode): EChartsOption {
  const base = baseOption(mode);
  const source = subdivisionByCoicop(coicop);
  const color = subdivisionColor(coicop, mode);
  const points = source ? seriesFor(source.unique_id) : [];

  const series: SeriesOption[] = [
    {
      type: "line",
      name: source?.division_name ?? coicop,
      data: toTimeSeries(points),
      showSymbol: false,
      lineStyle: { width: 2, color },
      itemStyle: { color },
      areaStyle: { color, opacity: 0.85 },
    },
  ];

  return {
    ...base,
    legend: { show: false },
    yAxis: { ...base.yAxis, name: "12-month rate", nameGap: 32, nameLocation: "middle" },
    series,
  };
}

export function subdivisionWeightChart(coicop: string, mode: ChartMode): EChartsOption {
  const base = baseOption(mode);
  const source = subdivisionWeightByCoicop(coicop);
  const color = subdivisionColor(coicop, mode);
  const points = source ? seriesFor(source.unique_id) : [];

  const series: SeriesOption[] = [
    {
      type: "line",
      name: source?.division_name ?? coicop,
      data: toTimeSeries(points),
      step: "end",
      showSymbol: true,
      symbolSize: 6,
      lineStyle: { width: 2, color },
      itemStyle: { color },
    },
  ];

  return {
    ...base,
    legend: { show: false },
    yAxis: { ...base.yAxis, name: "Basket weight (‰)", nameGap: 32, nameLocation: "middle", axisLabel: { color: MUTED_TEXT[mode] } },
    series,
  };
}
