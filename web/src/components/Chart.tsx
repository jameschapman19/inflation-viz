"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ECElementEvent, ECharts, EChartsOption } from "echarts";
import type { ChartMode } from "@/lib/charts";
import {
  basketTreemap,
  contributorsChart,
  divisionContributionChart,
  divisionWeightChart,
  headlineChart,
  multiLineRateChart,
  seriesDateBounds,
  stackedWeightChart,
  subdivisionRateChart,
  subdivisionWeightChart,
} from "@/lib/charts";
import type { ChildSeries } from "@/lib/data";
import { seriesFor, topLevelContributionChildren } from "@/lib/data";

// ECharts renders to a canvas sized off the container, so it's kept out of
// the server-rendered bundle — this also means reading the browser's
// color-scheme preference below carries no hydration-mismatch risk.
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type Builder = (mode: ChartMode, coicop?: string, entries?: ChildSeries[]) => EChartsOption;

const BUILDERS: Record<string, Builder> = {
  headline: (mode) => headlineChart(mode),
  contributors: (mode) => contributorsChart(mode),
  basket: (mode) => basketTreemap(mode),
  "division-contribution": (mode, coicop) => divisionContributionChart(coicop ?? "", mode),
  "division-weight": (mode, coicop) => divisionWeightChart(coicop ?? "", mode),
  "subdivision-rate": (mode, coicop) => subdivisionRateChart(coicop ?? "", mode),
  "subdivision-weight": (mode, coicop) => subdivisionWeightChart(coicop ?? "", mode),
  "stacked-weight": (mode, _coicop, entries) => stackedWeightChart(entries ?? [], mode),
  "multiline-rate": (mode, _coicop, entries) => multiLineRateChart(entries ?? [], mode),
};

// Charts where clicking a series/segment should drill into that entry's
// detail page. "stacked-weight" (any level) and "multiline-rate" both
// need an explicit `entries` + `drillBasePath` prop to know what they're
// drilling into and where.
const STACK_DRILLABLE = new Set(["basket", "contributors", "stacked-weight"]);

export type ChartKind = keyof typeof BUILDERS;

// A year expressed in ms rather than calendar arithmetic — close enough
// for a "last N years" preset (leap years wash out over any real range)
// and avoids pulling in a date library for one multiplication.
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

const RANGE_PRESETS: { label: string; years: number | "all" }[] = [
  { label: "1Y", years: 1 },
  { label: "5Y", years: 5 },
  { label: "10Y", years: 10 },
  { label: "All", years: "all" },
];
const DEFAULT_RANGE = "All";

