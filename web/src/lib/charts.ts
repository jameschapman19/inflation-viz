import type { EChartsOption, SeriesOption } from "echarts";
import { CHART_SURFACE, GRIDLINE, HEADLINE_COLOR, MUTED_TEXT, divisionColor } from "./colors";
import { divisionByCoicop, divisionsSorted, latestWeights, registry, seriesFor, weightByCoicop } from "./data";

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

export function contributorsChart(mode: ChartMode): EChartsOption {
  const base = baseOption(mode);
  const divisions = divisionsSorted();

  const series: SeriesOption[] = divisions.map((source) => {
    const color = source.coicop ? divisionColor(source.coicop, mode) : "#898781";
    return {
      type: "line",
      name: source.division_name ?? source.name,
      data: toTimeSeries(seriesFor(source.unique_id)),
      stack: "contributions",
      showSymbol: false,
      lineStyle: { width: 0.5, color },
      itemStyle: { color },
      areaStyle: { color, opacity: 1 },
      emphasis: { focus: "series" },
    };
  });

  const headline = registry.headline.find((s) => s.unique_id === "GB.CPI");
  if (headline) {
    series.push({
      type: "line",
      name: headline.name,
      data: toTimeSeries(seriesFor("GB.CPI")),
      showSymbol: false,
      lineStyle: { width: 2.5, color: HEADLINE_COLOR[mode], type: "dotted" },
      itemStyle: { color: HEADLINE_COLOR[mode] },
      z: 10,
    });
  }

  return { ...base, series };
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
