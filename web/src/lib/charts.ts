import type { Data, Layout } from "plotly.js";
import { CHART_SURFACE, GRIDLINE, HEADLINE_COLOR, MUTED_TEXT, divisionColor } from "./colors";
import { divisionsSorted, latestWeights, registry, seriesFor } from "./data";

export type ChartMode = "light" | "dark";

function baseLayout(mode: ChartMode): Partial<Layout> {
  const textColor = mode === "dark" ? "#ffffff" : "#0b0b0b";
  return {
    paper_bgcolor: CHART_SURFACE[mode],
    plot_bgcolor: CHART_SURFACE[mode],
    font: { family: "system-ui, -apple-system, 'Segoe UI', sans-serif", color: textColor },
    hovermode: "x unified",
    hoverlabel: {
      bgcolor: mode === "dark" ? "#202020" : "#ffffff",
      bordercolor: GRIDLINE[mode],
      font: { color: textColor },
    },
    legend: { orientation: "h", yanchor: "bottom", y: 1.02, xanchor: "left", x: 0 },
    margin: { l: 48, r: 24, t: 16, b: 40 },
    xaxis: { gridcolor: GRIDLINE[mode], linecolor: MUTED_TEXT[mode], tickfont: { color: MUTED_TEXT[mode] } },
    yaxis: {
      gridcolor: GRIDLINE[mode],
      linecolor: MUTED_TEXT[mode],
      tickfont: { color: MUTED_TEXT[mode] },
      ticksuffix: "%",
    },
  };
}

export function headlineChart(mode: ChartMode): { data: Data[]; layout: Partial<Layout> } {
  const layout = baseLayout(mode);
  const data: Data[] = registry.headline.map((source) => {
    const points = seriesFor(source.unique_id);
    return {
      x: points.map((p) => p.ds),
      y: points.map((p) => p.y),
      name: source.name,
      mode: "lines",
      type: "scatter",
      line: { width: 2, color: source.unique_id === "GB.CPI" ? HEADLINE_COLOR[mode] : "#898781" },
      hovertemplate: `${source.name}: %{y:.1f}%<extra></extra>`,
    };
  });
  return { data, layout: { ...layout, yaxis: { ...layout.yaxis, title: { text: "12-month rate" } } } };
}

export function contributorsChart(mode: ChartMode): { data: Data[]; layout: Partial<Layout> } {
  const layout = baseLayout(mode);
  const divisions = divisionsSorted();
  const data: Data[] = divisions.map((source) => {
    const points = seriesFor(source.unique_id);
    const color = source.coicop ? divisionColor(source.coicop, mode) : "#898781";
    return {
      x: points.map((p) => p.ds),
      y: points.map((p) => p.y),
      name: source.division_name ?? source.name,
      mode: "lines",
      type: "scatter",
      stackgroup: "contributions",
      line: { width: 0.5, color },
      fillcolor: color,
      hovertemplate: `${source.division_name}: %{y:.2f}ppt<extra></extra>`,
    };
  });

  const headline = registry.headline.find((s) => s.unique_id === "GB.CPI");
  if (headline) {
    const points = seriesFor("GB.CPI");
    data.push({
      x: points.map((p) => p.ds),
      y: points.map((p) => p.y),
      name: headline.name,
      mode: "lines",
      type: "scatter",
      line: { width: 2.5, color: HEADLINE_COLOR[mode], dash: "dot" },
      hovertemplate: "Headline CPI: %{y:.1f}%<extra></extra>",
    });
  }

  return {
    data,
    layout: { ...layout, yaxis: { ...layout.yaxis, title: { text: "Percentage points" } } },
  };
}

export function basketTreemap(mode: ChartMode): { data: Data[]; layout: Partial<Layout> } {
  const layout = baseLayout(mode);
  const weights = latestWeights();
  const weightByCoicop = new Map(weights.map((w) => [w.coicop, w.weightPerMille]));
  const divisions = divisionsSorted();

  const labels = divisions.map((d) => d.division_name ?? d.name);
  const values = divisions.map((d) => (d.coicop ? (weightByCoicop.get(d.coicop) ?? 0) : 0));
  const colors = divisions.map((d) => (d.coicop ? divisionColor(d.coicop, mode) : "#898781"));

  const data: Data[] = [
    {
      type: "treemap",
      labels,
      parents: labels.map(() => ""),
      values,
      marker: { colors, line: { color: CHART_SURFACE[mode], width: 2 } },
      textinfo: "label+percent root",
      hovertemplate: "%{label}: %{value:.1f} per mille (%{percentRoot})<extra></extra>",
    } as Data,
  ];

  return { data, layout: { ...layout, margin: { l: 4, r: 4, t: 4, b: 4 } } };
}
