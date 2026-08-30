"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ECElementEvent, ECharts } from "echarts";
import type { ChartMode } from "@/lib/charts";
import {
  basketTreemap,
  contributorsChart,
  divisionContributionChart,
  divisionWeightChart,
  headlineChart,
} from "@/lib/charts";
import { divisionCoicopByName, divisionsSorted, seriesFor } from "@/lib/data";

// ECharts renders to a canvas sized off the container, so it's kept out of
// the server-rendered bundle — this also means reading the browser's
// color-scheme preference below carries no hydration-mismatch risk.
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type Builder = (mode: ChartMode, coicop?: string) => ReturnType<typeof headlineChart>;

const BUILDERS: Record<string, Builder> = {
  headline: (mode) => headlineChart(mode),
  contributors: (mode) => contributorsChart(mode),
  basket: (mode) => basketTreemap(mode),
  "division-contribution": (mode, coicop) => divisionContributionChart(coicop ?? "", mode),
  "division-weight": (mode, coicop) => divisionWeightChart(coicop ?? "", mode),
};

// Charts where clicking a division's series/segment should drill into its
// detail page.
const DRILLABLE = new Set(["basket", "contributors"]);

export type ChartKind = keyof typeof BUILDERS;

function currentMode(): ChartMode {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/**
 * ECharts only fires the standard `click` event when the cursor lands on a
 * line or symbol — not on a stacked area's filled band itself (the same
 * hit-testing gap that made Plotly's fill regions unreliable). Rather than
 * rely on that, we read the raw pixel click straight off zrender, convert
 * it back to a data coordinate, and work out which division's stacked band
 * contains that (date, value) pair ourselves — so clicking anywhere inside
 * a band works, not just on its edge.
 */
function divisionAtStackedPoint(dateMs: number, value: number): string | undefined {
  let cumulative = 0;
  for (const division of divisionsSorted()) {
    const points = seriesFor(division.unique_id);
    if (points.length === 0 || new Date(points[0].ds).getTime() > dateMs) continue;
    let nearest = points[0];
    for (const p of points) {
      if (new Date(p.ds).getTime() > dateMs) break;
      nearest = p;
    }
    cumulative += nearest.y;
    if (value <= cumulative) return division.division_name ?? undefined;
  }
  return undefined;
}

export function Chart({
  chart,
  coicop,
  height = "440px",
}: {
  chart: ChartKind;
  coicop?: string;
  height?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ChartMode>(currentMode);
  const unbindZrClick = useRef<(() => void) | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setMode(query.matches ? "light" : "dark");
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => () => unbindZrClick.current?.(), []);

  const option = BUILDERS[chart](mode, coicop);
  const drillable = DRILLABLE.has(chart);

  return (
    <ReactECharts
      option={option}
      style={{ width: "100%", height, cursor: drillable ? "pointer" : undefined }}
      notMerge
      lazyUpdate
      onChartReady={(instance: ECharts) => {
        // React (dev Strict Mode, and any future remount) can call this more
        // than once for the same <Chart>; always unbind the previous
        // instance's listener before binding the newly-ready one, or a
        // dev-mode double-mount silently attaches to an instance that gets
        // disposed immediately after, leaving the live chart unclickable.
        unbindZrClick.current?.();
        unbindZrClick.current = null;
        if (chart !== "contributors") return;

        const zr = instance.getZr();
        const onZrClick = (event: { offsetX: number; offsetY: number }) => {
          const point = instance.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [
            event.offsetX,
            event.offsetY,
          ]) as [number, number] | undefined;
          if (!point) return;
          const [dateMs, value] = point;
          if (value < 0) return;
          const name = divisionAtStackedPoint(dateMs, value);
          const target = name && divisionCoicopByName(name);
          if (target) router.push(`/division/${target}`);
        };
        zr.on("click", onZrClick);
        unbindZrClick.current = () => zr.off("click", onZrClick);
      }}
      onEvents={
        chart === "basket"
          ? {
              click: (event: ECElementEvent) => {
                const name = typeof event.name === "string" && event.name ? event.name : undefined;
                const target = name && divisionCoicopByName(name);
                if (target) router.push(`/division/${target}`);
              },
            }
          : undefined
      }
    />
  );
}
