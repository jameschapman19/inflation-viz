import type { EChartsOption, SeriesOption } from "echarts";
import { CHART_SURFACE, GRIDLINE, HEADLINE_COLOR, MUTED_TEXT, childColor, divisionColor, subdivisionColor } from "./colors";
import type { ChildSeries } from "./data";
import {
  divisionByCoicop,
  divisionsSorted,
  latestWeights,
  registry,
  seriesFor,
  subdivisionByCoicop,
  subdivisionWeightByCoicop,
  topLevelContributionChildren,
  weightByCoicop,
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
  const series: SeriesOption[] = children.map((child, i) => {
    const color = colors[i];
    return {
      type: "line",
      name: child.name,
      data: toTimeSeries(seriesFor(child.uniqueId)),
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

export function basketTreemap(mode: ChartMode): EChartsOption {
  const textColor = mode === "dark" ? "#ffffff" : "#0b0b0b";
  const weights = latestWeights();
  const weightByCoicop = new Map(weights.map((w) => [w.coicop, w.weightPerMille]));
  const divisions = divisionsSorted();

  const data = divisions.map((d) => ({
    name: d.division_name ?? d.name,
    value: d.coicop ? (weightByCoicop.get(d.coicop) ?? 0) : 0,
    itemStyle: { color: d.coicop ? divisionColor(d.coicop, mode) : "#898781" },
  }));

  return {
    backgroundColor: CHART_SURFACE[mode],
    textStyle: { fontFamily: FONT_FAMILY, color: textColor },
    tooltip: {
      backgroundColor: mode === "dark" ? "#202020" : "#ffffff",
      borderColor: GRIDLINE[mode],
      textStyle: { color: mode === "dark" ? "#ffffff" : "#0b0b0b", fontFamily: FONT_FAMILY },
      formatter: (params) => {
        const p = params as { name: string; value: number; data: { value: number } };
        return `${p.name}: ${p.value.toFixed(1)} per mille`;
      },
    },
    series: [
      {
        type: "treemap",
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        upperLabel: { show: false },
        label: {
          show: true,
          color: "#ffffff",
          fontFamily: FONT_FAMILY,
          formatter: "{b}",
        },
        itemStyle: { borderColor: CHART_SURFACE[mode], borderWidth: 2, gapWidth: 2 },
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
