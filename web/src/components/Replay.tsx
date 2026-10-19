"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ECElementEvent, ECharts, EChartsOption } from "echarts";
import { CHART_SURFACE, GRIDLINE, HEADLINE_COLOR, MUTED_TEXT } from "@/lib/colors";
import type { ReplayData, ReplayNode } from "@/lib/replay";
import { StripeScrubber } from "@/kit/StripeScrubber";
import { stripeFill } from "@/lib/stripeColor";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const FRAME_MS = 140;
const PROJECTED_OPACITY = 0.55;
const RESIDUAL_LABEL = "Chain-linking residual";

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

const clamp = (value: number, lo: number, hi: number) => Math.min(Math.max(value, lo), hi);

// "2022-10-01" at node "07.2" <-> "#2022-10/07.2"
const toHash = (ds: string, nodeId: string, rootId: string) =>
  `#${ds.slice(0, 7)}${nodeId === rootId ? "" : `/${encodeURIComponent(nodeId)}`}`;
const HASH_PATTERN = /^#(\d{4}-\d{2})(?:\/(.+))?$/;

export function Replay({ data }: { data: ReplayData }) {
  const { dates, nodes, rootId, projectedFrom, lastActual, bands } = data;

  const [mode, setMode] = useState<Mode>(currentMode);
  const [path, setPath] = useState<string[]>([rootId]);
  const [t, setT] = useState(lastActual);
  const [playing, setPlaying] = useState(false);
  const barsRef = useRef<ECharts | null>(null);
  const timelineRef = useRef<ECharts | null>(null);
  const unbindTimeline = useRef<(() => void) | null>(null);
  const nodeRef = useRef<ReplayNode>(nodes[rootId]);
  const tRef = useRef(t);

  const node = nodes[path[path.length - 1]];
  const isRoot = node.id === rootId;
  // The raw `t` survives drilling into a node with a shorter history, so
  // coming back up returns to the month you left.
  const ti = clamp(t, node.from, node.to);
  const k = ti - node.from;
  const isPlaying = playing && ti < node.to;
  const projected = isRoot && projectedFrom !== null && ti >= projectedFrom;
  const unit = isRoot ? "%" : "ppt";

  useEffect(() => {
    nodeRef.current = node;
    tRef.current = t;
  }, [node, t]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setMode(query.matches ? "light" : "dark");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => () => unbindTimeline.current?.(), []);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setTimeout(() => {
      setT(ti + 1);
      if (ti + 1 >= node.to) setPlaying(false);
    }, FRAME_MS);
    return () => clearTimeout(id);
  }, [isPlaying, ti, node.to]);

  const commit = useCallback(
    (nextPath: string[], rawT: number) => {
      const target = nodes[nextPath[nextPath.length - 1]];
      setPath(nextPath);
      setT(rawT);
      window.history.replaceState(null, "", toHash(dates[clamp(rawT, target.from, target.to)], target.id, rootId));
    },
    [dates, nodes, rootId],
  );

  const drill = (childId: string) => commit([...path, childId], t);
  const select = (index: number) => commit(path, index);

  function togglePlay() {
    if (isPlaying) {
      setPlaying(false);
      window.history.replaceState(null, "", toHash(dates[ti], node.id, rootId));
      return;
    }
    if (ti >= node.to) setT(node.from);
    setPlaying(true);
  }

  const muted = MUTED_TEXT[mode];
  const grid = GRIDLINE[mode];
  const text = mode === "dark" ? "#ffffff" : "#0b0b0b";
  const residualColor = mode === "dark" ? "#6b6a63" : "#a8a69d";

  const barsOption = useMemo<EChartsOption>(() => {
    const flat = [...node.values.flat(), ...(node.residual ?? [])];
    const names = node.children.map((c) => (c.drillable ? `${c.name} ›` : c.name));
    if (node.residual) names.push(RESIDUAL_LABEL);
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
        min: Math.min(0, Math.floor(Math.min(...flat) * 2) / 2),
        max: Math.ceil(Math.max(...flat) * 2) / 2,
        axisLabel: { color: muted, formatter: "{value}ppt" },
        splitLine: { lineStyle: { color: grid } },
      },
      yAxis: {
        type: "category",
        inverse: true,
        max: names.length - 1,
        data: names,
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
  }, [mode, node, muted, grid, text]);

  const timelineOption = useMemo<EChartsOption>(() => {
    const months = dates.slice(node.from, node.to + 1);
    const step = months.length > 200 ? 4 : months.length > 100 ? 2 : 1;
    const lineColor = HEADLINE_COLOR[mode];
    const stack = (id: string, name: string, color: string, values: number[]) => ({
      id,
      name,
      type: "bar" as const,
      stack: "contribution",
      barCategoryGap: 0,
      silent: true,
      itemStyle: { color },
      data: values,
    });
    return {
      backgroundColor: CHART_SURFACE[mode],
      textStyle: { fontFamily: FONT_FAMILY, color: text },
      animationDuration: 0,
      animationDurationUpdate: FRAME_MS,
      animationEasingUpdate: "linear",
      grid: { left: 8, right: 16, top: 12, bottom: 24, containLabel: true },
      tooltip: { show: false },
      xAxis: {
        type: "category",
        data: months,
        axisLine: { lineStyle: { color: muted } },
        axisTick: { show: false },
        axisLabel: {
          color: muted,
          formatter: (value: string) => value.slice(0, 4),
          interval: (_index: number, value: string) => value.slice(5, 7) === "01" && Number(value.slice(0, 4)) % step === 0,
        },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: muted, formatter: `{value}${unit}` },
        splitLine: { lineStyle: { color: grid } },
      },
      series: [
        ...node.children.map((c, i) =>
          stack(
            c.id,
            c.name,
            c.color[mode],
            node.values.map((row) => row[i]),
          ),
        ),
        ...(node.residual ? [stack("residual", RESIDUAL_LABEL, residualColor, node.residual)] : []),
        {
          id: "total",
          type: "line" as const,
          data: node.total,
          showSymbol: false,
          silent: true,
          z: 5,
          lineStyle: { width: 1.5, color: lineColor },
          itemStyle: { color: lineColor },
          markArea:
            isRoot && projectedFrom !== null
              ? {
                  silent: true,
                  itemStyle: { color: mode === "dark" ? "rgba(26,26,25,0.55)" : "rgba(252,252,251,0.55)" },
                  data: [[{ xAxis: dates[projectedFrom] }, { xAxis: dates[node.to] }]],
                }
              : undefined,
        },
        {
          id: "cursor",
          type: "scatter" as const,
          data: [],
          symbolSize: 14,
          silent: true,
          z: 10,
          itemStyle: { color: lineColor, borderColor: CHART_SURFACE[mode], borderWidth: 2 },
          markLine: {
            silent: true,
            symbol: "none",
            animation: false,
            label: { show: false },
            lineStyle: { color: lineColor, width: 1, type: "solid", opacity: 0.6 },
            data: [{ xAxis: months[0] }],
          },
        },
      ],
    };
  }, [mode, node, dates, projectedFrom, isRoot, unit, muted, grid, text, residualColor]);

  // Drive both charts from the cursor through setOption (merged by series
  // id) so the bars animate between frames instead of being rebuilt.
  useEffect(() => {
    const row = node.values[k];
    const bars = node.children.map((c, i) => ({
      value: row[i],
      itemStyle: { color: c.color[mode], opacity: projected ? PROJECTED_OPACITY : 1 },
    }));
    if (node.residual) bars.push({ value: node.residual[k], itemStyle: { color: residualColor, opacity: 1 } });
    barsRef.current?.setOption({ series: [{ id: "bars", data: bars }] });
    timelineRef.current?.setOption({
      series: [{ id: "cursor", data: [[dates[ti], node.total[k]]], markLine: { data: [{ xAxis: dates[ti] }] } }],
    });
  }, [k, ti, mode, projected, node, dates, residualColor, barsOption, timelineOption]);

  function onTimelineReady(instance: ECharts) {
    timelineRef.current = instance;
    unbindTimeline.current?.();

    // Deep link: `/replay#2022-10/07.2` opens on that month and node. Read
    // here, once the client has mounted, so server and client agree on the
    // first frame.
    const linked = HASH_PATTERN.exec(window.location.hash);
    if (linked) {
      const index = dates.indexOf(`${linked[1]}-01`);
      const chain: string[] = [];
      for (let n: ReplayNode | undefined = nodes[decodeURIComponent(linked[2] ?? rootId)]; n; n = n.parent ? nodes[n.parent] : undefined) {
        chain.unshift(n.id);
      }
      if (index >= 0 && chain[0] === rootId) {
        setPath(chain);
        setT(index);
      }
    }

    const zr = instance.getZr();
    let dragging = false;
    const seek = (event: { offsetX: number; offsetY: number }) => {
      const current = nodeRef.current;
      const [month] = instance.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [event.offsetX, event.offsetY]) as [number, number];
      setPlaying(false);
      setT(current.from + clamp(Math.round(month), 0, current.to - current.from));
    };
    const onDown = (event: { offsetX: number; offsetY: number }) => {
      dragging = true;
      seek(event);
    };
    const onMove = (event: { offsetX: number; offsetY: number }) => dragging && seek(event);
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      const target = nodeRef.current;
      window.history.replaceState(null, "", toHash(dates[clamp(tRef.current, target.from, target.to)], target.id, rootId));
    };
    zr.on("mousedown", onDown);
    zr.on("mousemove", onMove);
    zr.on("mouseup", onUp);
    zr.on("globalout", onUp);
    unbindTimeline.current = () => {
      zr.off("mousedown", onDown);
      zr.off("mousemove", onMove);
      zr.off("mouseup", onUp);
      zr.off("globalout", onUp);
    };
  }

  const barEvents = {
    click: (event: ECElementEvent) => {
      const child = node.children[event.dataIndex];
      if (child?.drillable) drill(child.id);
    },
    mouseover: (event: ECElementEvent) => {
      barsRef.current?.getZr().setCursorStyle(node.children[event.dataIndex]?.drillable ? "pointer" : "default");
    },
    mouseout: () => barsRef.current?.getZr().setCursorStyle("default"),
  };

  const total = node.total[k];
  const residual = node.residual?.[k];

  return (
    <>
      <nav className="replay-crumbs" aria-label="Basket level">
        {path.map((id, i) => (
          <span key={id}>
            {i > 0 && <span className="replay-crumb-sep"> › </span>}
            {i === path.length - 1 ? (
              <b>{nodes[id].name}</b>
            ) : (
              <button type="button" className="replay-crumb" onClick={() => commit(path.slice(0, i + 1), t)}>
                {nodes[id].name}
              </button>
            )}
          </span>
        ))}
      </nav>

      <div className="replay-readout">
        {isRoot ? (
          <div className={`stat-tile band-${bands[ti - node.from]}`}>
            <div className="stat-label">{projected ? "CPI 12-month rate (projected)" : "CPI 12-month rate"}</div>
            <div className="stat-value-row">
              <span className="stat-value">{total.toFixed(1)}%</span>
              <span className="stat-delta">{monthLabel(dates[ti])}</span>
            </div>
            <div className="stat-meta">
              Divisions sum to {node.values[k].reduce((a, b) => a + b, 0).toFixed(1)}ppt
              {projected ? " · this project's own projection, not ONS data" : ""}
            </div>
          </div>
        ) : (
          <div className="stat-tile">
            <div className="stat-label">{node.name} · contribution to CPI</div>
            <div className="stat-value-row">
              <span className="stat-value">{total.toFixed(2)}ppt</span>
              <span className="stat-delta">{monthLabel(dates[ti])}</span>
            </div>
            <div className="stat-meta">
              {node.totalPublished ? "ONS-published" : "Derived: weight × 12-month rate"}. Sub-categories are derived
              the same way; the residual ({residual?.toFixed(2)}ppt) reconciles them to this total.
            </div>
          </div>
        )}
        <div className="replay-moments" role="group" aria-label="Jump to a moment">
          {MOMENTS.filter((m) => {
            const index = dates.indexOf(m.date);
            return index >= node.from && index <= node.to;
          }).map((m) => (
            <button
              key={m.date}
              type="button"
              className={dates[ti] === m.date ? "range-btn active" : "range-btn"}
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
            className={ti === lastActual ? "range-btn active" : "range-btn"}
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
          notMerge
          style={{ width: "100%", height: "430px" }}
          onChartReady={(instance: ECharts) => {
            barsRef.current = instance;
          }}
          onEvents={barEvents}
        />
      </section>
      <p className="muted" style={{ marginTop: -14 }}>
        {node.children.some((c) => c.drillable) ? "Click a bar marked › to drill into it." : "This is the deepest level."}
        {!isRoot && node.from > 0 ? ` History at this level starts ${monthLabel(dates[node.from])}.` : ""}
      </p>

      <section className="chart-section">
        <ReactECharts
          option={timelineOption}
          notMerge
          style={{ width: "100%", height: "190px", cursor: "ew-resize" }}
          onChartReady={onTimelineReady}
        />
        <div className="replay-controls">
          <button type="button" className="range-btn active replay-play" onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? "Pause" : ti >= node.to ? "Replay" : "Play"}
          </button>
          <StripeScrubber
            label="Month"
            fill={stripeFill}
            values={nodes[rootId].total}
            projectedFrom={projectedFrom}
            from={node.from}
            to={node.to}
            index={ti}
            describe={(i) => `${monthLabel(dates[i])} · ${nodes[rootId].total[i].toFixed(1)}%`}
            onSeek={(i) => {
              setPlaying(false);
              setT(i);
            }}
            onCommit={(i) => commit(path, i)}
          />
        </div>
      </section>
    </>
  );
}
