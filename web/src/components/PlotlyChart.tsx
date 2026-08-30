"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { ChartMode } from "@/lib/charts";
import { basketTreemap, contributorsChart, headlineChart } from "@/lib/charts";

// Plotly needs `window`, so it can only run in the browser — dynamic import
// with ssr:false keeps it out of the server-rendered bundle. Because this
// subtree never renders on the server, reading the browser's color-scheme
// preference below carries no hydration-mismatch risk.
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const BUILDERS = {
  headline: headlineChart,
  contributors: contributorsChart,
  basket: basketTreemap,
} as const;

export type ChartKind = keyof typeof BUILDERS;

function currentMode(): ChartMode {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function PlotlyChart({ chart }: { chart: ChartKind }) {
  const [mode, setMode] = useState<ChartMode>(currentMode);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setMode(query.matches ? "light" : "dark");
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const { data, layout } = BUILDERS[chart](mode);

  return (
    <Plot
      data={data}
      layout={{ ...layout, autosize: true }}
      style={{ width: "100%", height: "440px" }}
      useResizeHandler
      config={{ displayModeBar: false, responsive: true }}
    />
  );
}
