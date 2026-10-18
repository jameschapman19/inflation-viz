"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ECharts, EChartsOption } from "echarts";
import { CHART_SURFACE, GRIDLINE, HEADLINE_COLOR, MUTED_TEXT } from "@/lib/colors";
import type { ReplayData } from "@/lib/replay";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const FRAME_MS = 140;
const PROJECTED_OPACITY = 0.55;

type Mode = "light" | "dark";

interface Moment {
  date: string;
  label: string;
}

// Month starts the CPI 12-month rate peaked or troughed; kept to dates
// where the headline itself marks the episode, so the chip needs no
// further claim than "this is when it happened".
const MOMENTS: Moment[] = [
  { date: "2008-09-01", label: "2008 commodity spike" },
  { date: "2009-09-01", label: "2009 recession dip" },
  { date: "2011-09-01", label: "2011 VAT & energy" },
  { date: "2017-11-01", label: "2017 sterling slump" },
  { date: "2022-10-01", label: "2022 energy shock" },
];

function currentMode(): Mode {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function monthLabel(ds: string): string {
  return new Date(`${ds}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

// "2022-10-01" <-> "#2022-10"
const toHash = (ds: string) => `#${ds.slice(0, 7)}`;
const fromHash = (hash: string) => (/^#\d{4}-\d{2}$/.test(hash) ? `${hash.slice(1)}-01` : null);

export function Replay({ data }: { data: ReplayData }) {
  const { divisions, dates, headline, contributions, bands, projectedFrom } = data;
  const lastActual = (projectedFrom ?? dates.length) - 1;
  const last = dates.length - 1;
  const dateMs = useMemo(() => dates.map((ds) => Date.parse(ds)), [dates]);

  const [mode, setMode] = useState<Mode>(currentMode);
  const [t, setT] = useState(lastActual);
  const [playing, setPlaying] = useState(false);
  const barsRef = useRef<ECharts | null>(null);
  const timelineRef = useRef<ECharts | null>(null);
  const unbindClick = useRef<(() => void) | null>(null);

  const isPlaying = playing && t < last;
  const projected = projectedFrom !== null && t >= projectedFrom;

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setMode(query.matches ? "light" : "dark");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => () => unbindClick.current?.(), []);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => setT((current) => Math.min(current + 1, last)), FRAME_MS);
    return () => clearInterval(id);
  }, [isPlaying, last]);

  const select = useCallback(
    (index: number) => {
      setT(index);
      window.history.replaceState(null, "", toHash(dates[index]));
    },
    [dates],
  );

  function togglePlay() {
    if (isPlaying) {
      setPlaying(false);
      window.history.replaceState(null, "", toHash(dates[t]));
      return;
    }
    if (t >= last) setT(0);
    setPlaying(true);
  }

  const muted = MUTED_TEXT[mode];
  const grid = GRIDLINE[mode];
  const text = mode === "dark" ? "#ffffff" : "#0b0b0b";

  const barsOption = useMemo<EChartsOption>(() => {
    const flat = contributions.flat();
    return {
      backgroundColor: CHART_SURFACE[mode],
      textStyle: { fontFamily: FONT_FAMILY, color: text },
      animationDuration: 0,
      animationDurationUpdate: FRAME_MS * 1.5,
      animationEasing: "linear",
      animationEasingUpdate: "linear",
      grid: { left: 8, right: 56, top: 12, bottom: 28, containLabel: true },
      xAxis: {
        type: "value",
        min: Math.min(0, Math.floor(Math.min(...flat))),
        max: Math.ceil(Math.max(...flat)),
        axisLabel: { color: muted, formatter: "{value}ppt" },
        splitLine: { lineStyle: { color: grid } },
      },
      yAxis: {
        type: "category",
        inverse: true,
        max: divisions.length - 1,
        data: divisions.map((d) => d.name),
        axisLabel: { color: text, fontSize: 12, width: 190, overflow: "truncate" },
        axisLine: { show: false },
        axisTick: { show: false },
        animationDuration: 300,
        animationDurationUpdate: 300,
      },
      series: [
        {
          id: "bars",
          type: "bar",
          realtimeSort: true,
          data: [],
          label: {
            show: true,
            position: "right",
            color: text,
            fontSize: 12,
            valueAnimation: true,
            formatter: (p: { value: unknown }) => (p.value as number).toFixed(2),
          },
        },
      ],
    };
  }, [mode, contributions, divisions, muted, grid, text]);

  const timelineOption = useMemo<EChartsOption>(() => {
    const split = projectedFrom ?? dates.length;
    const actual = dates.slice(0, split).map((ds, i) => [ds, headline[i]]);
    // The projected line starts at the last actual point so the two join.
    const proj = projectedFrom === null ? [] : dates.slice(projectedFrom - 1).map((ds, i) => [ds, headline[projectedFrom - 1 + i]]);
    const lineColor = HEADLINE_COLOR[mode];
    return {
      backgroundColor: CHART_SURFACE[mode],
      textStyle: { fontFamily: FONT_FAMILY, color: text },
      animationDuration: 0,
      animationDurationUpdate: FRAME_MS,
      animationEasingUpdate: "linear",
      grid: { left: 8, right: 16, top: 12, bottom: 24, containLabel: true },
      tooltip: { show: false },
      xAxis: {
        type: "time",
        axisLine: { lineStyle: { color: muted } },
        axisLabel: { color: muted },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: muted, formatter: "{value}%" },
        splitLine: { lineStyle: { color: grid } },
      },
      series: [
        { id: "actual", type: "line", data: actual, showSymbol: false, silent: true, lineStyle: { width: 2, color: lineColor } },
        {
          id: "projected",
          type: "line",
          data: proj,
          showSymbol: false,
          silent: true,
          lineStyle: { width: 2, color: lineColor, type: "dashed", opacity: PROJECTED_OPACITY },
        },
        {
          id: "cursor",
          type: "scatter",
          data: [],
          symbolSize: 14,
          silent: true,
          itemStyle: { color: lineColor, borderColor: CHART_SURFACE[mode], borderWidth: 2 },
          z: 10,
        },
      ],
    };
  }, [mode, dates, headline, projectedFrom, muted, grid, text]);

  // Drive both charts from `t` through setOption (merge by series id) so
  // the bars animate between frames instead of being rebuilt each tick.
  useEffect(() => {
    barsRef.current?.setOption({
      series: [
        {
          id: "bars",
          data: divisions.map((d, i) => ({
            value: contributions[t][i],
            itemStyle: { color: d.color[mode], opacity: projected ? PROJECTED_OPACITY : 1 },
          })),
        },
      ],
    });
    timelineRef.current?.setOption({ series: [{ id: "cursor", data: [[dates[t], headline[t]]] }] });
  }, [t, mode, projected, divisions, contributions, dates, headline, barsOption, timelineOption]);

  function onTimelineReady(instance: ECharts) {
    timelineRef.current = instance;
    // Deep link: `/replay#2022-10` opens on that month. Read here, once the
    // client has mounted, so server and client render the same first frame.
    const linked = dates.indexOf(fromHash(window.location.hash) ?? "");
    if (linked >= 0) setT(linked);
    unbindClick.current?.();
    const zr = instance.getZr();
    const onClick = (event: { offsetX: number; offsetY: number }) => {
      const point = instance.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [event.offsetX, event.offsetY]) as [number, number];
      let nearest = 0;
      for (let i = 1; i < dateMs.length; i++) {
        if (Math.abs(dateMs[i] - point[0]) < Math.abs(dateMs[nearest] - point[0])) nearest = i;
      }
      setPlaying(false);
      select(nearest);
    };
    zr.on("click", onClick);
    unbindClick.current = () => zr.off("click", onClick);
  }

  const total = contributions[t].reduce((sum, v) => sum + v, 0);

  return (
    <>
      <div className="replay-readout">
        <div className={`stat-tile band-${bands[t]}`}>
          <div className="stat-label">{projected ? "CPI 12-month rate (projected)" : "CPI 12-month rate"}</div>
          <div className="stat-value-row">
            <span className="stat-value">{headline[t].toFixed(1)}%</span>
            <span className="stat-delta">{monthLabel(dates[t])}</span>
          </div>
          <div className="stat-meta">
            Divisions sum to {total.toFixed(1)}ppt
            {projected ? " · this project's own projection, not ONS data" : ""}
          </div>
        </div>
        <div className="replay-moments" role="group" aria-label="Jump to a moment">
          {MOMENTS.filter((m) => dates.includes(m.date)).map((m) => (
            <button
              key={m.date}
              type="button"
              className={dates[t] === m.date ? "range-btn active" : "range-btn"}
              onClick={() => {
                setPlaying(false);
                select(dates.indexOf(m.date));
              }}
            >
              {m.label}
            </button>
          ))}
          <button
            type="button"
            className={t === lastActual ? "range-btn active" : "range-btn"}
            onClick={() => {
              setPlaying(false);
              select(lastActual);
            }}
          >
            Latest
          </button>
        </div>
      </div>

      <section className="chart-section">
        <ReactECharts
          option={barsOption}
          style={{ width: "100%", height: "430px" }}
          onChartReady={(instance: ECharts) => {
            barsRef.current = instance;
          }}
        />
      </section>

      <section className="chart-section">
        <ReactECharts option={timelineOption} style={{ width: "100%", height: "170px", cursor: "pointer" }} onChartReady={onTimelineReady} />
        <div className="replay-controls">
          <button type="button" className="range-btn active replay-play" onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? "Pause" : t >= last ? "Replay" : "Play"}
          </button>
          <input
            type="range"
            min={0}
            max={last}
            value={t}
            aria-label="Month"
            aria-valuetext={monthLabel(dates[t])}
            onChange={(event) => {
              setPlaying(false);
              select(Number(event.target.value));
            }}
          />
        </div>
      </section>
    </>
  );
}
