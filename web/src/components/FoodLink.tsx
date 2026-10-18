"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { setHash, useHash } from "@/kit/hash";
import { CHART_SURFACE, GRIDLINE, HEADLINE_COLOR, MUTED_TEXT } from "@/lib/colors";
import { MAX_LAG, type FoodData } from "@/lib/foodTypes";
import { formatMonth } from "@/lib/format";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
// The crop colour matches Agriculture Radar's amber, so the two products read as a pair.
const CROP = { light: "#875b0b", dark: "#e7b45e" };
const WINDOW_COLORS = { all: { light: "#0b0b0b", dark: "#ffffff" }, early: { light: "#2a78d6", dark: "#3987e5" }, late: { light: "#c2185b", dark: "#e0508a" } };

type Mode = "light" | "dark";
const currentMode = (): Mode => (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
const pct = (v: number) => `${v.toFixed(1)}%`;

export function FoodLink({ data }: { data: FoodData }) {
  const [mode, setMode] = useState<Mode>(currentMode);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setMode(query.matches ? "light" : "dark");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // The pair and lag live in the URL hash: `/food#bread-10`.
  const hash = useHash();
  const match = /^#([a-z]+)(?:-(\d{1,2}))?$/.exec(hash);
  const pair = data.pairs.find((p) => p.id === match?.[1]) ?? data.pairs[0];
  const all = pair.windows[0];
  const requested = match?.[2] === undefined ? undefined : Number(match[2]);
  const lag = requested !== undefined && requested <= MAX_LAG ? requested : (all.best?.lag ?? 0);
  const select = (id: string, nextLag: number) => setHash(`${id}-${nextLag}`);

  const muted = MUTED_TEXT[mode];
  const grid = GRIDLINE[mode];
  const text = mode === "dark" ? "#ffffff" : "#0b0b0b";
  const crop = CROP[mode];

  const seriesOption = useMemo<EChartsOption>(() => {
    // The commodity line at month t is the price change `lag` months earlier.
    const shifted = pair.dates.map((_, i) => (i - lag >= 0 ? pair.commodity[i - lag] : null));
    const lastCpiIndex = pair.dates.indexOf(pair.lastCpi);
    const solid = shifted.map((v, i) => (i <= lastCpiIndex ? v : null));
    // From the last published CPI month on, the line is what the past link would imply: dashed, faded.
    const implied = shifted.map((v, i) => (i >= lastCpiIndex ? v : null));
    const lastShown = shifted.reduce<number>((last, v, i) => (v === null ? last : i), 0);
    const dates = pair.dates.slice(0, lastShown + 1);
    return {
      backgroundColor: CHART_SURFACE[mode],
      textStyle: { fontFamily: FONT, color: text },
      animationDuration: 200,
      grid: { left: 8, right: 16, top: 44, bottom: 52, containLabel: true },
      legend: { top: 0, left: 0, icon: "circle", itemWidth: 8, itemHeight: 8, textStyle: { color: muted, fontSize: 12 }, data: [`UK ${pair.cpiName.toLowerCase()} inflation`, `${pair.commodityName} price change, ${lag} months earlier`] },
      tooltip: {
        trigger: "axis",
        backgroundColor: mode === "dark" ? "#202020" : "#ffffff",
        borderColor: grid,
        textStyle: { color: text },
        formatter: (raw: unknown) => {
          const params = (Array.isArray(raw) ? raw : [raw]) as { axisValue?: string; marker?: string; seriesName?: string; value?: number | null }[];
          const rows = params.filter((p) => typeof p.value === "number" && p.seriesName !== "__implied");
          return `<b>${formatMonth(params[0]?.axisValue ?? "")}</b>${rows.map((p) => `<div>${p.marker}${p.seriesName}: <b>${pct(p.value as number)}</b></div>`).join("")}`;
        },
      },
      xAxis: { type: "category", data: dates, axisLine: { lineStyle: { color: muted } }, axisTick: { show: false }, axisLabel: { color: muted, formatter: (v: string) => v.slice(0, 4), interval: (_i: number, v: string) => v.slice(5, 7) === "01" && Number(v.slice(0, 4)) % (dates.length > 200 ? 4 : 2) === 0 } },
      yAxis: { type: "value", axisLabel: { color: muted, formatter: "{value}%" }, splitLine: { lineStyle: { color: grid } } },
      dataZoom: [{ type: "inside", xAxisIndex: 0 }],
      series: [
        {
          name: `UK ${pair.cpiName.toLowerCase()} inflation`,
          type: "line",
          showSymbol: false,
          lineStyle: { width: 2.5, color: HEADLINE_COLOR[mode] },
          itemStyle: { color: HEADLINE_COLOR[mode] },
          data: pair.cpi.slice(0, lastShown + 1),
          z: 3,
        },
        {
          name: `${pair.commodityName} price change, ${lag} months earlier`,
          type: "line",
          showSymbol: false,
          lineStyle: { width: 2, color: crop },
          itemStyle: { color: crop },
          data: solid.slice(0, lastShown + 1),
          markArea:
            lastCpiIndex >= 0 && lastShown > lastCpiIndex
              ? {
                  silent: true,
                  itemStyle: { color: mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(11,11,11,0.05)" },
                  label: { show: true, position: "insideTop", color: muted, fontSize: 11, formatter: "Illustrative,\nnot a forecast" },
                  data: [[{ xAxis: pair.lastCpi }, { xAxis: dates[lastShown] }]],
                }
              : undefined,
        },
        { name: "__implied", type: "line", showSymbol: false, lineStyle: { width: 2, color: crop, type: "dashed", opacity: 0.55 }, itemStyle: { color: crop }, data: implied.slice(0, lastShown + 1), silent: true },
      ],
    };
  }, [pair, lag, mode, muted, grid, text, crop]);

  const lagOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: CHART_SURFACE[mode],
      textStyle: { fontFamily: FONT, color: text },
      animationDuration: 200,
      grid: { left: 8, right: 16, top: 44, bottom: 40, containLabel: true },
      legend: { top: 0, left: 0, icon: "circle", itemWidth: 8, itemHeight: 8, textStyle: { color: muted, fontSize: 12 } },
      tooltip: {
        trigger: "axis",
        backgroundColor: mode === "dark" ? "#202020" : "#ffffff",
        borderColor: grid,
        textStyle: { color: text },
        formatter: (raw: unknown) => {
          const params = (Array.isArray(raw) ? raw : [raw]) as { axisValue?: string; marker?: string; seriesName?: string; value?: number | null }[];
          return `<b>${pair.commodityName} leading by ${params[0]?.axisValue} months</b>${params.filter((p) => typeof p.value === "number").map((p) => `<div>${p.marker}${p.seriesName}: r = <b>${(p.value as number).toFixed(2)}</b></div>`).join("")}`;
        },
      },
      xAxis: { type: "category", name: "months the price leads", nameLocation: "middle", nameGap: 28, nameTextStyle: { color: muted }, data: Array.from({ length: MAX_LAG + 1 }, (_, i) => String(i)), axisLine: { lineStyle: { color: muted } }, axisTick: { show: false }, axisLabel: { color: muted, interval: 2 } },
      yAxis: { type: "value", min: -1, max: 1, axisLabel: { color: muted }, splitLine: { lineStyle: { color: grid } } },
      series: pair.windows.map((w, index) => ({
        name: w.label,
        type: "line" as const,
        data: w.profile,
        showSymbol: false,
        lineStyle: { width: w.key === "all" ? 3 : 2, color: WINDOW_COLORS[w.key][mode] },
        itemStyle: { color: WINDOW_COLORS[w.key][mode] },
        markLine:
          index === 0
            ? { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: muted, type: "dashed" as const }, data: [{ xAxis: String(lag) }] }
            : undefined,
      })),
    }),
    [pair, lag, mode, muted, grid, text],
  );

  const rAt = (w: (typeof pair.windows)[number]) => w.profile[lag];

  return (
    <>
      <div className="replay-moments" role="group" aria-label="Choose a pair">
        {data.pairs.map((p) => (
          <button key={p.id} type="button" className={p.id === pair.id ? "range-btn active" : "range-btn"} onClick={() => select(p.id, p.windows[0].best?.lag ?? 0)}>
            {p.label}
          </button>
        ))}
      </div>

      <section className="chart-section">
        <ReactECharts option={seriesOption} notMerge style={{ width: "100%", height: "380px" }} />
        <div className="replay-controls">
          <label className="lag-label" htmlFor="lag">
            Price leads by <b>{lag}</b> months
          </label>
          <input id="lag" type="range" min={0} max={MAX_LAG} value={lag} onChange={(e) => select(pair.id, Number(e.target.value))} aria-valuetext={`${lag} months`} />
        </div>
      </section>

      <section className="chart-section">
        <p className="lag-caption">Correlation (r) between the {pair.commodityName.toLowerCase()} price change and UK inflation, by how many months the price leads.</p>
        <ReactECharts option={lagOption} notMerge style={{ width: "100%", height: "280px" }} />
        <p className="lag-readout">
          At a {lag}-month lead:{" "}
          {pair.windows.map((w, i) => (
            <span key={w.key}>
              {i > 0 && " · "}
              {w.label}: <b>{rAt(w) === null ? "n/a" : `r = ${(rAt(w) as number).toFixed(2)}`}</b>
            </span>
          ))}
        </p>
      </section>
    </>
  );
}