function currentMode(): ChartMode {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/**
 * ECharts only fires the standard `click` event when the cursor lands on a
 * line or symbol — not on a stacked area's filled band itself (the same
 * hit-testing gap that made Plotly's fill regions unreliable). Rather than
 * rely on that, we read the raw pixel click straight off zrender, convert
 * it back to a data coordinate, and work out which entry's stacked band
 * contains that (date, value) pair ourselves — so clicking anywhere inside
 * a band works, not just on its edge.
 */
function coicopAtStackedPoint(entries: ChildSeries[], dateMs: number, value: number): string | undefined {
  let cumulative = 0;
  for (const entry of entries) {
    const points = seriesFor(entry.uniqueId);
    if (points.length === 0 || new Date(points[0].ds).getTime() > dateMs) continue;
    let nearest = points[0];
    for (const p of points) {
      if (new Date(p.ds).getTime() > dateMs) break;
      nearest = p;
    }
    cumulative += nearest.y;
    if (value <= cumulative) return entry.coicop;
  }
  return undefined;
}

export function Chart({
  chart,
  coicop,
  entries,
  drillBasePath,
  height = "440px",
}: {
  chart: ChartKind;
  coicop?: string;
  /** Required by "stacked-weight" and "multiline-rate" — the entries to
   * chart, e.g. from `topLevelWeightChildren()` or `childRateSeriesOf(coicop)`. */
  entries?: ChildSeries[];
  /** Required alongside `entries` — where a click should navigate, e.g.
   * "/division" or "/subdivision" (the clicked entry's coicop is appended). */
  drillBasePath?: string;
  height?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ChartMode>(currentMode);
  const [activeRange, setActiveRange] = useState(DEFAULT_RANGE);
  const unbindZrClick = useRef<(() => void) | null>(null);
  const instanceRef = useRef<ECharts | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setMode(query.matches ? "light" : "dark");
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => () => unbindZrClick.current?.(), []);

  // Memoized so a re-render that has nothing to do with the chart's data —
  // clicking a range-preset button changes only `activeRange` state — doesn't
  // hand ReactECharts a new `option` object. With `notMerge` (below), any new
  // `option` reference makes it re-apply the whole option, which resets the
  // dataZoom set by `applyRange` in the same tick it takes effect.
  const option = useMemo(() => BUILDERS[chart](mode, coicop, entries), [chart, mode, coicop, entries]);
  const drillable = STACK_DRILLABLE.has(chart) || (chart === "multiline-rate" && Boolean(drillBasePath));

  function applyRange(years: number | "all") {
    const instance = instanceRef.current;
    if (!instance) return;
    if (years === "all") {
      instance.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
      return;
    }
    const bounds = seriesDateBounds(option);
    if (!bounds) return;
    instance.dispatchAction({
      type: "dataZoom",
      startValue: Math.max(bounds.min, bounds.max - years * YEAR_MS),
      endValue: bounds.max,
    });
  }

  return (
    <>
      {chart !== "basket" && (
        <div className="chart-range-controls" role="group" aria-label="Time range">
          {RANGE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={preset.label === activeRange ? "range-btn active" : "range-btn"}
              onClick={() => {
                setActiveRange(preset.label);
                applyRange(preset.years);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
      <ReactECharts
        option={option}
        style={{ width: "100%", height, cursor: drillable ? "pointer" : undefined }}
        notMerge
        lazyUpdate
        onChartReady={(instance: ECharts) => {
          instanceRef.current = instance;
          // React (dev Strict Mode, and any future remount) can call this more
          // than once for the same <Chart>; always unbind the previous
          // instance's listener before binding the newly-ready one, or a
          // dev-mode double-mount silently attaches to an instance that gets
          // disposed immediately after, leaving the live chart unclickable.
          unbindZrClick.current?.();
          unbindZrClick.current = null;
          if (!STACK_DRILLABLE.has(chart) || chart === "basket") return;

          const stackEntries = chart === "contributors" ? topLevelContributionChildren() : (entries ?? []);
          const basePath = chart === "contributors" ? "/division" : drillBasePath;
          if (!basePath || stackEntries.length === 0) return;

          const zr = instance.getZr();
          const onZrClick = (event: { offsetX: number; offsetY: number }) => {
            const point = instance.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [
              event.offsetX,
              event.offsetY,
            ]) as [number, number] | undefined;
            if (!point) return;
            const [dateMs, value] = point;
            if (value < 0) return;
            const target = coicopAtStackedPoint(stackEntries, dateMs, value);
            if (target) router.push(`${basePath}/${target}`);
          };
          zr.on("click", onZrClick);
          unbindZrClick.current = () => zr.off("click", onZrClick);
        }}
        onEvents={
          chart === "basket"
            ? {
                click: (event: ECElementEvent) => {
                  // A node with children zooms into them in place (ECharts'
                  // own nodeClick: "zoomToNode" handles that automatically);
                  // a leaf has nowhere deeper to go, so navigate to its page.
                  const data = event.data as { coicop?: string; children?: unknown[] } | undefined;
                  if (!data?.coicop || (data.children && data.children.length > 0)) return;
                  const basePath = data.coicop.includes(".") ? "/subdivision" : "/division";
                  router.push(`${basePath}/${data.coicop}`);
                },
              }
            : chart === "multiline-rate" && drillBasePath
              ? {
                  click: (event: ECElementEvent) => {
                    const match = (entries ?? []).find((c) => c.name === event.seriesName);
                    if (match) router.push(`${drillBasePath}/${match.coicop}`);
                  },
                }
              : undefined
        }
      />
    </>
  );
}
